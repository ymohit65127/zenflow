# ZenFlow — Accounting v2 Implementation

**Document Version:** 2.0.0
**Date:** 2026-05-27
**Stack:** Next.js 15 · TypeScript 5 · tRPC v11 · Prisma v6 · PostgreSQL 16 · BullMQ + Redis · MinIO

---

## Table of Contents

1. [Overview & Design Philosophy](#1-overview--design-philosophy)
2. [Database Schema — Complete Prisma Models](#2-database-schema--complete-prisma-models)
3. [File Structure](#3-file-structure)
4. [tRPC Routers & Procedures](#4-trpc-routers--procedures)
5. [Pages & Routes](#5-pages--routes)
6. [Business Logic](#6-business-logic)
7. [Background Jobs (BullMQ)](#7-background-jobs-bullmq)
8. [npm Packages](#8-npm-packages)
9. [Environment Variables](#9-environment-variables)
10. [Migration Strategy](#10-migration-strategy)

---

## 1. Overview & Design Philosophy

ZenFlow Accounting v2 is a full double-entry bookkeeping engine built for multi-tenant SaaS. Every financial transaction — invoice, payment, bill, expense, bank deposit, depreciation, payroll — posts a balanced journal entry (total debits = total credits). The Chart of Accounts is the spine; all financial reports derive from JE lines aggregated against COA nodes.

### Core Principles

- **Double-Entry Immutability:** Posted journal entries are never deleted. Reversals create equal-and-opposite entries.
- **Period Locking:** `AccFinancialPeriod.is_locked` prevents posting to closed periods. Prior-period adjustments require explicit unlock + audit log.
- **Cached Balances:** `current_balance` on COA is a denormalized cache updated atomically on every post via Prisma transactions. Source of truth is always the JE lines.
- **Multi-Currency:** Every transaction carries `currency` + `exchange_rate`. Base-currency amounts (`base_debit`/`base_credit`) stored alongside.
- **GST-Ready:** IRN, QR code, HSN/SAC codes, CGST/SGST/IGST component breakdown built in from the start.
- **Audit Trail:** Every mutation records `created_by`/`updated_by`. JE post records `posted_by` + `posted_at`.

---

## 2. Database Schema — Complete Prisma Models

Add the following to `packages/database/prisma/schema.prisma`:

```prisma
// ─────────────────────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────────────────────

enum AccAccountType {
  asset
  liability
  equity
  revenue
  expense
  contra_asset
  contra_liability
}

enum AccNormalBalance {
  debit
  credit
}

enum AccJournalStatus {
  draft
  posted
  reversed
  void
}

enum AccJournalSource {
  manual
  invoice
  payment
  bill
  expense
  payroll
  depreciation
  bank_reconciliation
  opening_balance
  adjustment
  other
}

enum AccInvoiceStatus {
  draft
  sent
  viewed
  partially_paid
  paid
  overdue
  void
  credit_note
}

enum AccInvoiceType {
  standard
  proforma
  credit_note
  debit_note
  recurring
}

enum AccPaymentTerms {
  immediate
  net_15
  net_30
  net_45
  net_60
  net_90
  custom
}

enum AccPaymentType {
  customer_payment
  vendor_payment
  advance
  refund
}

enum AccPaymentMethod {
  cash
  bank_transfer
  cheque
  upi
  card
  neft
  rtgs
  imps
  other
}

enum AccBillStatus {
  draft
  pending
  approved
  partially_paid
  paid
  overdue
  void
}

enum AccTaxType {
  gst
  vat
  service_tax
  custom
  none
}

enum AccBankAccountType {
  savings
  current
  overdraft
  fixed_deposit
  credit_card
}

enum AccBankTransactionType {
  debit
  credit
}

enum AccBankTransactionStatus {
  unmatched
  matched
  ignored
  excluded
}

enum AccRecurringFrequency {
  daily
  weekly
  bi_weekly
  monthly
  quarterly
  half_yearly
  annually
}

enum AccRecurringStatus {
  active
  paused
  completed
  cancelled
}

enum AccExpenseApprovalStatus {
  draft
  submitted
  approved
  rejected
  reimbursed
}

enum AccExpensePaymentMethod {
  company_card
  personal
  petty_cash
  other
}

enum AccDepreciationMethod {
  straight_line
  declining_balance
  sum_of_years
}

enum AccBudgetStatus {
  draft
  active
  archived
}

enum AccDiscountType {
  percent
  amount
}

// ─────────────────────────────────────────────────────────────────────────────
// CHART OF ACCOUNTS
// ─────────────────────────────────────────────────────────────────────────────

model AccChartOfAccount {
  id                String           @id @default(cuid())
  org_id            String
  code              String           @db.VarChar(20)
  name              String           @db.VarChar(255)
  account_type      AccAccountType
  account_sub_type  String?          @db.VarChar(100)
  // e.g. current_asset | fixed_asset | current_liability | long_term_liability
  //      retained_earnings | cost_of_goods_sold | operating_expense

  parent_account_id String?
  parent_account    AccChartOfAccount?  @relation("COAHierarchy", fields: [parent_account_id], references: [id])
  child_accounts    AccChartOfAccount[] @relation("COAHierarchy")

  level             Int              @default(1)
  is_system         Boolean          @default(false)
  description       String?          @db.Text
  currency          String           @default("USD") @db.VarChar(3)
  opening_balance   Decimal          @default(0) @db.Decimal(15, 4)
  current_balance   Decimal          @default(0) @db.Decimal(15, 4)
  normal_balance    AccNormalBalance
  is_active         Boolean          @default(true)
  deleted_at        DateTime?

  created_at        DateTime         @default(now())
  updated_at        DateTime         @updatedAt

  // Relations
  journal_lines     AccJournalEntryLine[]
  bank_accounts     AccBankAccount[]
  tax_accounts      AccTax[]
  asset_accounts    AccFixedAsset[]    @relation("AssetAccount")
  accum_dep_accounts AccFixedAsset[]  @relation("AccumDepAccount")
  dep_exp_accounts  AccFixedAsset[]   @relation("DepExpAccount")
  budget_lines      AccBudgetLine[]
  invoice_lines     AccInvoiceLine[]
  bill_lines        AccBillLine[]

  @@unique([org_id, code])
  @@index([org_id, account_type, is_active])
  @@map("acc_chart_of_accounts")
}

// ─────────────────────────────────────────────────────────────────────────────
// FINANCIAL PERIOD
// ─────────────────────────────────────────────────────────────────────────────

model AccFinancialPeriod {
  id         String    @id @default(cuid())
  org_id     String
  year       Int
  month      Int       // 1–12
  start_date DateTime  @db.Date
  end_date   DateTime  @db.Date
  is_locked  Boolean   @default(false)
  locked_by  String?   @db.VarChar(36)
  locked_at  DateTime?
  created_at DateTime  @default(now())

  @@unique([org_id, year, month])
  @@index([org_id, year])
  @@map("acc_financial_periods")
}

// ─────────────────────────────────────────────────────────────────────────────
// JOURNAL ENTRIES
// ─────────────────────────────────────────────────────────────────────────────

model AccJournalEntry {
  id                  String             @id @default(cuid())
  org_id              String
  entry_number        String             @db.VarChar(50)
  entry_date          DateTime           @db.Date
  reference           String?            @db.VarChar(255)
  description         String             @db.Text
  source_type         AccJournalSource   @default(manual)
  source_id           String?            @db.VarChar(36)
  currency            String?            @db.VarChar(3)
  exchange_rate       Decimal            @default(1) @db.Decimal(12, 8)
  status              AccJournalStatus   @default(draft)
  posted_at           DateTime?
  posted_by           String?            @db.VarChar(36)

  reversed_entry_id   String?
  reversed_entry      AccJournalEntry?   @relation("JEReversals", fields: [reversed_entry_id], references: [id])
  reversal_of         AccJournalEntry[]  @relation("JEReversals")

  reversal_date       DateTime?          @db.Date
  period_locked       Boolean            @default(false)
  financial_year      Int?
  financial_period    Int?
  total_debit         Decimal?           @db.Decimal(15, 4)
  total_credit        Decimal?           @db.Decimal(15, 4)

  created_by          String?            @db.VarChar(36)
  created_at          DateTime           @default(now())
  updated_at          DateTime           @updatedAt

  lines               AccJournalEntryLine[]
  invoices            AccInvoice[]
  bills               AccBill[]
  payments            AccPayment[]
  expenses            AccExpense[]

  @@unique([org_id, entry_number])
  @@index([org_id, entry_date, status])
  @@index([source_type, source_id])
  @@map("acc_journal_entries")
}

model AccJournalEntryLine {
  id                   String            @id @default(cuid())
  journal_entry_id     String
  journal_entry        AccJournalEntry   @relation(fields: [journal_entry_id], references: [id], onDelete: Cascade)
  account_id           String
  account              AccChartOfAccount @relation(fields: [account_id], references: [id])
  description          String?           @db.VarChar(500)
  debit_amount         Decimal           @default(0) @db.Decimal(15, 4)
  credit_amount        Decimal           @default(0) @db.Decimal(15, 4)
  currency             String?           @db.VarChar(3)
  exchange_rate        Decimal           @default(1) @db.Decimal(12, 8)
  base_debit           Decimal?          @db.Decimal(15, 4)
  base_credit          Decimal?          @db.Decimal(15, 4)
  contact_id           String?           @db.VarChar(36)
  cost_center_id       String?           @db.VarChar(36)
  project_id           String?           @db.VarChar(36)
  tax_id               String?           @db.VarChar(36)
  tax_amount           Decimal           @default(0) @db.Decimal(15, 4)
  reconciled           Boolean           @default(false)
  reconciled_at        DateTime?
  bank_transaction_id  String?           @db.VarChar(36)
  line_order           Int
  created_at           DateTime          @default(now())

  bank_transactions    AccBankTransaction[]

  @@index([journal_entry_id])
  @@index([account_id, reconciled])
  @@map("acc_journal_entry_lines")
}

// ─────────────────────────────────────────────────────────────────────────────
// TAX
// ─────────────────────────────────────────────────────────────────────────────

model AccTax {
  id             String            @id @default(cuid())
  org_id         String
  name           String            @db.VarChar(100)
  type           AccTaxType        @default(gst)
  rate           Decimal           @db.Decimal(6, 4)
  // For GST: [{name:"CGST",rate:9},{name:"SGST",rate:9}] or [{name:"IGST",rate:18}]
  components     Json?
  tax_account_id String?
  tax_account    AccChartOfAccount? @relation(fields: [tax_account_id], references: [id])
  is_active      Boolean           @default(true)
  is_default     Boolean           @default(false)
  created_at     DateTime          @default(now())

  invoice_lines  AccInvoiceLine[]
  bill_lines     AccBillLine[]

  @@index([org_id, is_active])
  @@map("acc_taxes")
}

// ─────────────────────────────────────────────────────────────────────────────
// VENDOR
// ─────────────────────────────────────────────────────────────────────────────

model AccVendor {
  id                  String          @id @default(cuid())
  org_id              String
  name                String          @db.VarChar(255)
  vendor_code         String?         @db.VarChar(50)
  email               String?         @db.VarChar(255)
  phone               String?         @db.VarChar(30)
  billing_address     Json?
  shipping_address    Json?
  gstin               String?         @db.VarChar(15)
  pan                 String?         @db.VarChar(10)
  payment_terms       AccPaymentTerms?
  currency            String?         @db.VarChar(3)
  bank_account_number String?         @db.VarChar(50)
  bank_ifsc           String?         @db.VarChar(20)
  bank_name           String?         @db.VarChar(100)
  credit_limit        Decimal?        @db.Decimal(15, 2)
  outstanding_balance Decimal         @default(0) @db.Decimal(15, 4)
  tags                String[]
  notes               String?         @db.Text
  is_active           Boolean         @default(true)
  tds_applicable      Boolean         @default(false)
  tds_section         String?         @db.VarChar(20)
  tds_rate            Decimal?        @db.Decimal(5, 4)
  deleted_at          DateTime?
  created_at          DateTime        @default(now())
  updated_at          DateTime        @updatedAt

  bills               AccBill[]
  fixed_assets        AccFixedAsset[]
  expenses            AccExpense[]

  @@unique([org_id, vendor_code])
  @@index([org_id, is_active])
  @@map("acc_vendors")
}

// ─────────────────────────────────────────────────────────────────────────────
// INVOICE
// ─────────────────────────────────────────────────────────────────────────────

model AccInvoice {
  id                       String           @id @default(cuid())
  org_id                   String
  invoice_number           String           @db.VarChar(50)
  invoice_type             AccInvoiceType   @default(standard)
  original_invoice_id      String?
  original_invoice         AccInvoice?      @relation("CreditDebitNotes", fields: [original_invoice_id], references: [id])
  credit_debit_notes       AccInvoice[]     @relation("CreditDebitNotes")

  contact_id               String?          @db.VarChar(36)
  contact_billing_address  Json?
  contact_shipping_address Json?
  purchase_order_number    String?          @db.VarChar(100)
  invoice_date             DateTime         @db.Date
  due_date                 DateTime?        @db.Date
  currency                 String           @default("INR") @db.VarChar(3)
  exchange_rate            Decimal          @default(1) @db.Decimal(12, 8)

  status                   AccInvoiceStatus @default(draft)
  subtotal                 Decimal          @default(0) @db.Decimal(15, 4)
  discount_type            AccDiscountType?
  discount_value           Decimal          @default(0) @db.Decimal(15, 4)
  discount_amount          Decimal          @default(0) @db.Decimal(15, 4)
  taxable_amount           Decimal          @default(0) @db.Decimal(15, 4)
  tax_total                Decimal          @default(0) @db.Decimal(15, 4)
  grand_total              Decimal          @default(0) @db.Decimal(15, 4)
  amount_paid              Decimal          @default(0) @db.Decimal(15, 4)
  balance_due              Decimal          @default(0) @db.Decimal(15, 4)
  notes                    String?          @db.Text
  terms                    String?          @db.Text
  custom_fields            Json?
  payment_terms            AccPaymentTerms  @default(net_30)
  payment_due_days         Int              @default(30)
  sent_at                  DateTime?
  viewed_at                DateTime?
  view_count               Int              @default(0)

  recurring_config_id      String?
  recurring_config         AccRecurringInvoice? @relation(fields: [recurring_config_id], references: [id])

  payment_link_url         String?          @db.VarChar(500)
  payment_link_expires_at  DateTime?

  journal_entry_id         String?
  journal_entry            AccJournalEntry? @relation(fields: [journal_entry_id], references: [id])

  financial_year           Int?
  financial_period         Int?

  // GST e-Invoice
  e_invoice_irn            String?          @db.VarChar(100)
  e_invoice_qr             String?          @db.Text
  pdf_url                  String?          @db.VarChar(500)

  created_by               String?          @db.VarChar(36)
  created_at               DateTime         @default(now())
  updated_at               DateTime         @updatedAt

  lines                    AccInvoiceLine[]
  payments                 AccPayment[]

  @@unique([org_id, invoice_number])
  @@index([org_id, invoice_date, status])
  @@index([org_id, contact_id])
  @@index([org_id, due_date, status])
  @@map("acc_invoices")
}

model AccInvoiceLine {
  id              String             @id @default(cuid())
  invoice_id      String
  invoice         AccInvoice         @relation(fields: [invoice_id], references: [id], onDelete: Cascade)
  product_id      String?            @db.VarChar(36)
  description     String             @db.VarChar(1000)
  quantity        Decimal            @db.Decimal(10, 4)
  unit            String?            @db.VarChar(50)
  unit_price      Decimal            @db.Decimal(15, 4)
  discount_type   AccDiscountType?
  discount_value  Decimal            @default(0) @db.Decimal(15, 4)
  discount_amount Decimal            @default(0) @db.Decimal(15, 4)
  taxable_amount  Decimal            @default(0) @db.Decimal(15, 4)
  tax_id          String?
  tax             AccTax?            @relation(fields: [tax_id], references: [id])
  tax_rate        Decimal            @default(0) @db.Decimal(6, 4)
  tax_amount      Decimal            @default(0) @db.Decimal(15, 4)
  line_total      Decimal            @db.Decimal(15, 4)
  hsn_sac_code    String?            @db.VarChar(20)
  account_id      String?
  account         AccChartOfAccount? @relation(fields: [account_id], references: [id])
  project_id      String?            @db.VarChar(36)
  position        Int
  created_at      DateTime           @default(now())

  @@index([invoice_id])
  @@map("acc_invoice_lines")
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT
// ─────────────────────────────────────────────────────────────────────────────

model AccPayment {
  id                 String           @id @default(cuid())
  org_id             String
  payment_number     String           @db.VarChar(50)
  payment_date       DateTime         @db.Date
  contact_id         String?          @db.VarChar(36)
  payment_type       AccPaymentType   @default(customer_payment)
  payment_method     AccPaymentMethod @default(bank_transfer)
  amount             Decimal          @db.Decimal(15, 4)
  currency           String           @db.VarChar(3)
  exchange_rate      Decimal          @default(1) @db.Decimal(12, 8)
  reference_number   String?          @db.VarChar(100)
  bank_account_id    String
  bank_account       AccBankAccount   @relation(fields: [bank_account_id], references: [id])
  notes              String?          @db.Text
  gateway_payment_id String?          @db.VarChar(255)
  // [{invoice_id: "...", allocated_amount: 5000.00}]
  allocations        Json?
  journal_entry_id   String?
  journal_entry      AccJournalEntry? @relation(fields: [journal_entry_id], references: [id])
  invoice_id         String?
  invoice            AccInvoice?      @relation(fields: [invoice_id], references: [id])

  created_by         String?          @db.VarChar(36)
  created_at         DateTime         @default(now())
  updated_at         DateTime         @updatedAt

  bank_transactions  AccBankTransaction[]

  @@unique([org_id, payment_number])
  @@index([org_id, payment_date])
  @@index([contact_id])
  @@map("acc_payments")
}

// ─────────────────────────────────────────────────────────────────────────────
// BILL (ACCOUNTS PAYABLE)
// ─────────────────────────────────────────────────────────────────────────────

model AccBill {
  id                    String          @id @default(cuid())
  org_id                String
  bill_number           String          @db.VarChar(100)
  vendor_id             String
  vendor                AccVendor       @relation(fields: [vendor_id], references: [id])
  vendor_invoice_number String?         @db.VarChar(100)
  bill_date             DateTime        @db.Date
  due_date              DateTime?       @db.Date
  currency              String?         @db.VarChar(3)
  exchange_rate         Decimal?        @db.Decimal(12, 8)
  subtotal              Decimal         @db.Decimal(15, 4)
  tax_total             Decimal         @default(0) @db.Decimal(15, 4)
  grand_total           Decimal         @db.Decimal(15, 4)
  amount_paid           Decimal         @default(0) @db.Decimal(15, 4)
  balance_due           Decimal         @db.Decimal(15, 4)
  status                AccBillStatus   @default(draft)
  purchase_order_id     String?         @db.VarChar(36)
  notes                 String?         @db.Text
  payment_terms         AccPaymentTerms?
  journal_entry_id      String?
  journal_entry         AccJournalEntry? @relation(fields: [journal_entry_id], references: [id])
  created_by            String?         @db.VarChar(36)
  created_at            DateTime        @default(now())
  updated_at            DateTime        @updatedAt

  lines                 AccBillLine[]

  @@unique([org_id, bill_number])
  @@index([org_id, bill_date, status])
  @@index([vendor_id, status])
  @@map("acc_bills")
}

model AccBillLine {
  id           String             @id @default(cuid())
  bill_id      String
  bill         AccBill            @relation(fields: [bill_id], references: [id], onDelete: Cascade)
  description  String             @db.VarChar(1000)
  quantity     Decimal            @db.Decimal(10, 4)
  unit_price   Decimal            @db.Decimal(15, 4)
  tax_id       String?
  tax          AccTax?            @relation(fields: [tax_id], references: [id])
  tax_rate     Decimal            @default(0) @db.Decimal(6, 4)
  tax_amount   Decimal            @default(0) @db.Decimal(15, 4)
  line_total   Decimal            @db.Decimal(15, 4)
  account_id   String
  account      AccChartOfAccount  @relation(fields: [account_id], references: [id])
  hsn_sac_code String?            @db.VarChar(20)
  position     Int
  created_at   DateTime           @default(now())

  @@index([bill_id])
  @@map("acc_bill_lines")
}

// ─────────────────────────────────────────────────────────────────────────────
// BANK ACCOUNT
// ─────────────────────────────────────────────────────────────────────────────

model AccBankAccount {
  id                    String             @id @default(cuid())
  org_id                String
  name                  String             @db.VarChar(200)
  account_number        String?            @db.VarChar(50)
  bank_name             String?            @db.VarChar(100)
  bank_branch           String?            @db.VarChar(200)
  ifsc_code             String?            @db.VarChar(20)
  account_type          AccBankAccountType @default(current)
  currency              String             @default("INR") @db.VarChar(3)
  opening_balance       Decimal            @default(0) @db.Decimal(15, 4)
  current_balance       Decimal            @default(0) @db.Decimal(15, 4)
  last_reconciled_date  DateTime?          @db.Date
  gl_account_id         String?
  gl_account            AccChartOfAccount? @relation(fields: [gl_account_id], references: [id])
  is_active             Boolean            @default(true)
  created_at            DateTime           @default(now())
  updated_at            DateTime           @updatedAt

  transactions          AccBankTransaction[]
  payments              AccPayment[]

  @@index([org_id, is_active])
  @@map("acc_bank_accounts")
}

model AccBankTransaction {
  id                    String                   @id @default(cuid())
  bank_account_id       String
  bank_account          AccBankAccount           @relation(fields: [bank_account_id], references: [id])
  transaction_date      DateTime                 @db.Date
  value_date            DateTime?                @db.Date
  description           String?                  @db.VarChar(500)
  reference             String?                  @db.VarChar(200)
  amount                Decimal                  @db.Decimal(15, 4)
  type                  AccBankTransactionType
  running_balance       Decimal?                 @db.Decimal(15, 4)
  status                AccBankTransactionStatus @default(unmatched)
  journal_entry_line_id String?
  journal_entry_line    AccJournalEntryLine?     @relation(fields: [journal_entry_line_id], references: [id])
  payment_id            String?
  payment               AccPayment?              @relation(fields: [payment_id], references: [id])
  import_batch_id       String?                  @db.VarChar(36)
  created_at            DateTime                 @default(now())

  @@index([bank_account_id, transaction_date])
  @@index([status, bank_account_id])
  @@map("acc_bank_transactions")
}

// ─────────────────────────────────────────────────────────────────────────────
// RECURRING INVOICE
// ─────────────────────────────────────────────────────────────────────────────

model AccRecurringInvoice {
  id                    String                @id @default(cuid())
  org_id                String
  name                  String                @db.VarChar(200)
  contact_id            String?               @db.VarChar(36)
  frequency             AccRecurringFrequency
  day_of_month          Int?
  next_invoice_date     DateTime?             @db.Date
  end_date              DateTime?             @db.Date
  occurrences_limit     Int?
  occurrences_generated Int                   @default(0)
  auto_send             Boolean               @default(true)
  auto_approve          Boolean               @default(false)
  status                AccRecurringStatus    @default(active)
  last_generated_at     DateTime?
  created_by            String?               @db.VarChar(36)
  created_at            DateTime              @default(now())
  updated_at            DateTime              @updatedAt

  invoices              AccInvoice[]

  @@index([org_id, status, next_invoice_date])
  @@map("acc_recurring_invoices")
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPENSE
// ─────────────────────────────────────────────────────────────────────────────

model AccExpense {
  id                String                   @id @default(cuid())
  org_id            String
  expense_number    String?                  @db.VarChar(50)
  vendor_id         String?
  vendor            AccVendor?               @relation(fields: [vendor_id], references: [id])
  expense_account_id String
  expense_date      DateTime                 @db.Date
  description       String?                  @db.VarChar(500)
  receipt_url       String?                  @db.VarChar(500)
  receipt_ocr_data  Json?
  amount            Decimal                  @db.Decimal(15, 4)
  currency          String?                  @db.VarChar(3)
  tax_id            String?                  @db.VarChar(36)
  tax_amount        Decimal                  @default(0) @db.Decimal(15, 4)
  billable          Boolean                  @default(false)
  billed            Boolean                  @default(false)
  project_id        String?                  @db.VarChar(36)
  contact_id        String?                  @db.VarChar(36)
  employee_id       String?                  @db.VarChar(36)
  payment_method    AccExpensePaymentMethod?
  approval_status   AccExpenseApprovalStatus @default(draft)
  approved_by       String?                  @db.VarChar(36)
  approved_at       DateTime?
  rejected_reason   String?                  @db.Text
  journal_entry_id  String?
  journal_entry     AccJournalEntry?         @relation(fields: [journal_entry_id], references: [id])
  reimbursed_at     DateTime?
  created_by        String?                  @db.VarChar(36)
  created_at        DateTime                 @default(now())
  updated_at        DateTime                 @updatedAt

  @@index([org_id, expense_date])
  @@index([org_id, approval_status])
  @@map("acc_expenses")
}

// ─────────────────────────────────────────────────────────────────────────────
// FIXED ASSETS
// ─────────────────────────────────────────────────────────────────────────────

model AccFixedAsset {
  id                              String                @id @default(cuid())
  org_id                          String
  name                            String                @db.VarChar(255)
  asset_code                      String?               @db.VarChar(50)
  asset_category                  String?               @db.VarChar(100)
  description                     String?               @db.Text
  purchase_date                   DateTime              @db.Date
  purchase_value                  Decimal               @db.Decimal(15, 4)
  salvage_value                   Decimal               @default(0) @db.Decimal(15, 4)
  useful_life_months              Int
  depreciation_method             AccDepreciationMethod @default(straight_line)
  asset_account_id                String
  asset_account                   AccChartOfAccount     @relation("AssetAccount", fields: [asset_account_id], references: [id])
  accumulated_depreciation_account_id String
  accumulated_depreciation_account AccChartOfAccount   @relation("AccumDepAccount", fields: [accumulated_depreciation_account_id], references: [id])
  depreciation_expense_account_id String
  depreciation_expense_account    AccChartOfAccount     @relation("DepExpAccount", fields: [depreciation_expense_account_id], references: [id])
  current_book_value              Decimal?              @db.Decimal(15, 4)
  disposed_at                     DateTime?
  disposal_proceeds               Decimal?              @db.Decimal(15, 4)
  disposal_gain_loss              Decimal?              @db.Decimal(15, 4)
  vendor_id                       String?
  vendor                          AccVendor?            @relation(fields: [vendor_id], references: [id])
  invoice_id                      String?               @db.VarChar(36)
  location                        String?               @db.VarChar(255)
  custodian_employee_id           String?               @db.VarChar(36)
  qr_code_url                     String?               @db.VarChar(500)
  created_at                      DateTime              @default(now())
  updated_at                      DateTime              @updatedAt

  depreciation_schedules          AccDepreciationSchedule[]

  @@index([org_id, asset_category])
  @@map("acc_fixed_assets")
}

model AccDepreciationSchedule {
  id              String        @id @default(cuid())
  asset_id        String
  asset           AccFixedAsset @relation(fields: [asset_id], references: [id])
  period_year     Int
  period_month    Int
  depreciation    Decimal       @db.Decimal(15, 4)
  book_value_after Decimal      @db.Decimal(15, 4)
  journal_entry_id String?      @db.VarChar(36)
  posted          Boolean       @default(false)
  posted_at       DateTime?
  created_at      DateTime      @default(now())

  @@unique([asset_id, period_year, period_month])
  @@map("acc_depreciation_schedules")
}

// ─────────────────────────────────────────────────────────────────────────────
// BUDGET
// ─────────────────────────────────────────────────────────────────────────────

model AccBudget {
  id             String           @id @default(cuid())
  org_id         String
  name           String           @db.VarChar(200)
  financial_year Int
  status         AccBudgetStatus  @default(draft)
  created_by     String?          @db.VarChar(36)
  created_at     DateTime         @default(now())
  updated_at     DateTime         @updatedAt

  lines          AccBudgetLine[]

  @@index([org_id, financial_year])
  @@map("acc_budgets")
}

model AccBudgetLine {
  id                  String            @id @default(cuid())
  budget_id           String
  budget              AccBudget         @relation(fields: [budget_id], references: [id], onDelete: Cascade)
  account_id          String
  account             AccChartOfAccount @relation(fields: [account_id], references: [id])
  // {1: 10000, 2: 10000, ..., 12: 10000}
  period_allocations  Json
  total               Decimal           @db.Decimal(15, 4)
  created_at          DateTime          @default(now())
  updated_at          DateTime          @updatedAt

  @@unique([budget_id, account_id])
  @@map("acc_budget_lines")
}

// ─────────────────────────────────────────────────────────────────────────────
// COST CENTER
// ─────────────────────────────────────────────────────────────────────────────

model AccCostCenter {
  id          String         @id @default(cuid())
  org_id      String
  code        String         @db.VarChar(20)
  name        String         @db.VarChar(200)
  description String?        @db.Text
  manager_id  String?        @db.VarChar(36)
  parent_id   String?
  parent      AccCostCenter? @relation("CCHierarchy", fields: [parent_id], references: [id])
  children    AccCostCenter[] @relation("CCHierarchy")
  is_active   Boolean        @default(true)
  created_at  DateTime       @default(now())

  @@unique([org_id, code])
  @@index([org_id, is_active])
  @@map("acc_cost_centers")
}
```

---

## 3. File Structure

```
apps/web/
├── app/
│   └── (dashboard)/
│       └── accounting/
│           ├── layout.tsx                          # Accounting shell with sidebar nav
│           ├── page.tsx                            # Accounting overview / dashboard
│           ├── chart-of-accounts/
│           │   ├── page.tsx                        # COA tree view
│           │   └── [id]/
│           │       └── page.tsx                    # Account detail + ledger
│           ├── journal-entries/
│           │   ├── page.tsx                        # JE list with filters
│           │   ├── new/
│           │   │   └── page.tsx                    # Manual JE form
│           │   └── [id]/
│           │       └── page.tsx                    # JE detail / audit view
│           ├── invoices/
│           │   ├── page.tsx                        # Invoice list
│           │   ├── new/
│           │   │   └── page.tsx                    # Invoice builder
│           │   └── [id]/
│           │       ├── page.tsx                    # Invoice view
│           │       └── edit/
│           │           └── page.tsx
│           ├── payments/
│           │   ├── page.tsx
│           │   └── [id]/
│           │       └── page.tsx
│           ├── bills/
│           │   ├── page.tsx
│           │   ├── new/
│           │   │   └── page.tsx
│           │   └── [id]/
│           │       └── page.tsx
│           ├── vendors/
│           │   ├── page.tsx
│           │   └── [id]/
│           │       └── page.tsx
│           ├── expenses/
│           │   ├── page.tsx
│           │   └── [id]/
│           │       └── page.tsx
│           ├── bank/
│           │   ├── page.tsx                        # Bank accounts list
│           │   └── [accountId]/
│           │       ├── page.tsx                    # Transactions + reconcile
│           │       └── reconcile/
│           │           └── page.tsx
│           ├── assets/
│           │   ├── page.tsx
│           │   ├── new/
│           │   │   └── page.tsx
│           │   └── [id]/
│           │       └── page.tsx
│           ├── budgets/
│           │   ├── page.tsx
│           │   └── [id]/
│           │       └── page.tsx
│           ├── cost-centers/
│           │   └── page.tsx
│           ├── recurring/
│           │   └── page.tsx
│           ├── taxes/
│           │   └── page.tsx
│           └── reports/
│               ├── page.tsx                        # Reports hub
│               ├── profit-loss/
│               │   └── page.tsx
│               ├── balance-sheet/
│               │   └── page.tsx
│               ├── cash-flow/
│               │   └── page.tsx
│               ├── trial-balance/
│               │   └── page.tsx
│               ├── aged-receivables/
│               │   └── page.tsx
│               ├── aged-payables/
│               │   └── page.tsx
│               ├── gst/
│               │   ├── page.tsx                    # GST summary
│               │   ├── gstr1/
│               │   │   └── page.tsx
│               │   └── gstr2/
│               │       └── page.tsx
│               └── budget-vs-actual/
│                   └── page.tsx

packages/
├── database/
│   └── prisma/
│       └── schema.prisma                           # Models above added here
├── api/
│   └── src/
│       └── routers/
│           └── accounting/
│               ├── index.ts                        # mergeRouters
│               ├── coa.router.ts
│               ├── journal.router.ts
│               ├── invoices.router.ts
│               ├── payments.router.ts
│               ├── bills.router.ts
│               ├── vendors.router.ts
│               ├── bank.router.ts
│               ├── reconciliation.router.ts
│               ├── expenses.router.ts
│               ├── assets.router.ts
│               ├── reports.router.ts
│               ├── tax.router.ts
│               ├── gst.router.ts
│               └── budget.router.ts
└── accounting-engine/
    └── src/
        ├── double-entry.ts                         # Core JE posting engine
        ├── gst-calculator.ts
        ├── bank-reconciliation.ts
        ├── depreciation.ts
        ├── financial-statements.ts
        ├── aging-buckets.ts
        ├── recurring-invoice.ts
        ├── number-sequences.ts                     # JE-2026-00001 generation
        └── period-locker.ts

apps/workers/
└── src/
    └── accounting/
        ├── recurring-invoice.worker.ts
        ├── depreciation.worker.ts
        ├── bank-import.worker.ts
        ├── invoice-pdf.worker.ts
        ├── e-invoice.worker.ts
        └── payment-reminder.worker.ts
```

---

## 4. tRPC Routers & Procedures

### 4.1 accounting.coa

```typescript
// packages/api/src/routers/accounting/coa.router.ts
import { z } from "zod";
import { router, protectedProcedure } from "../../trpc";
import { TRPCError } from "@trpc/server";

export const coaRouter = router({
  // GET /coa — full tree for an org
  list: protectedProcedure
    .input(z.object({ include_inactive: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.accChartOfAccount.findMany({
        where: {
          org_id: ctx.session.org_id,
          ...(input.include_inactive ? {} : { is_active: true }),
          deleted_at: null,
        },
        orderBy: [{ code: "asc" }],
      });
    }),

  // Create account
  create: protectedProcedure
    .input(z.object({
      code: z.string().max(20),
      name: z.string().max(255),
      account_type: z.enum(["asset","liability","equity","revenue","expense","contra_asset","contra_liability"]),
      account_sub_type: z.string().optional(),
      parent_account_id: z.string().optional(),
      normal_balance: z.enum(["debit","credit"]),
      currency: z.string().length(3).optional(),
      description: z.string().optional(),
      opening_balance: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Validate code uniqueness
      const exists = await ctx.db.accChartOfAccount.findUnique({
        where: { org_id_code: { org_id: ctx.session.org_id, code: input.code } },
      });
      if (exists) throw new TRPCError({ code: "CONFLICT", message: "Account code already exists" });

      let level = 1;
      if (input.parent_account_id) {
        const parent = await ctx.db.accChartOfAccount.findUnique({
          where: { id: input.parent_account_id },
          select: { level: true },
        });
        level = (parent?.level ?? 0) + 1;
      }

      return ctx.db.accChartOfAccount.create({
        data: { ...input, org_id: ctx.session.org_id, level, current_balance: input.opening_balance ?? 0 },
      });
    }),

  // Get account ledger (JE lines for an account with running balance)
  ledger: protectedProcedure
    .input(z.object({
      account_id: z.string(),
      from_date: z.string(),
      to_date: z.string(),
      page: z.number().default(1),
      per_page: z.number().max(200).default(50),
    }))
    .query(async ({ ctx, input }) => {
      const lines = await ctx.db.accJournalEntryLine.findMany({
        where: {
          account_id: input.account_id,
          journal_entry: {
            org_id: ctx.session.org_id,
            status: "posted",
            entry_date: { gte: new Date(input.from_date), lte: new Date(input.to_date) },
          },
        },
        include: { journal_entry: { select: { entry_number: true, entry_date: true, description: true, source_type: true } } },
        orderBy: { journal_entry: { entry_date: "asc" } },
        skip: (input.page - 1) * input.per_page,
        take: input.per_page,
      });
      return lines;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string().optional(), description: z.string().optional(), is_active: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const account = await ctx.db.accChartOfAccount.findUnique({ where: { id } });
      if (account?.is_system) throw new TRPCError({ code: "FORBIDDEN", message: "System accounts cannot be modified" });
      return ctx.db.accChartOfAccount.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const account = await ctx.db.accChartOfAccount.findUnique({ where: { id: input.id } });
      if (account?.is_system) throw new TRPCError({ code: "FORBIDDEN", message: "System accounts cannot be deleted" });
      // Soft delete
      return ctx.db.accChartOfAccount.update({
        where: { id: input.id },
        data: { deleted_at: new Date(), is_active: false },
      });
    }),
});
```

### 4.2 accounting.journal

```typescript
// Procedures: create (draft), post, reverse, void, list, getById, bulkImport

export const journalRouter = router({
  create: protectedProcedure
    .input(JournalEntryCreateSchema)
    .mutation(async ({ ctx, input }) => {
      await validatePeriodOpen(ctx.db, ctx.session.org_id, input.entry_date);
      const entry_number = await generateEntryNumber(ctx.db, ctx.session.org_id, "JE");
      return ctx.db.accJournalEntry.create({
        data: {
          ...input,
          org_id: ctx.session.org_id,
          entry_number,
          created_by: ctx.session.user_id,
          financial_year: new Date(input.entry_date).getFullYear(),
          financial_period: new Date(input.entry_date).getMonth() + 1,
          lines: { create: input.lines.map((l, i) => ({ ...l, line_order: i })) },
        },
        include: { lines: true },
      });
    }),

  post: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return postJournalEntry(ctx.db, input.id, ctx.session.user_id);
    }),

  reverse: protectedProcedure
    .input(z.object({ id: z.string(), reversal_date: z.string(), description: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return reverseJournalEntry(ctx.db, ctx.session.org_id, input.id, input.reversal_date, ctx.session.user_id, input.description);
    }),
});
```

### 4.3 accounting.invoices

```typescript
// Procedures:
// - list(filters: status, contact_id, from_date, to_date, page)
// - getById(id)
// - create(draft)
// - update(id, data) — only draft invoices
// - send(id) — marks sent_at, dispatches PDF + email job
// - recordPayment(id, payment_data) — creates AccPayment + allocates
// - generateCreditNote(id, lines) — creates linked credit_note invoice
// - void(id)
// - download(id) — returns signed MinIO URL for PDF
// - bulkSend(ids[])
// - getPublicView(token) — public link, increments view_count
```

### 4.4 accounting.payments

```typescript
// Procedures:
// - list, getById, create, apply(allocate to invoices), delete
// - createRefund(payment_id, amount)
```

### 4.5 accounting.bills

```typescript
// Procedures:
// - list(filters), getById, create, update, approve, recordPayment, void
```

### 4.6 accounting.vendors

```typescript
// Procedures:
// - list, getById, create, update, delete(soft), getStatement, getAgingReport
```

### 4.7 accounting.bank

```typescript
// Procedures:
// - listAccounts, createAccount, updateAccount
// - listTransactions(account_id, filters)
// - importCSV(account_id, file_url) — triggers BullMQ job
// - getReconciliationSuggestions(account_id, date_range) — ML fuzzy match
```

### 4.8 accounting.reconciliation

```typescript
// Procedures:
// - matchTransaction(bank_tx_id, journal_line_id)
// - unmatch(bank_tx_id)
// - ignoreTransaction(bank_tx_id)
// - bulkAutoMatch(account_id) — runs matching algorithm
// - getReconciliationSummary(account_id)
// - finalizeReconciliation(account_id, statement_date, closing_balance)
```

### 4.9 accounting.reports

```typescript
// Procedures:
// - profitAndLoss(from_date, to_date, compare_period?, cost_center_id?)
// - balanceSheet(as_of_date)
// - trialBalance(from_date, to_date)
// - cashFlowStatement(from_date, to_date)
// - agedReceivables(as_of_date, buckets: [30,60,90,120])
// - agedPayables(as_of_date, buckets: [30,60,90,120])
// - generalLedger(account_id?, from_date, to_date)
// - budgetVsActual(budget_id, period)
```

### 4.10 accounting.gst

```typescript
// Procedures:
// - getGSTR1Summary(month, year) — outward supplies
// - getGSTR2Summary(month, year) — inward supplies
// - computeTaxLiability(month, year)
// - generateEInvoice(invoice_id) — calls GSP API, stores IRN + QR
// - getHSNSummary(from_date, to_date)
```

---

## 5. Pages & Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/accounting` | `AccountingDashboard` | KPI cards: revenue, expenses, net profit, AR, AP, cash balance |
| `/accounting/chart-of-accounts` | `COAPage` | Collapsible tree; add/edit/deactivate; import from CSV |
| `/accounting/chart-of-accounts/[id]` | `AccountLedgerPage` | Full GL ledger for account with date range filter |
| `/accounting/journal-entries` | `JournalEntriesPage` | Paginated list; status badges; post/reverse actions |
| `/accounting/journal-entries/new` | `JournalEntryForm` | Multi-line debit/credit form; real-time balance validation |
| `/accounting/invoices` | `InvoicesPage` | List + kanban by status; bulk send/download |
| `/accounting/invoices/new` | `InvoiceBuilder` | Line-item editor; tax auto-calc; PDF preview |
| `/accounting/invoices/[id]` | `InvoiceDetailPage` | View + payment history + JE link |
| `/accounting/payments` | `PaymentsPage` | Payment list; unallocated amount alert |
| `/accounting/bills` | `BillsPage` | AP queue; approve + pay workflow |
| `/accounting/vendors` | `VendorsPage` | Vendor list + statement + aging |
| `/accounting/expenses` | `ExpensesPage` | Expense list + approval workflow |
| `/accounting/bank` | `BankAccountsPage` | Card per bank account with balance + reconcile status |
| `/accounting/bank/[accountId]` | `BankTransactionsPage` | Transactions + smart match panel |
| `/accounting/bank/[accountId]/reconcile` | `ReconcilePage` | Side-by-side: bank statement vs GL |
| `/accounting/assets` | `FixedAssetsPage` | Asset register; depreciation timeline |
| `/accounting/budgets` | `BudgetsPage` | Budget list |
| `/accounting/budgets/[id]` | `BudgetDetailPage` | Monthly allocation grid; vs-actual chart |
| `/accounting/reports` | `ReportsHub` | Report picker with preview |
| `/accounting/reports/profit-loss` | `PLReport` | P&L with expand/collapse accounts; period comparison |
| `/accounting/reports/balance-sheet` | `BalanceSheetReport` | Assets = Liabilities + Equity |
| `/accounting/reports/trial-balance` | `TrialBalanceReport` | All accounts with debit/credit totals |
| `/accounting/reports/aged-receivables` | `ARAgingReport` | Customer aging buckets |
| `/accounting/reports/aged-payables` | `APAgingReport` | Vendor aging buckets |
| `/accounting/reports/gst` | `GSTReport` | GST R1/R2 summary tabs |
| `/accounting/taxes` | `TaxesPage` | Tax rates; GST components |
| `/accounting/cost-centers` | `CostCentersPage` | CC hierarchy |
| `/accounting/recurring` | `RecurringInvoicesPage` | Active schedules; next run date |

---

## 6. Business Logic

### 6.1 Double-Entry Posting Algorithm

```typescript
// packages/accounting-engine/src/double-entry.ts

import { PrismaClient, AccJournalStatus } from "@zenflow/database";
import { TRPCError } from "@trpc/server";
import Decimal from "decimal.js";

export async function postJournalEntry(
  db: PrismaClient,
  journalEntryId: string,
  postedBy: string
): Promise<void> {
  await db.$transaction(async (tx) => {
    // 1. Fetch entry with lines
    const entry = await tx.accJournalEntry.findUniqueOrThrow({
      where: { id: journalEntryId },
      include: { lines: { include: { account: true } } },
    });

    if (entry.status !== "draft") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft entries can be posted" });
    }

    // 2. Validate period is open
    const period = await tx.accFinancialPeriod.findUnique({
      where: {
        org_id_year_month: {
          org_id: entry.org_id,
          year: entry.financial_year!,
          month: entry.financial_period!,
        },
      },
    });
    if (period?.is_locked) {
      throw new TRPCError({ code: "FORBIDDEN", message: `Period ${entry.financial_year}-${entry.financial_period} is locked` });
    }

    // 3. Validate balance: sum(debits) === sum(credits)
    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);
    for (const line of entry.lines) {
      totalDebit = totalDebit.plus(line.debit_amount ?? 0);
      totalCredit = totalCredit.plus(line.credit_amount ?? 0);
    }
    if (!totalDebit.equals(totalCredit)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Entry is unbalanced: debits ${totalDebit} ≠ credits ${totalCredit}`,
      });
    }

    // 4. Update COA balances atomically
    for (const line of entry.lines) {
      const { account, debit_amount, credit_amount } = line;
      const exchangeRate = new Decimal(line.exchange_rate ?? 1);
      const baseDebit = new Decimal(debit_amount ?? 0).mul(exchangeRate);
      const baseCredit = new Decimal(credit_amount ?? 0).mul(exchangeRate);

      // Normal balance debit accounts (asset, expense, contra_liability):
      //   balance increases on debit, decreases on credit
      // Normal balance credit accounts (liability, equity, revenue, contra_asset):
      //   balance increases on credit, decreases on debit
      const balanceDelta =
        account.normal_balance === "debit"
          ? baseDebit.minus(baseCredit)
          : baseCredit.minus(baseDebit);

      await tx.accChartOfAccount.update({
        where: { id: account.id },
        data: { current_balance: { increment: balanceDelta.toNumber() } },
      });

      // Store base currency amounts on line
      await tx.accJournalEntryLine.update({
        where: { id: line.id },
        data: {
          base_debit: baseDebit.toNumber(),
          base_credit: baseCredit.toNumber(),
        },
      });
    }

    // 5. Mark entry as posted
    await tx.accJournalEntry.update({
      where: { id: journalEntryId },
      data: {
        status: "posted",
        posted_at: new Date(),
        posted_by: postedBy,
        total_debit: totalDebit.toNumber(),
        total_credit: totalCredit.toNumber(),
      },
    });
  });
}

export async function reverseJournalEntry(
  db: PrismaClient,
  orgId: string,
  originalId: string,
  reversalDate: string,
  reversedBy: string,
  description: string
): Promise<string> {
  const original = await db.accJournalEntry.findUniqueOrThrow({
    where: { id: originalId },
    include: { lines: true },
  });

  if (original.status !== "posted") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Only posted entries can be reversed" });
  }

  const reversalNumber = await generateEntryNumber(db, orgId, "JE");

  const reversal = await db.accJournalEntry.create({
    data: {
      org_id: orgId,
      entry_number: reversalNumber,
      entry_date: new Date(reversalDate),
      description: `Reversal of ${original.entry_number}: ${description}`,
      source_type: "adjustment",
      currency: original.currency,
      exchange_rate: original.exchange_rate,
      financial_year: new Date(reversalDate).getFullYear(),
      financial_period: new Date(reversalDate).getMonth() + 1,
      reversed_entry_id: originalId,
      reversal_date: new Date(reversalDate),
      created_by: reversedBy,
      // Flip debits and credits
      lines: {
        create: original.lines.map((line, i) => ({
          account_id: line.account_id,
          description: line.description,
          debit_amount: line.credit_amount,  // swap
          credit_amount: line.debit_amount,  // swap
          currency: line.currency,
          exchange_rate: line.exchange_rate,
          cost_center_id: line.cost_center_id,
          project_id: line.project_id,
          line_order: i,
        })),
      },
    },
  });

  await postJournalEntry(db, reversal.id, reversedBy);

  await db.accJournalEntry.update({
    where: { id: originalId },
    data: { status: "reversed" },
  });

  return reversal.id;
}
```

### 6.2 Invoice JE Auto-Post

```typescript
// When invoice is marked 'sent' or 'approved', auto-post this JE:
// DR Accounts Receivable (asset)     grand_total
// CR Revenue Account (revenue)       taxable_amount per line
// CR GST Payable (liability)         tax_total

export async function postInvoiceJournalEntry(
  db: PrismaClient,
  invoiceId: string,
  postedBy: string
): Promise<void> {
  const invoice = await db.accInvoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { lines: { include: { account: true, tax: true } } },
  });

  const entryNumber = await generateEntryNumber(db, invoice.org_id, "JE");

  // Build lines
  const jeLines = [];
  let lineOrder = 0;

  // Debit: AR
  jeLines.push({
    account_id: await getSystemAccountId(db, invoice.org_id, "accounts_receivable"),
    debit_amount: invoice.grand_total,
    credit_amount: 0,
    description: `Invoice ${invoice.invoice_number}`,
    line_order: lineOrder++,
  });

  // Credit: Revenue per line
  for (const line of invoice.lines) {
    jeLines.push({
      account_id: line.account_id ?? await getSystemAccountId(db, invoice.org_id, "revenue"),
      debit_amount: 0,
      credit_amount: line.taxable_amount,
      description: line.description,
      line_order: lineOrder++,
    });
  }

  // Credit: Tax payable
  if (invoice.tax_total && new Decimal(invoice.tax_total).gt(0)) {
    jeLines.push({
      account_id: await getSystemAccountId(db, invoice.org_id, "tax_payable"),
      debit_amount: 0,
      credit_amount: invoice.tax_total,
      description: `GST on ${invoice.invoice_number}`,
      line_order: lineOrder++,
    });
  }

  const je = await db.accJournalEntry.create({
    data: {
      org_id: invoice.org_id,
      entry_number: entryNumber,
      entry_date: invoice.invoice_date,
      description: `Invoice ${invoice.invoice_number}`,
      source_type: "invoice",
      source_id: invoiceId,
      currency: invoice.currency,
      exchange_rate: invoice.exchange_rate,
      financial_year: invoice.financial_year,
      financial_period: invoice.financial_period,
      created_by: postedBy,
      lines: { create: jeLines },
    },
  });

  await postJournalEntry(db, je.id, postedBy);

  await db.accInvoice.update({
    where: { id: invoiceId },
    data: { journal_entry_id: je.id },
  });
}
```

### 6.3 GST Computation

```typescript
// packages/accounting-engine/src/gst-calculator.ts

export interface GSTComponents {
  cgst: number;   // for intra-state
  sgst: number;   // for intra-state
  igst: number;   // for inter-state
  cess: number;
}

export function computeGST(
  taxableAmount: number,
  gstRate: number, // e.g. 18
  isInterState: boolean
): GSTComponents {
  const half = gstRate / 2;
  if (isInterState) {
    return { igst: (taxableAmount * gstRate) / 100, cgst: 0, sgst: 0, cess: 0 };
  }
  return {
    igst: 0,
    cgst: (taxableAmount * half) / 100,
    sgst: (taxableAmount * half) / 100,
    cess: 0,
  };
}

export function computeLineGST(line: {
  quantity: number;
  unit_price: number;
  discount_type?: string;
  discount_value?: number;
  tax_rate: number; // percent, e.g. 18
}, isInterState: boolean) {
  const gross = line.quantity * line.unit_price;
  const discount =
    line.discount_type === "percent"
      ? (gross * (line.discount_value ?? 0)) / 100
      : (line.discount_value ?? 0);
  const taxableAmount = gross - discount;
  const gstComponents = computeGST(taxableAmount, line.tax_rate, isInterState);
  const taxAmount = gstComponents.cgst + gstComponents.sgst + gstComponents.igst;
  return { gross, discount, taxableAmount, taxAmount, gstComponents, lineTotal: taxableAmount + taxAmount };
}
```

### 6.4 Bank Reconciliation Matching Algorithm

```typescript
// packages/accounting-engine/src/bank-reconciliation.ts
// Strategy: fuzzy match on (amount, date proximity ±7 days, description similarity)

import Fuse from "fuse.js";

export interface MatchSuggestion {
  bank_tx_id: string;
  journal_line_id: string;
  confidence: number; // 0–1
  match_reasons: string[];
}

export async function generateReconciliationSuggestions(
  db: PrismaClient,
  bankAccountId: string,
  orgId: string
): Promise<MatchSuggestion[]> {
  const unmatchedBankTxs = await db.accBankTransaction.findMany({
    where: { bank_account_id: bankAccountId, status: "unmatched" },
    take: 500,
  });

  const unmatchedJELines = await db.accJournalEntryLine.findMany({
    where: {
      reconciled: false,
      bank_transaction_id: null,
      journal_entry: { org_id: orgId, status: "posted" },
    },
    include: { journal_entry: true },
    take: 1000,
  });

  const suggestions: MatchSuggestion[] = [];

  for (const btx of unmatchedBankTxs) {
    const btxAmount = Math.abs(Number(btx.amount));
    const btxDate = new Date(btx.transaction_date);

    // Filter JE lines within ±7 days and matching amount
    const candidates = unmatchedJELines.filter((jel) => {
      const jelAmount =
        btx.type === "credit"
          ? Math.abs(Number(jel.debit_amount))
          : Math.abs(Number(jel.credit_amount));
      const daysDiff = Math.abs(
        (new Date(jel.journal_entry.entry_date).getTime() - btxDate.getTime()) / 86400000
      );
      return Math.abs(jelAmount - btxAmount) < 0.01 && daysDiff <= 7;
    });

    if (candidates.length === 0) continue;

    // Score by description similarity using Fuse.js
    const fuse = new Fuse(candidates, {
      keys: ["description", "journal_entry.description", "journal_entry.reference"],
      threshold: 0.4,
      includeScore: true,
    });
    const results = fuse.search(btx.description ?? "");

    if (results.length > 0) {
      const best = results[0];
      suggestions.push({
        bank_tx_id: btx.id,
        journal_line_id: best.item.id,
        confidence: 1 - (best.score ?? 0.5),
        match_reasons: ["amount_match", "date_proximity", "description_similarity"],
      });
    } else if (candidates.length === 1) {
      suggestions.push({
        bank_tx_id: btx.id,
        journal_line_id: candidates[0].id,
        confidence: 0.7,
        match_reasons: ["amount_match", "date_proximity"],
      });
    }
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}
```

### 6.5 Straight-Line Depreciation

```typescript
// packages/accounting-engine/src/depreciation.ts

export function generateDepreciationSchedule(asset: {
  id: string;
  purchase_date: Date;
  purchase_value: number;
  salvage_value: number;
  useful_life_months: number;
  depreciation_method: string;
}) {
  const depreciable = asset.purchase_value - asset.salvage_value;
  const monthlyDep = depreciable / asset.useful_life_months;
  const schedule = [];
  let bookValue = asset.purchase_value;
  const start = new Date(asset.purchase_date);

  for (let i = 0; i < asset.useful_life_months; i++) {
    const month = ((start.getMonth() + i) % 12) + 1;
    const year = start.getFullYear() + Math.floor((start.getMonth() + i) / 12);
    let dep = monthlyDep;

    if (asset.depreciation_method === "declining_balance") {
      const annualRate = 2 / (asset.useful_life_months / 12);
      dep = (bookValue * annualRate) / 12;
    }

    dep = Math.min(dep, bookValue - asset.salvage_value);
    bookValue = Math.max(bookValue - dep, asset.salvage_value);

    schedule.push({ year, month, depreciation: dep, book_value_after: bookValue });
    if (bookValue <= asset.salvage_value) break;
  }
  return schedule;
}
```

### 6.6 Financial Statement Generation

```typescript
// packages/accounting-engine/src/financial-statements.ts

export async function getProfitAndLoss(
  db: PrismaClient,
  orgId: string,
  fromDate: string,
  toDate: string
) {
  // Aggregate JE lines for revenue and expense accounts within period
  const lines = await db.$queryRaw<Array<{
    account_id: string;
    account_type: string;
    code: string;
    name: string;
    total: number;
  }>>`
    SELECT
      coa.id as account_id,
      coa.account_type,
      coa.code,
      coa.name,
      SUM(
        CASE WHEN coa.normal_balance = 'credit'
          THEN jel.base_credit - jel.base_debit
          ELSE jel.base_debit - jel.base_credit
        END
      ) as total
    FROM acc_journal_entry_lines jel
    JOIN acc_journal_entries je ON je.id = jel.journal_entry_id
    JOIN acc_chart_of_accounts coa ON coa.id = jel.account_id
    WHERE je.org_id = ${orgId}
      AND je.status = 'posted'
      AND je.entry_date >= ${new Date(fromDate)}
      AND je.entry_date <= ${new Date(toDate)}
      AND coa.account_type IN ('revenue', 'expense', 'contra_asset')
    GROUP BY coa.id, coa.account_type, coa.code, coa.name
    ORDER BY coa.code
  `;

  const revenue = lines.filter((l) => l.account_type === "revenue");
  const expenses = lines.filter((l) => l.account_type === "expense");
  const totalRevenue = revenue.reduce((s, l) => s + Number(l.total), 0);
  const totalExpenses = expenses.reduce((s, l) => s + Number(l.total), 0);

  return { revenue, expenses, totalRevenue, totalExpenses, netProfit: totalRevenue - totalExpenses };
}

export async function getBalanceSheet(db: PrismaClient, orgId: string, asOfDate: string) {
  // Use current_balance (cached) filtered to asset/liability/equity accounts
  const accounts = await db.accChartOfAccount.findMany({
    where: {
      org_id: orgId,
      account_type: { in: ["asset", "liability", "equity", "contra_asset", "contra_liability"] },
      is_active: true,
    },
    orderBy: { code: "asc" },
  });

  const assets = accounts.filter((a) => a.account_type === "asset" || a.account_type === "contra_asset");
  const liabilities = accounts.filter((a) => a.account_type === "liability" || a.account_type === "contra_liability");
  const equity = accounts.filter((a) => a.account_type === "equity");

  return { assets, liabilities, equity };
}
```

### 6.7 Aging Buckets

```typescript
// packages/accounting-engine/src/aging-buckets.ts

export async function getAgedReceivables(
  db: PrismaClient,
  orgId: string,
  asOfDate: Date,
  buckets: number[] = [30, 60, 90, 120]
) {
  const overdueInvoices = await db.accInvoice.findMany({
    where: {
      org_id: orgId,
      status: { in: ["sent", "partially_paid", "overdue"] },
      balance_due: { gt: 0 },
    },
    select: { contact_id: true, invoice_number: true, due_date: true, balance_due: true, grand_total: true },
  });

  const result = overdueInvoices.map((inv) => {
    const daysOverdue = inv.due_date
      ? Math.floor((asOfDate.getTime() - new Date(inv.due_date).getTime()) / 86400000)
      : 0;
    const bucket =
      daysOverdue <= 0 ? "current" :
      daysOverdue <= buckets[0] ? `1-${buckets[0]}` :
      daysOverdue <= buckets[1] ? `${buckets[0]+1}-${buckets[1]}` :
      daysOverdue <= buckets[2] ? `${buckets[1]+1}-${buckets[2]}` :
      daysOverdue <= buckets[3] ? `${buckets[2]+1}-${buckets[3]}` :
      `>${buckets[3]}`;
    return { ...inv, daysOverdue, bucket };
  });

  return result;
}
```

---

## 7. Background Jobs (BullMQ)

```typescript
// apps/workers/src/accounting/recurring-invoice.worker.ts
// Queue: "accounting:recurring" — runs daily at 00:05
// For each active recurring invoice where next_invoice_date <= today:
//   1. Clone template invoice
//   2. Set dates for current period
//   3. If auto_approve: post JE
//   4. If auto_send: dispatch PDF + email job
//   5. Update next_invoice_date based on frequency
//   6. Increment occurrences_generated; check limit

// apps/workers/src/accounting/depreciation.worker.ts
// Queue: "accounting:depreciation" — runs on 1st of each month at 02:00
// For each active fixed asset not yet depreciated for current month:
//   1. Look up depreciation schedule
//   2. Create + post JE: DR Depreciation Expense, CR Accumulated Depreciation
//   3. Update current_book_value on AccFixedAsset
//   4. Mark schedule line as posted

// apps/workers/src/accounting/bank-import.worker.ts
// Queue: "accounting:bank-import"
// 1. Download CSV from MinIO
// 2. Parse (support: HDFC, ICICI, SBI, Axis, standard OFX)
// 3. Deduplicate by (account_id, transaction_date, amount, reference)
// 4. Insert AccBankTransaction records with status=unmatched
// 5. Trigger auto-match suggestions

// apps/workers/src/accounting/invoice-pdf.worker.ts
// Queue: "accounting:pdf"
// 1. Generate PDF using puppeteer/playwright from invoice HTML template
// 2. Upload to MinIO bucket: invoices/{org_id}/{invoice_id}.pdf
// 3. Update invoice.pdf_url with presigned URL

// apps/workers/src/accounting/payment-reminder.worker.ts
// Queue: "accounting:reminders" — runs daily at 09:00
// 1. Find invoices due in 3 days (upcoming) or overdue by 1, 7, 14, 30 days
// 2. Send email reminder via Resend
// 3. Create audit log entry
```

---

## 8. npm Packages

```json
{
  "dependencies": {
    "decimal.js": "^10.4.3",
    "fuse.js": "^7.0.0",
    "date-fns": "^3.6.0",
    "@aws-sdk/client-s3": "^3.600.0",
    "bullmq": "^5.12.0",
    "ioredis": "^5.4.1",
    "puppeteer": "^22.12.0",
    "papaparse": "^5.4.1",
    "qrcode": "^1.5.4",
    "jsbarcode": "^3.11.6",
    "resend": "^3.3.0",
    "zod": "^3.23.8",
    "@trpc/server": "^11.0.0",
    "@trpc/client": "^11.0.0",
    "react-hook-form": "^7.52.0",
    "@hookform/resolvers": "^3.9.0",
    "recharts": "^2.12.7",
    "xlsx": "^0.18.5",
    "@tanstack/react-table": "^8.19.2",
    "react-pdf": "^9.0.0",
    "pdfmake": "^0.2.10"
  },
  "devDependencies": {
    "@types/papaparse": "^5.3.14",
    "@types/qrcode": "^1.5.5"
  }
}
```

---

## 9. Environment Variables

```env
# Accounting
ACCOUNTING_BASE_CURRENCY=INR
GST_FISCAL_YEAR_START_MONTH=4        # April in India
INVOICE_NUMBER_PREFIX=INV
BILL_NUMBER_PREFIX=BILL
JE_NUMBER_PREFIX=JE
PAYMENT_NUMBER_PREFIX=PAY

# GSP (GST Suvidha Provider) for e-Invoice
GSP_API_URL=https://api.gsp.com/v1
GSP_CLIENT_ID=
GSP_CLIENT_SECRET=
GSP_USERNAME=
GSP_PASSWORD=

# Payment gateway (for payment link)
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# PDF / MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=
MINIO_SECRET_KEY=
MINIO_BUCKET_INVOICES=zenflow-invoices

# BullMQ / Redis
REDIS_URL=redis://localhost:6379

# Email
RESEND_API_KEY=
```

---

## 10. Migration Strategy

1. **Phase 1 (Week 1-2):** Add new Prisma models, run `prisma migrate dev`. Seed system COA accounts (Cash, AR, AP, Revenue, COGS, Tax Payable etc.) via seed script.
2. **Phase 2 (Week 3-4):** Build COA UI, manual JE form, and the double-entry engine. All other modules depend on this.
3. **Phase 3 (Week 5-6):** Invoice builder + PDF generation + email dispatch. GST computation.
4. **Phase 4 (Week 7-8):** Bills, Vendors, Payments (AR + AP full cycle).
5. **Phase 5 (Week 9-10):** Bank feed import, reconciliation UI, auto-matching.
6. **Phase 6 (Week 11-12):** Expenses, Fixed Assets, Depreciation scheduler.
7. **Phase 7 (Week 13-14):** Financial reports (P&L, Balance Sheet, Trial Balance, Cash Flow), GST reports.
8. **Phase 8 (Week 15-16):** Budgets, Cost Centers, Recurring Invoices, e-Invoice integration.

### System Account Seed (Required)

```typescript
// packages/database/prisma/seeds/accounting-system-accounts.ts
export const SYSTEM_ACCOUNTS = [
  { code: "1000", name: "Cash",                    account_type: "asset",     normal_balance: "debit",  is_system: true },
  { code: "1100", name: "Accounts Receivable",     account_type: "asset",     normal_balance: "debit",  is_system: true },
  { code: "1200", name: "Inventory Asset",         account_type: "asset",     normal_balance: "debit",  is_system: true },
  { code: "1500", name: "Fixed Assets",            account_type: "asset",     normal_balance: "debit",  is_system: true },
  { code: "1510", name: "Accumulated Depreciation",account_type: "contra_asset", normal_balance: "credit", is_system: true },
  { code: "2000", name: "Accounts Payable",        account_type: "liability", normal_balance: "credit", is_system: true },
  { code: "2100", name: "GST Payable (CGST)",      account_type: "liability", normal_balance: "credit", is_system: true },
  { code: "2101", name: "GST Payable (SGST)",      account_type: "liability", normal_balance: "credit", is_system: true },
  { code: "2102", name: "GST Payable (IGST)",      account_type: "liability", normal_balance: "credit", is_system: true },
  { code: "3000", name: "Owner Equity",            account_type: "equity",    normal_balance: "credit", is_system: true },
  { code: "3100", name: "Retained Earnings",       account_type: "equity",    normal_balance: "credit", is_system: true },
  { code: "4000", name: "Sales Revenue",           account_type: "revenue",   normal_balance: "credit", is_system: true },
  { code: "4100", name: "Service Revenue",         account_type: "revenue",   normal_balance: "credit", is_system: true },
  { code: "5000", name: "Cost of Goods Sold",      account_type: "expense",   normal_balance: "debit",  is_system: true },
  { code: "6000", name: "Salaries Expense",        account_type: "expense",   normal_balance: "debit",  is_system: true },
  { code: "6100", name: "Rent Expense",            account_type: "expense",   normal_balance: "debit",  is_system: true },
  { code: "6200", name: "Depreciation Expense",    account_type: "expense",   normal_balance: "debit",  is_system: true },
];
```

---

*End of Accounting v2 Implementation Document*
