# ZenFlow — Inventory v2 Implementation

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
10. [Implementation Roadmap](#10-implementation-roadmap)

---

## 1. Overview & Design Philosophy

ZenFlow Inventory v2 is a multi-warehouse, multi-location WMS (Warehouse Management System) with deep accounting integration. Every stock movement generates an `InvStockMovement` record and — when relevant — a corresponding journal entry in the Accounting module (FIFO COGS, inventory asset adjustments, write-offs).

### Core Principles

- **Every Movement is Recorded:** `InvStockMovement` is an append-only ledger. Stock levels (`InvStockLevel`) are a cached aggregate; source of truth is always movements.
- **FIFO by Default:** Costing uses FIFO (First-In First-Out). Average cost is also maintained per `InvStockLevel` for reporting.
- **Lot & Serial Traceability:** Optional per product. When enabled, every movement must specify `lot_id` or `serial_number`.
- **Multi-Warehouse with Bin-Level Accuracy:** 4-level location hierarchy: Warehouse > Zone > Aisle > Rack > Bin.
- **BOM + Production Orders:** Manufactured goods have a Bill of Materials. Production orders consume components (reduce stock) and produce finished goods (increase stock).
- **Accounting Integration:** All stock value changes reflect in the GL via the Accounting v2 engine. Purchasing posts: DR Inventory Asset, CR AP. Selling posts: DR COGS, CR Inventory Asset.

---

## 2. Database Schema — Complete Prisma Models

Add the following to `packages/database/prisma/schema.prisma`:

```prisma
// ─────────────────────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────────────────────

enum InvBarcodeType {
  ean13
  ean8
  upc
  code128
  qr
  custom
}

enum InvUnitOfMeasure {
  pcs
  kg
  g
  ltr
  ml
  m
  cm
  box
  carton
  dozen
  pair
  set
  custom
}

enum InvMovementType {
  purchase_receipt
  sale_delivery
  transfer_out
  transfer_in
  adjustment_in
  adjustment_out
  production_input
  production_output
  return_in
  return_out
  opening_balance
  scrapped
}

enum InvSerialStatus {
  available
  sold
  rma
  scrapped
  in_transit
}

enum InvTransferStatus {
  draft
  in_transit
  received
  cancelled
}

enum InvAdjustmentReason {
  damaged
  lost
  found
  correction
  audit
  expired
  sample
  other
}

enum InvAdjustmentStatus {
  draft
  posted
}

enum InvCountScope {
  full
  partial
  category
  location
}

enum InvCountStatus {
  draft
  counting
  reconciled
  posted
}

enum InvProductionStatus {
  draft
  confirmed
  in_progress
  completed
  cancelled
}

enum InvPriceType {
  fixed
  markup
  markdown
}

enum InvLocationType {
  zone
  aisle
  rack
  bin
  shelf
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT CATEGORY
// ─────────────────────────────────────────────────────────────────────────────

model InvProductCategory {
  id          String               @id @default(cuid())
  org_id      String
  name        String               @db.VarChar(100)
  parent_id   String?
  parent      InvProductCategory?  @relation("CategoryHierarchy", fields: [parent_id], references: [id])
  children    InvProductCategory[] @relation("CategoryHierarchy")
  description String?              @db.Text
  image_url   String?              @db.VarChar(500)
  position    Int                  @default(0)
  is_active   Boolean              @default(true)
  created_at  DateTime             @default(now())

  products    InvProduct[]

  @@index([org_id, is_active])
  @@map("inv_product_categories")
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT
// ─────────────────────────────────────────────────────────────────────────────

model InvProduct {
  id                       String              @id @default(cuid())
  org_id                   String
  name                     String              @db.VarChar(255)
  sku                      String              @db.VarChar(100)
  barcode                  String?             @db.VarChar(100)
  barcode_type             InvBarcodeType?
  hsn_code                 String?             @db.VarChar(20)
  category_id              String?
  category                 InvProductCategory? @relation(fields: [category_id], references: [id])
  brand                    String?             @db.VarChar(100)
  unit_of_measure          InvUnitOfMeasure    @default(pcs)
  purchase_unit            String?             @db.VarChar(50)
  sale_unit                String?             @db.VarChar(50)
  unit_conversion_factor   Decimal             @default(1) @db.Decimal(10, 6)

  track_inventory          Boolean             @default(true)
  has_variants             Boolean             @default(false)
  track_serial             Boolean             @default(false)
  track_batch              Boolean             @default(false)
  track_expiry             Boolean             @default(false)
  is_manufactured          Boolean             @default(false)

  purchase_description     String?             @db.Text
  sale_description         String?             @db.Text

  purchase_price           Decimal?            @db.Decimal(15, 4)
  sale_price               Decimal?            @db.Decimal(15, 4)
  min_order_quantity       Decimal?            @db.Decimal(10, 4)
  reorder_point            Decimal?            @db.Decimal(10, 4)
  reorder_quantity         Decimal?            @db.Decimal(10, 4)
  safety_stock             Decimal?            @db.Decimal(10, 4)

  weight_kg                Decimal?            @db.Decimal(8, 4)
  length_cm                Decimal?            @db.Decimal(8, 2)
  width_cm                 Decimal?            @db.Decimal(8, 2)
  height_cm                Decimal?            @db.Decimal(8, 2)
  image_urls               String[]

  // Accounting GL account links
  purchase_account_id      String?             @db.VarChar(36)
  sale_account_id          String?             @db.VarChar(36)
  inventory_account_id     String?             @db.VarChar(36)
  cogs_account_id          String?             @db.VarChar(36)
  tax_id                   String?             @db.VarChar(36)
  preferred_vendor_id      String?             @db.VarChar(36)

  is_active                Boolean             @default(true)
  deleted_at               DateTime?
  created_at               DateTime            @default(now())
  updated_at               DateTime            @updatedAt

  variants                 InvProductVariant[]
  stock_levels             InvStockLevel[]
  stock_movements          InvStockMovement[]
  serial_numbers           InvSerialNumber[]
  lots                     InvLot[]
  transfer_lines           InvStockTransferLine[]
  adjustment_lines         InvStockAdjustmentLine[]
  count_lines              InvPhysicalCountLine[]
  boms                     InvBOM[]
  production_orders        InvProductionOrder[]
  bom_components           InvBOMLine[]         @relation("BOMComponent")
  supplier_prices          InvSupplierPriceList[]
  price_entries            InvPriceListEntry[]

  @@unique([org_id, sku])
  @@index([org_id, is_active])
  @@index([org_id, category_id])
  @@map("inv_products")
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT VARIANT
// ─────────────────────────────────────────────────────────────────────────────

model InvProductVariant {
  id                   String      @id @default(cuid())
  product_id           String
  product              InvProduct  @relation(fields: [product_id], references: [id], onDelete: Cascade)
  sku                  String      @db.VarChar(100)
  barcode              String?     @db.VarChar(100)
  // e.g. {"color": "Red", "size": "XL"}
  variant_attributes   Json
  purchase_price       Decimal?    @db.Decimal(15, 4)
  sale_price           Decimal?    @db.Decimal(15, 4)
  weight_kg            Decimal?    @db.Decimal(8, 4)
  image_url            String?     @db.VarChar(500)
  is_active            Boolean     @default(true)
  created_at           DateTime    @default(now())

  stock_levels         InvStockLevel[]
  stock_movements      InvStockMovement[]
  serial_numbers       InvSerialNumber[]
  lots                 InvLot[]
  bom_components       InvBOMLine[]        @relation("BOMVariantComponent")
  production_orders    InvProductionOrder[]

  @@unique([product_id, sku])
  @@index([product_id, is_active])
  @@map("inv_product_variants")
}

// ─────────────────────────────────────────────────────────────────────────────
// WAREHOUSE
// ─────────────────────────────────────────────────────────────────────────────

model InvWarehouse {
  id                    String           @id @default(cuid())
  org_id                String
  name                  String           @db.VarChar(200)
  code                  String           @db.VarChar(50)
  description           String?          @db.Text
  address               Json?
  manager_id            String?          @db.VarChar(36)
  is_active             Boolean          @default(true)
  allow_negative_stock  Boolean          @default(false)
  is_default            Boolean          @default(false)
  created_at            DateTime         @default(now())
  updated_at            DateTime         @updatedAt

  locations             InvLocation[]
  stock_levels          InvStockLevel[]
  stock_movements       InvStockMovement[]
  transfers_from        InvStockTransfer[]  @relation("TransferFrom")
  transfers_to          InvStockTransfer[]  @relation("TransferTo")
  adjustments           InvStockAdjustment[]
  physical_counts       InvPhysicalCount[]
  production_orders     InvProductionOrder[]

  @@unique([org_id, code])
  @@index([org_id, is_active])
  @@map("inv_warehouses")
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCATION (zone/aisle/rack/bin hierarchy)
// ─────────────────────────────────────────────────────────────────────────────

model InvLocation {
  id             String          @id @default(cuid())
  warehouse_id   String
  warehouse      InvWarehouse    @relation(fields: [warehouse_id], references: [id])
  parent_id      String?
  parent         InvLocation?    @relation("LocationHierarchy", fields: [parent_id], references: [id])
  children       InvLocation[]   @relation("LocationHierarchy")
  name           String          @db.VarChar(100)
  code           String          @db.VarChar(50)
  location_type  InvLocationType
  capacity       Decimal?        @db.Decimal(10, 4)
  capacity_unit  String?         @db.VarChar(20)
  is_active      Boolean         @default(true)
  created_at     DateTime        @default(now())

  stock_levels           InvStockLevel[]
  movements_from         InvStockMovement[] @relation("MovementFromLocation")
  movements_to           InvStockMovement[] @relation("MovementToLocation")
  transfer_lines_from    InvStockTransferLine[] @relation("TransferLineFromLocation")
  transfer_lines_to      InvStockTransferLine[] @relation("TransferLineToLocation")
  adjustment_lines       InvStockAdjustmentLine[]
  count_lines            InvPhysicalCountLine[]
  serial_numbers         InvSerialNumber[]

  @@unique([warehouse_id, code])
  @@index([warehouse_id, parent_id])
  @@map("inv_locations")
}

// ─────────────────────────────────────────────────────────────────────────────
// STOCK LEVEL (cached per product/variant/warehouse/location)
// ─────────────────────────────────────────────────────────────────────────────

model InvStockLevel {
  id                  String              @id @default(cuid())
  org_id              String
  product_id          String
  product             InvProduct          @relation(fields: [product_id], references: [id])
  variant_id          String?
  variant             InvProductVariant?  @relation(fields: [variant_id], references: [id])
  warehouse_id        String
  warehouse           InvWarehouse        @relation(fields: [warehouse_id], references: [id])
  location_id         String?
  location            InvLocation?        @relation(fields: [location_id], references: [id])
  quantity_on_hand    Decimal             @default(0) @db.Decimal(14, 4)
  quantity_reserved   Decimal             @default(0) @db.Decimal(14, 4)
  // quantity_available = quantity_on_hand - quantity_reserved (computed in application)
  quantity_on_order   Decimal             @default(0) @db.Decimal(14, 4)
  average_cost        Decimal             @default(0) @db.Decimal(15, 8)
  total_value         Decimal             @default(0) @db.Decimal(15, 4)
  last_movement_at    DateTime?
  created_at          DateTime            @default(now())
  updated_at          DateTime            @updatedAt

  @@unique([product_id, variant_id, warehouse_id, location_id])
  @@index([warehouse_id, product_id])
  @@index([org_id, product_id])
  @@map("inv_stock_levels")
}

// ─────────────────────────────────────────────────────────────────────────────
// STOCK MOVEMENT (append-only ledger)
// ─────────────────────────────────────────────────────────────────────────────

model InvStockMovement {
  id                  String              @id @default(cuid())
  org_id              String
  movement_type       InvMovementType
  reference_type      String?             @db.VarChar(50)
  reference_id        String?             @db.VarChar(36)
  product_id          String
  product             InvProduct          @relation(fields: [product_id], references: [id])
  variant_id          String?
  variant             InvProductVariant?  @relation(fields: [variant_id], references: [id])
  warehouse_id        String
  warehouse           InvWarehouse        @relation(fields: [warehouse_id], references: [id])
  from_location_id    String?
  from_location       InvLocation?        @relation("MovementFromLocation", fields: [from_location_id], references: [id])
  to_location_id      String?
  to_location         InvLocation?        @relation("MovementToLocation", fields: [to_location_id], references: [id])
  lot_id              String?
  lot                 InvLot?             @relation(fields: [lot_id], references: [id])
  serial_number       String?             @db.VarChar(100)
  quantity            Decimal             @db.Decimal(14, 4)
  unit_cost           Decimal             @default(0) @db.Decimal(15, 8)
  total_cost          Decimal             @default(0) @db.Decimal(15, 8)
  running_stock       Decimal             @db.Decimal(14, 4)
  movement_date       DateTime            @default(now())
  created_by          String?             @db.VarChar(36)
  notes               String?             @db.VarChar(500)
  created_at          DateTime            @default(now())

  @@index([org_id, movement_date])
  @@index([product_id, warehouse_id])
  @@index([reference_type, reference_id])
  @@map("inv_stock_movements")
}

// ─────────────────────────────────────────────────────────────────────────────
// SERIAL NUMBER
// ─────────────────────────────────────────────────────────────────────────────

model InvSerialNumber {
  id                    String            @id @default(cuid())
  product_id            String
  product               InvProduct        @relation(fields: [product_id], references: [id])
  variant_id            String?
  variant               InvProductVariant? @relation(fields: [variant_id], references: [id])
  serial_number         String            @db.VarChar(200)
  status                InvSerialStatus   @default(available)
  warehouse_id          String?
  warehouse             InvWarehouse?     @relation(fields: [warehouse_id], references: [id])
  location_id           String?
  location              InvLocation?      @relation(fields: [location_id], references: [id])
  lot_id                String?           @db.VarChar(36)
  purchase_date         DateTime?         @db.Date
  expiry_date           DateTime?         @db.Date
  purchase_reference    String?           @db.VarChar(100)
  sale_reference        String?           @db.VarChar(100)
  sold_to_contact_id    String?           @db.VarChar(36)
  warranty_until        DateTime?         @db.Date
  notes                 String?           @db.Text
  created_at            DateTime          @default(now())
  updated_at            DateTime          @updatedAt

  @@unique([product_id, serial_number])
  @@index([product_id, status])
  @@map("inv_serial_numbers")
}

// ─────────────────────────────────────────────────────────────────────────────
// LOT / BATCH
// ─────────────────────────────────────────────────────────────────────────────

model InvLot {
  id                   String              @id @default(cuid())
  product_id           String
  product              InvProduct          @relation(fields: [product_id], references: [id])
  variant_id           String?
  variant              InvProductVariant?  @relation(fields: [variant_id], references: [id])
  lot_number           String              @db.VarChar(200)
  manufacture_date     DateTime?           @db.Date
  expiry_date          DateTime?           @db.Date
  quantity_received    Decimal             @db.Decimal(14, 4)
  quantity_remaining   Decimal             @db.Decimal(14, 4)
  cost_per_unit        Decimal             @default(0) @db.Decimal(15, 8)
  supplier_lot_number  String?             @db.VarChar(200)
  notes                String?             @db.Text
  created_at           DateTime            @default(now())

  movements            InvStockMovement[]

  @@unique([product_id, lot_number])
  @@index([product_id, expiry_date])
  @@map("inv_lots")
}

// ─────────────────────────────────────────────────────────────────────────────
// STOCK TRANSFER
// ─────────────────────────────────────────────────────────────────────────────

model InvStockTransfer {
  id                String             @id @default(cuid())
  org_id            String
  transfer_number   String             @db.VarChar(50)
  from_warehouse_id String
  from_warehouse    InvWarehouse       @relation("TransferFrom", fields: [from_warehouse_id], references: [id])
  to_warehouse_id   String
  to_warehouse      InvWarehouse       @relation("TransferTo", fields: [to_warehouse_id], references: [id])
  status            InvTransferStatus  @default(draft)
  scheduled_date    DateTime?          @db.Date
  shipped_date      DateTime?
  received_date     DateTime?
  notes             String?            @db.Text
  created_by        String?            @db.VarChar(36)
  created_at        DateTime           @default(now())
  updated_at        DateTime           @updatedAt

  lines             InvStockTransferLine[]

  @@unique([org_id, transfer_number])
  @@index([org_id, status])
  @@map("inv_stock_transfers")
}

model InvStockTransferLine {
  id                  String              @id @default(cuid())
  transfer_id         String
  transfer            InvStockTransfer    @relation(fields: [transfer_id], references: [id], onDelete: Cascade)
  product_id          String
  product             InvProduct          @relation(fields: [product_id], references: [id])
  variant_id          String?
  lot_id              String?             @db.VarChar(36)
  from_location_id    String?
  from_location       InvLocation?        @relation("TransferLineFromLocation", fields: [from_location_id], references: [id])
  to_location_id      String?
  to_location         InvLocation?        @relation("TransferLineToLocation", fields: [to_location_id], references: [id])
  quantity_requested  Decimal             @db.Decimal(14, 4)
  quantity_shipped    Decimal             @default(0) @db.Decimal(14, 4)
  quantity_received   Decimal             @default(0) @db.Decimal(14, 4)
  unit_cost           Decimal             @default(0) @db.Decimal(15, 8)
  created_at          DateTime            @default(now())

  @@index([transfer_id])
  @@map("inv_stock_transfer_lines")
}

// ─────────────────────────────────────────────────────────────────────────────
// STOCK ADJUSTMENT
// ─────────────────────────────────────────────────────────────────────────────

model InvStockAdjustment {
  id                  String              @id @default(cuid())
  org_id              String
  adjustment_number   String              @db.VarChar(50)
  warehouse_id        String
  warehouse           InvWarehouse        @relation(fields: [warehouse_id], references: [id])
  adjustment_date     DateTime            @db.Date
  reason              InvAdjustmentReason @default(correction)
  notes               String?             @db.Text
  status              InvAdjustmentStatus @default(draft)
  total_value_change  Decimal?            @db.Decimal(15, 4)
  created_by          String?             @db.VarChar(36)
  posted_at           DateTime?
  posted_by           String?             @db.VarChar(36)
  created_at          DateTime            @default(now())
  updated_at          DateTime            @updatedAt

  lines               InvStockAdjustmentLine[]

  @@unique([org_id, adjustment_number])
  @@index([org_id, adjustment_date])
  @@map("inv_stock_adjustments")
}

model InvStockAdjustmentLine {
  id               String              @id @default(cuid())
  adjustment_id    String
  adjustment       InvStockAdjustment  @relation(fields: [adjustment_id], references: [id], onDelete: Cascade)
  product_id       String
  product          InvProduct          @relation(fields: [product_id], references: [id])
  variant_id       String?
  location_id      String?
  location         InvLocation?        @relation(fields: [location_id], references: [id])
  lot_id           String?             @db.VarChar(36)
  quantity_before  Decimal             @db.Decimal(14, 4)
  quantity_after   Decimal             @db.Decimal(14, 4)
  quantity_change  Decimal             @db.Decimal(14, 4)
  unit_cost        Decimal             @db.Decimal(15, 8)
  value_change     Decimal             @db.Decimal(15, 4)
  reason_note      String?             @db.VarChar(255)
  created_at       DateTime            @default(now())

  @@index([adjustment_id])
  @@map("inv_stock_adjustment_lines")
}

// ─────────────────────────────────────────────────────────────────────────────
// PHYSICAL COUNT
// ─────────────────────────────────────────────────────────────────────────────

model InvPhysicalCount {
  id              String          @id @default(cuid())
  org_id          String
  count_number    String          @db.VarChar(50)
  warehouse_id    String
  warehouse       InvWarehouse    @relation(fields: [warehouse_id], references: [id])
  scope           InvCountScope   @default(full)
  status          InvCountStatus  @default(draft)
  scheduled_date  DateTime?       @db.Date
  started_at      DateTime?
  completed_at    DateTime?
  notes           String?         @db.Text
  created_by      String?         @db.VarChar(36)
  created_at      DateTime        @default(now())
  updated_at      DateTime        @updatedAt

  lines           InvPhysicalCountLine[]

  @@unique([org_id, count_number])
  @@index([org_id, status])
  @@map("inv_physical_counts")
}

model InvPhysicalCountLine {
  id               String           @id @default(cuid())
  count_id         String
  count            InvPhysicalCount @relation(fields: [count_id], references: [id], onDelete: Cascade)
  product_id       String
  product          InvProduct       @relation(fields: [product_id], references: [id])
  variant_id       String?
  location_id      String?
  location         InvLocation?     @relation(fields: [location_id], references: [id])
  lot_id           String?          @db.VarChar(36)
  system_quantity  Decimal          @db.Decimal(14, 4)
  counted_quantity Decimal?         @db.Decimal(14, 4)
  variance         Decimal?         @db.Decimal(14, 4)
  unit_cost        Decimal          @default(0) @db.Decimal(15, 8)
  variance_value   Decimal?         @db.Decimal(15, 4)
  counted_by       String?          @db.VarChar(36)
  counted_at       DateTime?
  notes            String?          @db.VarChar(255)
  created_at       DateTime         @default(now())

  @@index([count_id])
  @@map("inv_physical_count_lines")
}

// ─────────────────────────────────────────────────────────────────────────────
// BILL OF MATERIALS (BOM)
// ─────────────────────────────────────────────────────────────────────────────

model InvBOM {
  id               String              @id @default(cuid())
  org_id           String
  product_id       String
  product          InvProduct          @relation(fields: [product_id], references: [id])
  variant_id       String?
  name             String              @db.VarChar(200)
  version          String              @default("1.0") @db.VarChar(20)
  quantity         Decimal             @default(1) @db.Decimal(10, 4)
  unit             String?             @db.VarChar(50)
  is_default       Boolean             @default(true)
  overhead_cost    Decimal             @default(0) @db.Decimal(15, 4)
  created_by       String?             @db.VarChar(36)
  created_at       DateTime            @default(now())
  updated_at       DateTime            @updatedAt

  lines            InvBOMLine[]
  production_orders InvProductionOrder[]

  @@index([org_id, product_id])
  @@map("inv_boms")
}

model InvBOMLine {
  id                       String              @id @default(cuid())
  bom_id                   String
  bom                      InvBOM              @relation(fields: [bom_id], references: [id], onDelete: Cascade)
  component_product_id     String
  component_product        InvProduct          @relation("BOMComponent", fields: [component_product_id], references: [id])
  component_variant_id     String?
  component_variant        InvProductVariant?  @relation("BOMVariantComponent", fields: [component_variant_id], references: [id])
  quantity                 Decimal             @db.Decimal(10, 6)
  unit                     String?             @db.VarChar(50)
  scrap_percent            Decimal             @default(0) @db.Decimal(5, 2)
  cost_allocation_percent  Decimal             @default(0) @db.Decimal(5, 2)
  notes                    String?             @db.VarChar(255)
  position                 Int
  created_at               DateTime            @default(now())

  @@index([bom_id])
  @@map("inv_bom_lines")
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTION ORDER
// ─────────────────────────────────────────────────────────────────────────────

model InvProductionOrder {
  id               String               @id @default(cuid())
  org_id           String
  order_number     String               @db.VarChar(50)
  product_id       String
  product          InvProduct           @relation(fields: [product_id], references: [id])
  variant_id       String?
  variant          InvProductVariant?   @relation(fields: [variant_id], references: [id])
  bom_id           String
  bom              InvBOM               @relation(fields: [bom_id], references: [id])
  quantity         Decimal              @db.Decimal(10, 4)
  warehouse_id     String
  warehouse        InvWarehouse         @relation(fields: [warehouse_id], references: [id])
  scheduled_start  DateTime?            @db.Date
  scheduled_end    DateTime?            @db.Date
  actual_start     DateTime?
  actual_end       DateTime?
  status           InvProductionStatus  @default(draft)
  notes            String?              @db.Text
  created_by       String?              @db.VarChar(36)
  created_at       DateTime             @default(now())
  updated_at       DateTime             @updatedAt

  @@unique([org_id, order_number])
  @@index([org_id, status])
  @@map("inv_production_orders")
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPPLIER PRICE LIST
// ─────────────────────────────────────────────────────────────────────────────

model InvSupplierPriceList {
  id                  String     @id @default(cuid())
  product_id          String
  product             InvProduct @relation(fields: [product_id], references: [id])
  variant_id          String?
  vendor_id           String     @db.VarChar(36)
  vendor_sku          String?    @db.VarChar(100)
  unit_price          Decimal    @db.Decimal(15, 4)
  currency            String     @db.VarChar(3)
  min_order_quantity  Decimal    @default(1) @db.Decimal(10, 4)
  lead_time_days      Int        @default(7)
  effective_from      DateTime   @db.Date
  effective_to        DateTime?  @db.Date
  is_preferred        Boolean    @default(false)
  created_at          DateTime   @default(now())

  @@index([product_id, vendor_id])
  @@index([product_id, is_preferred])
  @@map("inv_supplier_price_lists")
}

// ─────────────────────────────────────────────────────────────────────────────
// PRICE LIST
// ─────────────────────────────────────────────────────────────────────────────

model InvPriceList {
  id          String       @id @default(cuid())
  org_id      String
  name        String       @db.VarChar(200)
  description String?      @db.Text
  currency    String       @db.VarChar(3)
  price_type  InvPriceType
  is_default  Boolean      @default(false)
  is_active   Boolean      @default(true)
  valid_from  DateTime?    @db.Date
  valid_to    DateTime?    @db.Date
  created_at  DateTime     @default(now())
  updated_at  DateTime     @updatedAt

  entries     InvPriceListEntry[]

  @@index([org_id, is_active])
  @@map("inv_price_lists")
}

model InvPriceListEntry {
  id            String       @id @default(cuid())
  price_list_id String
  price_list    InvPriceList @relation(fields: [price_list_id], references: [id], onDelete: Cascade)
  product_id    String
  product       InvProduct   @relation(fields: [product_id], references: [id])
  variant_id    String?
  price         Decimal      @db.Decimal(15, 4)
  min_quantity  Decimal      @default(1) @db.Decimal(10, 4)
  created_at    DateTime     @default(now())

  @@unique([price_list_id, product_id, variant_id, min_quantity])
  @@index([price_list_id])
  @@map("inv_price_list_entries")
}
```

---

## 3. File Structure

```
apps/web/
├── app/
│   └── (dashboard)/
│       └── inventory/
│           ├── layout.tsx                          # Inventory shell with sidebar
│           ├── page.tsx                            # Inventory dashboard (KPIs)
│           ├── products/
│           │   ├── page.tsx                        # Product list with filters
│           │   ├── new/
│           │   │   └── page.tsx                    # Product creation form
│           │   └── [id]/
│           │       ├── page.tsx                    # Product detail
│           │       ├── edit/
│           │       │   └── page.tsx
│           │       ├── variants/
│           │       │   └── page.tsx
│           │       └── stock/
│           │           └── page.tsx                # Stock by warehouse
│           ├── categories/
│           │   └── page.tsx
│           ├── warehouses/
│           │   ├── page.tsx
│           │   └── [id]/
│           │       ├── page.tsx                    # Warehouse overview
│           │       └── locations/
│           │           └── page.tsx                # Location tree
│           ├── stock/
│           │   ├── page.tsx                        # Stock overview (all warehouses)
│           │   └── movements/
│           │       └── page.tsx                    # Movement log
│           ├── transfers/
│           │   ├── page.tsx
│           │   ├── new/
│           │   │   └── page.tsx
│           │   └── [id]/
│           │       └── page.tsx
│           ├── adjustments/
│           │   ├── page.tsx
│           │   ├── new/
│           │   │   └── page.tsx
│           │   └── [id]/
│           │       └── page.tsx
│           ├── physical-count/
│           │   ├── page.tsx
│           │   ├── new/
│           │   │   └── page.tsx
│           │   └── [id]/
│           │       └── page.tsx                    # Count sheet (mobile-ready)
│           ├── bom/
│           │   ├── page.tsx
│           │   └── [id]/
│           │       └── page.tsx
│           ├── production/
│           │   ├── page.tsx
│           │   └── [id]/
│           │       └── page.tsx
│           ├── lots/
│           │   └── page.tsx                        # Lot/batch tracking
│           ├── serials/
│           │   └── page.tsx                        # Serial number lookup
│           ├── price-lists/
│           │   ├── page.tsx
│           │   └── [id]/
│           │       └── page.tsx
│           └── reports/
│               ├── page.tsx
│               ├── stock-valuation/
│               │   └── page.tsx
│               ├── movement-history/
│               │   └── page.tsx
│               ├── reorder-report/
│               │   └── page.tsx
│               ├── expiry-report/
│               │   └── page.tsx
│               ├── lot-traceability/
│               │   └── page.tsx
│               ├── abc-analysis/
│               │   └── page.tsx
│               └── slow-moving/
│                   └── page.tsx

packages/
├── database/
│   └── prisma/
│       └── schema.prisma                           # Inv models added here
├── api/
│   └── src/
│       └── routers/
│           └── inventory/
│               ├── index.ts                        # mergeRouters
│               ├── products.router.ts
│               ├── variants.router.ts
│               ├── categories.router.ts
│               ├── warehouses.router.ts
│               ├── stock.router.ts
│               ├── movements.router.ts
│               ├── transfers.router.ts
│               ├── adjustments.router.ts
│               ├── physicalCount.router.ts
│               ├── bom.router.ts
│               ├── production.router.ts
│               ├── lots.router.ts
│               ├── serials.router.ts
│               ├── priceLists.router.ts
│               └── reports.router.ts
└── inventory-engine/
    └── src/
        ├── stock-movement.ts                       # Core movement posting engine
        ├── fifo-costing.ts                         # FIFO cost calculation
        ├── reorder-calculator.ts
        ├── demand-forecast.ts
        ├── barcode-generator.ts
        ├── bom-explosion.ts
        ├── physical-count-reconciliation.ts
        └── number-sequences.ts

apps/workers/
└── src/
    └── inventory/
        ├── reorder-alert.worker.ts
        ├── expiry-alert.worker.ts
        ├── barcode-print.worker.ts
        └── stock-sync.worker.ts
```

---

## 4. tRPC Routers & Procedures

### 4.1 inventory.products

```typescript
// packages/api/src/routers/inventory/products.router.ts
import { z } from "zod";
import { router, protectedProcedure } from "../../trpc";

export const productsRouter = router({
  list: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      category_id: z.string().optional(),
      is_active: z.boolean().optional(),
      low_stock: z.boolean().optional(),
      page: z.number().default(1),
      per_page: z.number().max(200).default(50),
    }))
    .query(async ({ ctx, input }) => {
      const where = {
        org_id: ctx.session.org_id,
        deleted_at: null,
        ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
        ...(input.category_id ? { category_id: input.category_id } : {}),
        ...(input.search ? {
          OR: [
            { name: { contains: input.search, mode: "insensitive" as const } },
            { sku: { contains: input.search, mode: "insensitive" as const } },
            { barcode: { contains: input.search } },
          ],
        } : {}),
      };

      const [items, total] = await Promise.all([
        ctx.db.invProduct.findMany({
          where,
          include: {
            category: { select: { name: true } },
            stock_levels: { select: { quantity_on_hand: true, warehouse_id: true } },
          },
          skip: (input.page - 1) * input.per_page,
          take: input.per_page,
          orderBy: { name: "asc" },
        }),
        ctx.db.invProduct.count({ where }),
      ]);

      return { items, total, page: input.page, per_page: input.per_page };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.invProduct.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          variants: true,
          category: true,
          stock_levels: { include: { warehouse: true, location: true } },
          supplier_prices: true,
        },
      });
    }),

  create: protectedProcedure
    .input(ProductCreateSchema)
    .mutation(async ({ ctx, input }) => {
      // Validate SKU uniqueness
      const exists = await ctx.db.invProduct.findUnique({
        where: { org_id_sku: { org_id: ctx.session.org_id, sku: input.sku } },
      });
      if (exists) throw new TRPCError({ code: "CONFLICT", message: "SKU already exists" });

      return ctx.db.invProduct.create({
        data: { ...input, org_id: ctx.session.org_id },
      });
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string() }).extend(ProductUpdateSchema.shape))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.invProduct.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check no open transactions
      const openMovements = await ctx.db.invStockMovement.count({
        where: { product_id: input.id, movement_date: { gte: new Date() } },
      });
      if (openMovements > 0) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Product has recent stock movements" });
      return ctx.db.invProduct.update({
        where: { id: input.id },
        data: { deleted_at: new Date(), is_active: false },
      });
    }),

  importCSV: protectedProcedure
    .input(z.object({ file_url: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Dispatch to BullMQ import queue
      await productImportQueue.add("import", { org_id: ctx.session.org_id, file_url: input.file_url });
      return { queued: true };
    }),

  exportCSV: protectedProcedure
    .query(async ({ ctx }) => {
      const products = await ctx.db.invProduct.findMany({
        where: { org_id: ctx.session.org_id, deleted_at: null },
      });
      // Return CSV string via Papa.unparse
      return generateProductCSV(products);
    }),

  generateBarcode: protectedProcedure
    .input(z.object({ product_id: z.string(), type: z.enum(["ean13","code128","qr"]) }))
    .mutation(async ({ ctx, input }) => {
      const product = await ctx.db.invProduct.findUniqueOrThrow({ where: { id: input.product_id } });
      const barcodeUrl = await generateAndUploadBarcode(product.sku, input.type);
      await ctx.db.invProduct.update({
        where: { id: input.product_id },
        data: { barcode: product.sku, barcode_type: input.type },
      });
      return { barcode_url: barcodeUrl };
    }),
});
```

### 4.2 inventory.stock

```typescript
// Procedures:
// - getStockLevels(product_id?, warehouse_id?, low_stock_only?)
// - getStockSummary(warehouse_id) — total SKUs, total value, low stock count
// - reserveStock(product_id, warehouse_id, quantity, reference_id) — for sales orders
// - releaseReservation(product_id, warehouse_id, quantity, reference_id)
// - getAvailableQuantity(product_id, variant_id?, warehouse_id?)
// - transferBetweenLocations(from_location_id, to_location_id, product_id, quantity)
```

### 4.3 inventory.movements

```typescript
// Procedures:
// - list(filters: product_id, warehouse_id, movement_type, from_date, to_date, page)
// - getByReference(reference_type, reference_id)
// - createManualMovement(type, product_id, warehouse_id, quantity, unit_cost, notes)
```

### 4.4 inventory.transfers

```typescript
// Procedures:
// - list, getById
// - create(draft)
// - ship(id, lines: [{line_id, quantity_shipped}])   → creates transfer_out movements
// - receive(id, lines: [{line_id, quantity_received}]) → creates transfer_in movements
// - cancel(id)
```

### 4.5 inventory.adjustments

```typescript
// Procedures:
// - list, getById
// - create(draft with lines)
// - post(id) → validates, creates movements, posts accounting JE, marks posted
// - void(id) — only draft adjustments
```

### 4.6 inventory.physicalCount

```typescript
// Procedures:
// - create(warehouse_id, scope, scheduled_date) → generates count lines from current stock
// - start(id) → freezes system_quantity snapshot
// - submitCounts(id, lines: [{line_id, counted_quantity}])
// - getVarianceReport(id) → lines where variance != 0
// - reconcile(id) → creates StockAdjustment for all variances
// - post(id) → posts the adjustment
```

### 4.7 inventory.bom

```typescript
// Procedures:
// - list(product_id?), getById, create, update, delete
// - explode(bom_id, quantity) → returns flat list of components with quantities
// - checkComponentAvailability(bom_id, quantity, warehouse_id) → shortage list
// - calculateProductionCost(bom_id, quantity) → material cost + overhead
```

### 4.8 inventory.production

```typescript
// Procedures:
// - list(filters: status, product_id), getById
// - create(bom_id, quantity, warehouse_id, scheduled_start)
// - confirm(id) → reserves component stock
// - start(id) → sets actual_start
// - complete(id, actual_quantity?) → consumes components (production_input movements) + produces output (production_output movement)
// - cancel(id) → releases reservations
```

### 4.9 inventory.reports

```typescript
// Procedures:
// - stockValuation(warehouse_id?, as_of_date?)  → value by product/category
// - movementHistory(product_id, from_date, to_date)
// - reorderReport() → products below reorder_point
// - expiryReport(days_ahead: 30|60|90)
// - abcAnalysis(from_date, to_date) → A/B/C classification by usage value
// - slowMoving(days_no_movement: 30|60|90)
// - lotTraceability(lot_id | lot_number) → full movement history for a lot
// - demandForecast(product_id, months_ahead: 3|6|12)
```

---

## 5. Pages & Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/inventory` | `InventoryDashboard` | KPIs: total SKUs, total stock value, low stock alerts, pending transfers |
| `/inventory/products` | `ProductsPage` | Product list with search, category filter, stock status badges |
| `/inventory/products/new` | `ProductForm` | Full product creation: basic info, pricing, inventory settings, accounting links |
| `/inventory/products/[id]` | `ProductDetailPage` | Product overview: details, stock by warehouse, movement history, variants |
| `/inventory/products/[id]/edit` | `ProductEditForm` | Edit product |
| `/inventory/products/[id]/variants` | `VariantsPage` | Variant matrix editor (color/size grid) |
| `/inventory/products/[id]/stock` | `ProductStockPage` | Stock levels across all warehouses with map |
| `/inventory/categories` | `CategoriesPage` | Category hierarchy tree; drag-to-reorder |
| `/inventory/warehouses` | `WarehousesPage` | Warehouse cards with stock summary |
| `/inventory/warehouses/[id]` | `WarehouseDetailPage` | Warehouse overview: zones, stock snapshot, utilization |
| `/inventory/warehouses/[id]/locations` | `LocationsPage` | Location tree with capacity indicators |
| `/inventory/stock` | `StockOverviewPage` | Multi-warehouse stock matrix; export to CSV |
| `/inventory/stock/movements` | `MovementsPage` | Paginated movement ledger with all filters |
| `/inventory/transfers` | `TransfersPage` | Transfer list with status kanban |
| `/inventory/transfers/new` | `TransferForm` | Create inter-warehouse transfer |
| `/inventory/transfers/[id]` | `TransferDetailPage` | Ship / Receive workflow with quantity entry |
| `/inventory/adjustments` | `AdjustmentsPage` | Adjustment list |
| `/inventory/adjustments/new` | `AdjustmentForm` | Create adjustment with reason + lines |
| `/inventory/adjustments/[id]` | `AdjustmentDetailPage` | Review + post |
| `/inventory/physical-count` | `PhysicalCountPage` | Count list |
| `/inventory/physical-count/new` | `CountSetupPage` | Define scope + schedule |
| `/inventory/physical-count/[id]` | `CountSheetPage` | Mobile-friendly count entry UI (camera barcode scan) |
| `/inventory/bom` | `BOMPage` | BOM list |
| `/inventory/bom/[id]` | `BOMDetailPage` | BOM editor with component availability check |
| `/inventory/production` | `ProductionPage` | Production order list |
| `/inventory/production/[id]` | `ProductionDetailPage` | Progress: Confirm > Start > Complete workflow |
| `/inventory/lots` | `LotsPage` | Lot/batch list with expiry calendar |
| `/inventory/serials` | `SerialNumbersPage` | Serial lookup by number/product/status |
| `/inventory/price-lists` | `PriceListsPage` | Price list management |
| `/inventory/reports` | `InventoryReportsHub` | Report picker |
| `/inventory/reports/stock-valuation` | `StockValuationReport` | Value by product/category/warehouse |
| `/inventory/reports/reorder-report` | `ReorderReport` | Products below reorder point with PO suggestion |
| `/inventory/reports/expiry-report` | `ExpiryReport` | Expiring lots with batch actions |
| `/inventory/reports/abc-analysis` | `ABCAnalysisReport` | Pareto chart + classification table |
| `/inventory/reports/slow-moving` | `SlowMovingReport` | Products with no movement in N days |
| `/inventory/reports/lot-traceability` | `LotTraceabilityReport` | Full chain for a lot: supplier → warehouse → customer |

---

## 6. Business Logic

### 6.1 FIFO Costing Algorithm

```typescript
// packages/inventory-engine/src/fifo-costing.ts
// FIFO: when stock is consumed (sale/transfer/production), cost is taken
// from the oldest available lot/purchase in the FIFO queue.

import { PrismaClient } from "@zenflow/database";
import Decimal from "decimal.js";

interface FIFOLayer {
  lot_id?: string;
  quantity: Decimal;
  unit_cost: Decimal;
  movement_id: string;
  movement_date: Date;
}

export async function getFIFOLayers(
  db: PrismaClient,
  productId: string,
  variantId: string | null,
  warehouseId: string
): Promise<FIFOLayer[]> {
  // Get all purchase_receipt and adjustment_in movements in chronological order
  // that still have remaining quantity (not yet consumed)
  const inbound = await db.invStockMovement.findMany({
    where: {
      product_id: productId,
      variant_id: variantId ?? undefined,
      warehouse_id: warehouseId,
      movement_type: { in: ["purchase_receipt", "adjustment_in", "return_in", "production_output", "opening_balance"] },
    },
    orderBy: { movement_date: "asc" },
  });

  const outbound = await db.invStockMovement.findMany({
    where: {
      product_id: productId,
      variant_id: variantId ?? undefined,
      warehouse_id: warehouseId,
      movement_type: { in: ["sale_delivery", "adjustment_out", "transfer_out", "production_input", "return_out", "scrapped"] },
    },
    orderBy: { movement_date: "asc" },
  });

  // Build FIFO queue
  const layers: FIFOLayer[] = inbound.map((m) => ({
    lot_id: m.lot_id ?? undefined,
    quantity: new Decimal(m.quantity),
    unit_cost: new Decimal(m.unit_cost),
    movement_id: m.id,
    movement_date: m.movement_date,
  }));

  let layerIdx = 0;
  for (const out of outbound) {
    let remaining = new Decimal(out.quantity);
    while (remaining.gt(0) && layerIdx < layers.length) {
      const layer = layers[layerIdx];
      if (layer.quantity.lte(remaining)) {
        remaining = remaining.minus(layer.quantity);
        layer.quantity = new Decimal(0);
        layerIdx++;
      } else {
        layer.quantity = layer.quantity.minus(remaining);
        remaining = new Decimal(0);
      }
    }
  }

  return layers.filter((l) => l.quantity.gt(0));
}

export async function computeFIFOCostForSale(
  db: PrismaClient,
  productId: string,
  variantId: string | null,
  warehouseId: string,
  quantityToSell: Decimal
): Promise<{ totalCost: Decimal; layers: Array<{ lot_id?: string; quantity: Decimal; unit_cost: Decimal }> }> {
  const availableLayers = await getFIFOLayers(db, productId, variantId, warehouseId);

  let remaining = quantityToSell;
  let totalCost = new Decimal(0);
  const consumedLayers = [];

  for (const layer of availableLayers) {
    if (remaining.lte(0)) break;
    const consume = Decimal.min(layer.quantity, remaining);
    totalCost = totalCost.plus(consume.mul(layer.unit_cost));
    consumedLayers.push({ lot_id: layer.lot_id, quantity: consume, unit_cost: layer.unit_cost });
    remaining = remaining.minus(consume);
  }

  if (remaining.gt(0)) {
    throw new Error(`Insufficient FIFO layers: short by ${remaining}`);
  }

  return { totalCost, layers: consumedLayers };
}
```

### 6.2 Core Stock Movement Posting Engine

```typescript
// packages/inventory-engine/src/stock-movement.ts

export async function postStockMovement(
  db: PrismaClient,
  input: {
    org_id: string;
    movement_type: InvMovementType;
    reference_type?: string;
    reference_id?: string;
    product_id: string;
    variant_id?: string;
    warehouse_id: string;
    from_location_id?: string;
    to_location_id?: string;
    lot_id?: string;
    serial_number?: string;
    quantity: number;   // always positive; direction determined by movement_type
    unit_cost: number;
    created_by?: string;
    notes?: string;
  }
): Promise<void> {
  const isOutbound = [
    "sale_delivery", "transfer_out", "adjustment_out",
    "production_input", "return_out", "scrapped",
  ].includes(input.movement_type);

  const signedQuantity = isOutbound ? -Math.abs(input.quantity) : Math.abs(input.quantity);

  await db.$transaction(async (tx) => {
    // 1. Check warehouse allows negative stock
    const warehouse = await tx.invWarehouse.findUniqueOrThrow({ where: { id: input.warehouse_id } });

    // 2. Get current stock level
    const existing = await tx.invStockLevel.findUnique({
      where: {
        product_id_variant_id_warehouse_id_location_id: {
          product_id: input.product_id,
          variant_id: input.variant_id ?? null,
          warehouse_id: input.warehouse_id,
          location_id: input.to_location_id ?? input.from_location_id ?? null,
        },
      },
    });

    const currentQty = new Decimal(existing?.quantity_on_hand ?? 0);
    const newQty = currentQty.plus(signedQuantity);

    if (newQty.lt(0) && !warehouse.allow_negative_stock) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Insufficient stock. Available: ${currentQty}, Requested: ${Math.abs(input.quantity)}` });
    }

    // 3. Update average cost (weighted average for inbound)
    let newAvgCost = new Decimal(existing?.average_cost ?? input.unit_cost);
    if (!isOutbound && input.unit_cost > 0) {
      const prevTotal = currentQty.mul(newAvgCost);
      const addedTotal = new Decimal(input.quantity).mul(input.unit_cost);
      const newTotal = new Decimal(Math.max(newQty.toNumber(), 0));
      newAvgCost = newTotal.gt(0) ? prevTotal.plus(addedTotal).div(newTotal) : new Decimal(input.unit_cost);
    }

    // 4. Upsert InvStockLevel
    await tx.invStockLevel.upsert({
      where: {
        product_id_variant_id_warehouse_id_location_id: {
          product_id: input.product_id,
          variant_id: input.variant_id ?? null,
          warehouse_id: input.warehouse_id,
          location_id: input.to_location_id ?? input.from_location_id ?? null,
        },
      },
      create: {
        org_id: input.org_id,
        product_id: input.product_id,
        variant_id: input.variant_id ?? null,
        warehouse_id: input.warehouse_id,
        location_id: input.to_location_id ?? input.from_location_id ?? null,
        quantity_on_hand: signedQuantity,
        average_cost: input.unit_cost,
        total_value: Math.abs(signedQuantity) * input.unit_cost,
        last_movement_at: new Date(),
      },
      update: {
        quantity_on_hand: { increment: signedQuantity },
        average_cost: newAvgCost.toNumber(),
        total_value: newQty.toNumber() * newAvgCost.toNumber(),
        last_movement_at: new Date(),
      },
    });

    // 5. Create movement record
    await tx.invStockMovement.create({
      data: {
        org_id: input.org_id,
        movement_type: input.movement_type,
        reference_type: input.reference_type,
        reference_id: input.reference_id,
        product_id: input.product_id,
        variant_id: input.variant_id,
        warehouse_id: input.warehouse_id,
        from_location_id: input.from_location_id,
        to_location_id: input.to_location_id,
        lot_id: input.lot_id,
        serial_number: input.serial_number,
        quantity: Math.abs(input.quantity),
        unit_cost: input.unit_cost,
        total_cost: Math.abs(input.quantity) * input.unit_cost,
        running_stock: newQty.toNumber(),
        created_by: input.created_by,
        notes: input.notes,
      },
    });

    // 6. Update serial number status if tracked
    if (input.serial_number) {
      await tx.invSerialNumber.updateMany({
        where: { product_id: input.product_id, serial_number: input.serial_number },
        data: {
          status: isOutbound ? "sold" : "available",
          warehouse_id: isOutbound ? null : input.warehouse_id,
          location_id: isOutbound ? null : input.to_location_id,
        },
      });
    }
  });
}
```

### 6.3 Reorder Point Calculation

```typescript
// packages/inventory-engine/src/reorder-calculator.ts

export interface ReorderRecommendation {
  product_id: string;
  sku: string;
  name: string;
  current_stock: number;
  reorder_point: number;
  reorder_quantity: number;
  preferred_vendor_id?: string;
  lead_time_days: number;
  recommended_order_qty: number;
}

export async function calculateReorderRecommendations(
  db: PrismaClient,
  orgId: string
): Promise<ReorderRecommendation[]> {
  const products = await db.invProduct.findMany({
    where: {
      org_id: orgId,
      track_inventory: true,
      is_active: true,
      reorder_point: { not: null },
    },
    include: {
      stock_levels: { where: { warehouse_id: { not: undefined } } },
      supplier_prices: { where: { is_preferred: true }, take: 1 },
    },
  });

  const recommendations: ReorderRecommendation[] = [];

  for (const product of products) {
    const totalOnHand = product.stock_levels.reduce(
      (sum, sl) => sum + Number(sl.quantity_on_hand),
      0
    );
    const totalOnOrder = product.stock_levels.reduce(
      (sum, sl) => sum + Number(sl.quantity_on_order),
      0
    );
    const available = totalOnHand + totalOnOrder;

    if (product.reorder_point && available <= Number(product.reorder_point)) {
      const preferredSupplier = product.supplier_prices[0];
      recommendations.push({
        product_id: product.id,
        sku: product.sku,
        name: product.name,
        current_stock: totalOnHand,
        reorder_point: Number(product.reorder_point),
        reorder_quantity: Number(product.reorder_quantity ?? product.reorder_point),
        preferred_vendor_id: product.preferred_vendor_id ?? undefined,
        lead_time_days: preferredSupplier?.lead_time_days ?? 7,
        recommended_order_qty: calculateEOQ(product),
      });
    }
  }

  return recommendations;
}

function calculateEOQ(product: any): number {
  // Economic Order Quantity: EOQ = sqrt(2DS/H)
  // D = annual demand (estimated from reorder_quantity * 12)
  // S = ordering cost (assumed constant $50)
  // H = holding cost (assumed 20% of purchase_price per year)
  const D = Number(product.reorder_quantity ?? 100) * 12;
  const S = 50;
  const H = Number(product.purchase_price ?? 100) * 0.2;
  if (H === 0) return Number(product.reorder_quantity ?? 100);
  return Math.round(Math.sqrt((2 * D * S) / H));
}
```

### 6.4 Demand Forecasting (Moving Average)

```typescript
// packages/inventory-engine/src/demand-forecast.ts

export async function forecastDemand(
  db: PrismaClient,
  productId: string,
  warehouseId: string,
  monthsAhead: number = 3
): Promise<{ month: string; forecasted_demand: number }[]> {
  // Get last 12 months of outbound movements
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const movements = await db.invStockMovement.findMany({
    where: {
      product_id: productId,
      warehouse_id: warehouseId,
      movement_type: { in: ["sale_delivery", "transfer_out"] },
      movement_date: { gte: twelveMonthsAgo },
    },
    select: { quantity: true, movement_date: true },
    orderBy: { movement_date: "asc" },
  });

  // Aggregate by month
  const monthlyDemand: Record<string, number> = {};
  for (const mov of movements) {
    const key = `${mov.movement_date.getFullYear()}-${String(mov.movement_date.getMonth() + 1).padStart(2, "0")}`;
    monthlyDemand[key] = (monthlyDemand[key] ?? 0) + Number(mov.quantity);
  }

  const sortedMonths = Object.keys(monthlyDemand).sort();
  const values = sortedMonths.map((m) => monthlyDemand[m]);

  // 3-month weighted moving average: weights [0.2, 0.3, 0.5]
  const weights = [0.2, 0.3, 0.5];
  const forecasts: { month: string; forecasted_demand: number }[] = [];
  const recentValues = values.slice(-3);

  for (let i = 0; i < monthsAhead; i++) {
    const window = recentValues.slice(-3);
    let forecast = 0;
    for (let j = 0; j < window.length; j++) {
      forecast += (window[j] ?? 0) * weights[j + (3 - window.length)];
    }
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + i + 1);
    const key = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, "0")}`;
    forecasts.push({ month: key, forecasted_demand: Math.round(forecast) });
    recentValues.push(Math.round(forecast));
  }

  return forecasts;
}
```

### 6.5 Barcode Generation & Upload

```typescript
// packages/inventory-engine/src/barcode-generator.ts

import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { createCanvas } from "canvas";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export async function generateAndUploadBarcode(
  sku: string,
  type: "ean13" | "code128" | "qr",
  orgId: string
): Promise<string> {
  const canvas = createCanvas(300, 150);

  if (type === "qr") {
    await QRCode.toCanvas(canvas, sku, { width: 200 });
  } else {
    JsBarcode(canvas, sku, {
      format: type === "ean13" ? "EAN13" : "CODE128",
      width: 2,
      height: 80,
      displayValue: true,
    });
  }

  const buffer = canvas.toBuffer("image/png");
  const key = `barcodes/${orgId}/${sku}-${type}.png`;

  const s3 = new S3Client({
    endpoint: process.env.MINIO_ENDPOINT,
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY!,
      secretAccessKey: process.env.MINIO_SECRET_KEY!,
    },
    forcePathStyle: true,
  });

  await s3.send(new PutObjectCommand({
    Bucket: process.env.MINIO_BUCKET_INVENTORY!,
    Key: key,
    Body: buffer,
    ContentType: "image/png",
  }));

  return `${process.env.MINIO_PUBLIC_URL}/${process.env.MINIO_BUCKET_INVENTORY}/${key}`;
}
```

### 6.6 BOM Explosion for Production

```typescript
// packages/inventory-engine/src/bom-explosion.ts

export interface ExplodedComponent {
  product_id: string;
  product_name: string;
  sku: string;
  variant_id: string | null;
  required_quantity: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  available_quantity: number;
  shortage: number;
}

export async function explodeBOM(
  db: PrismaClient,
  bomId: string,
  productionQuantity: number,
  warehouseId: string
): Promise<ExplodedComponent[]> {
  const bom = await db.invBOM.findUniqueOrThrow({
    where: { id: bomId },
    include: {
      lines: {
        include: {
          component_product: true,
          component_variant: true,
        },
        orderBy: { position: "asc" },
      },
    },
  });

  const scaleFactor = productionQuantity / Number(bom.quantity);
  const components: ExplodedComponent[] = [];

  for (const line of bom.lines) {
    const baseQty = new Decimal(line.quantity);
    const scrapFactor = 1 + Number(line.scrap_percent) / 100;
    const requiredQty = baseQty.mul(scaleFactor).mul(scrapFactor).toNumber();

    const stockLevel = await db.invStockLevel.findFirst({
      where: {
        product_id: line.component_product_id,
        variant_id: line.component_variant_id ?? null,
        warehouse_id: warehouseId,
      },
    });

    const available = Number(stockLevel?.quantity_on_hand ?? 0);
    const shortage = Math.max(0, requiredQty - available);

    components.push({
      product_id: line.component_product_id,
      product_name: line.component_product.name,
      sku: line.component_product.sku,
      variant_id: line.component_variant_id,
      required_quantity: requiredQty,
      unit: line.unit ?? line.component_product.unit_of_measure,
      unit_cost: Number(stockLevel?.average_cost ?? line.component_product.purchase_price ?? 0),
      total_cost: requiredQty * Number(stockLevel?.average_cost ?? line.component_product.purchase_price ?? 0),
      available_quantity: available,
      shortage,
    });
  }

  return components;
}
```

### 6.7 Physical Count Reconciliation

```typescript
// packages/inventory-engine/src/physical-count-reconciliation.ts

export async function reconcilePhysicalCount(
  db: PrismaClient,
  countId: string,
  postedBy: string
): Promise<{ adjustment_id: string; variance_count: number; total_value_change: number }> {
  const count = await db.invPhysicalCount.findUniqueOrThrow({
    where: { id: countId },
    include: {
      lines: {
        where: { counted_quantity: { not: null } },
        include: { product: true },
      },
    },
  });

  if (count.status !== "reconciled") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Count must be in reconciled status" });
  }

  // Filter lines with variance
  const varianceLines = count.lines.filter(
    (l) => l.counted_quantity !== null && Number(l.counted_quantity) !== Number(l.system_quantity)
  );

  if (varianceLines.length === 0) {
    return { adjustment_id: "", variance_count: 0, total_value_change: 0 };
  }

  const adjNumber = await generateAdjustmentNumber(db, count.org_id);
  let totalValueChange = 0;

  const adjustment = await db.invStockAdjustment.create({
    data: {
      org_id: count.org_id,
      adjustment_number: adjNumber,
      warehouse_id: count.warehouse_id,
      adjustment_date: new Date(),
      reason: "audit",
      notes: `Physical count reconciliation: ${count.count_number}`,
      status: "draft",
      created_by: postedBy,
      lines: {
        create: varianceLines.map((line) => {
          const qtyBefore = Number(line.system_quantity);
          const qtyAfter = Number(line.counted_quantity);
          const qtyChange = qtyAfter - qtyBefore;
          const unitCost = Number(line.unit_cost);
          const valueChange = qtyChange * unitCost;
          totalValueChange += valueChange;

          return {
            product_id: line.product_id,
            variant_id: line.variant_id ?? null,
            location_id: line.location_id ?? null,
            lot_id: line.lot_id ?? null,
            quantity_before: qtyBefore,
            quantity_after: qtyAfter,
            quantity_change: qtyChange,
            unit_cost: unitCost,
            value_change: valueChange,
            reason_note: `Count variance: system=${qtyBefore}, counted=${qtyAfter}`,
          };
        }),
      },
    },
  });

  // Post the adjustment
  for (const line of varianceLines) {
    const qtyChange = Number(line.counted_quantity) - Number(line.system_quantity);
    await postStockMovement(db, {
      org_id: count.org_id,
      movement_type: qtyChange > 0 ? "adjustment_in" : "adjustment_out",
      reference_type: "physical_count",
      reference_id: countId,
      product_id: line.product_id,
      variant_id: line.variant_id ?? undefined,
      warehouse_id: count.warehouse_id,
      to_location_id: line.location_id ?? undefined,
      quantity: Math.abs(qtyChange),
      unit_cost: Number(line.unit_cost),
      created_by: postedBy,
    });
  }

  await db.invStockAdjustment.update({
    where: { id: adjustment.id },
    data: { status: "posted", posted_at: new Date(), posted_by: postedBy, total_value_change: totalValueChange },
  });

  await db.invPhysicalCount.update({
    where: { id: countId },
    data: { status: "posted", completed_at: new Date() },
  });

  return { adjustment_id: adjustment.id, variance_count: varianceLines.length, total_value_change: totalValueChange };
}
```

### 6.8 ABC Analysis

```typescript
// packages/inventory-engine/src/abc-analysis.ts
// A items: top 70% of total usage value
// B items: next 20% (cumulative 70-90%)
// C items: bottom 10% (cumulative 90-100%)

export async function computeABCAnalysis(
  db: PrismaClient,
  orgId: string,
  fromDate: Date,
  toDate: Date
): Promise<Array<{ product_id: string; sku: string; name: string; usage_value: number; classification: "A" | "B" | "C" }>> {
  const movements = await db.invStockMovement.groupBy({
    by: ["product_id"],
    where: {
      org_id: orgId,
      movement_type: "sale_delivery",
      movement_date: { gte: fromDate, lte: toDate },
    },
    _sum: { total_cost: true },
    orderBy: { _sum: { total_cost: "desc" } },
  });

  const totalUsageValue = movements.reduce((s, m) => s + Number(m._sum.total_cost ?? 0), 0);
  let cumulative = 0;

  const products = await db.invProduct.findMany({
    where: { id: { in: movements.map((m) => m.product_id) } },
    select: { id: true, sku: true, name: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  return movements.map((m) => {
    const usageValue = Number(m._sum.total_cost ?? 0);
    cumulative += usageValue;
    const cumulativePct = totalUsageValue > 0 ? (cumulative / totalUsageValue) * 100 : 0;
    const product = productMap.get(m.product_id);

    return {
      product_id: m.product_id,
      sku: product?.sku ?? "",
      name: product?.name ?? "",
      usage_value: usageValue,
      classification: cumulativePct <= 70 ? "A" : cumulativePct <= 90 ? "B" : "C",
    };
  });
}
```

---

## 7. Background Jobs (BullMQ)

```typescript
// apps/workers/src/inventory/reorder-alert.worker.ts
// Queue: "inventory:reorder" — runs daily at 07:00
// 1. Call calculateReorderRecommendations()
// 2. For each recommendation: create in-app notification + email alert to org admin
// 3. Optional: auto-create draft Purchase Order if configured

// apps/workers/src/inventory/expiry-alert.worker.ts
// Queue: "inventory:expiry" — runs daily at 06:00
// 1. Find InvLot where expiry_date is within 7, 14, 30 days
// 2. Send alert emails to warehouse manager
// 3. Flag lots in the UI (status visual)

// apps/workers/src/inventory/barcode-print.worker.ts
// Queue: "inventory:barcode-print"
// 1. Accepts: [{product_id, quantity, template}]
// 2. Generates barcode images via canvas
// 3. Layouts into A4 printable PDF (4x10 grid = 40 labels per page)
// 4. Uploads to MinIO, returns signed URL

// apps/workers/src/inventory/stock-sync.worker.ts
// Queue: "inventory:stock-sync"
// Triggered after each order/purchase/transfer completion:
// 1. Recalculate quantity_on_order for affected products
// 2. Refresh cached total_value on InvStockLevel
// 3. Update quantity_available = on_hand - reserved
```

---

## 8. npm Packages

```json
{
  "dependencies": {
    "decimal.js": "^10.4.3",
    "date-fns": "^3.6.0",
    "fuse.js": "^7.0.0",
    "@aws-sdk/client-s3": "^3.600.0",
    "bullmq": "^5.12.0",
    "ioredis": "^5.4.1",
    "canvas": "^2.11.2",
    "jsbarcode": "^3.11.6",
    "qrcode": "^1.5.4",
    "papaparse": "^5.4.1",
    "sharp": "^0.33.4",
    "pdfmake": "^0.2.10",
    "puppeteer": "^22.12.0",
    "zxing-wasm": "^1.3.0",
    "react-barcode": "^1.5.3",
    "react-qr-code": "^2.0.15",
    "@tanstack/react-table": "^8.19.2",
    "recharts": "^2.12.7",
    "react-hook-form": "^7.52.0",
    "@hookform/resolvers": "^3.9.0",
    "zod": "^3.23.8",
    "xlsx": "^0.18.5",
    "@trpc/server": "^11.0.0",
    "@trpc/client": "^11.0.0"
  },
  "devDependencies": {
    "@types/papaparse": "^5.3.14",
    "@types/qrcode": "^1.5.5",
    "@types/canvas": "^2.11.1"
  }
}
```

---

## 9. Environment Variables

```env
# Inventory
INVENTORY_DEFAULT_CURRENCY=INR
INVENTORY_ALLOW_NEGATIVE_STOCK_GLOBAL=false
INVENTORY_REORDER_ALERT_EMAIL=warehouse@yourorg.com
INVENTORY_FIFO_ENABLED=true

# MinIO buckets
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_PUBLIC_URL=http://localhost:9000
MINIO_BUCKET_INVENTORY=zenflow-inventory
MINIO_BUCKET_BARCODES=zenflow-barcodes

# BullMQ
REDIS_URL=redis://localhost:6379

# Email
RESEND_API_KEY=

# Number sequences
TRANSFER_NUMBER_PREFIX=TRF
ADJUSTMENT_NUMBER_PREFIX=ADJ
COUNT_NUMBER_PREFIX=CNT
PRODUCTION_ORDER_PREFIX=PO
```

---

## 10. Implementation Roadmap

| Phase | Weeks | Scope |
|-------|-------|-------|
| Phase 1 | 1–2 | Prisma schema migration, seed data (default warehouse, categories), number sequences |
| Phase 2 | 3–4 | Product CRUD: create/edit/list/delete, category tree, CSV import/export |
| Phase 3 | 5–6 | Variant matrix, barcode generation, price lists |
| Phase 4 | 7–8 | Warehouse + location hierarchy, stock levels UI, opening balance entry |
| Phase 5 | 9–10 | Stock movement engine (FIFO), manual adjustments, posting to accounting GL |
| Phase 6 | 11–12 | Inter-warehouse transfers (ship + receive workflow) |
| Phase 7 | 13–14 | Lot/batch tracking, serial number tracking, expiry management |
| Phase 8 | 15–16 | Physical count (full cycle: generate → count → reconcile → post) |
| Phase 9 | 17–18 | BOM editor + production orders (confirm → start → complete) |
| Phase 10 | 19–20 | Reporting suite: stock valuation, ABC analysis, reorder report, demand forecast |
| Phase 11 | 21–22 | Background jobs: reorder alerts, expiry alerts, barcode print queue |
| Phase 12 | 23–24 | Integration testing, performance tuning, bulk import, mobile count app |

### Accounting Integration Points

Every stock value change must create a GL journal entry via the Accounting v2 engine:

| Stock Event | Debit | Credit |
|-------------|-------|--------|
| Purchase receipt | Inventory Asset | Accounts Payable |
| Sale delivery | COGS | Inventory Asset |
| Adjustment (write-up) | Inventory Asset | Inventory Adjustment (expense) |
| Adjustment (write-down) | Inventory Adjustment (expense) | Inventory Asset |
| Production: consume | WIP / COGS | Inventory Asset (components) |
| Production: output | Inventory Asset (finished) | WIP / COGS |
| Scrapped | Inventory Write-off (expense) | Inventory Asset |

```typescript
// Integration call pattern — triggered from postStockMovement()
// for movements that affect inventory GL value

import { postJournalEntry } from "@zenflow/accounting-engine";

async function postInventoryGLEntry(
  db: PrismaClient,
  orgId: string,
  movementType: InvMovementType,
  productId: string,
  quantity: number,
  unitCost: number,
  referenceId: string
) {
  const product = await db.invProduct.findUnique({
    where: { id: productId },
    select: { inventory_account_id: true, cogs_account_id: true, name: true },
  });

  if (!product?.inventory_account_id) return; // skip if not GL-linked

  const totalCost = quantity * unitCost;
  const entryNumber = await generateEntryNumber(db, orgId, "JE");

  let debitAccountId: string;
  let creditAccountId: string;

  switch (movementType) {
    case "purchase_receipt":
      debitAccountId = product.inventory_account_id;
      creditAccountId = await getSystemAccountId(db, orgId, "accounts_payable");
      break;
    case "sale_delivery":
      debitAccountId = product.cogs_account_id ?? await getSystemAccountId(db, orgId, "cogs");
      creditAccountId = product.inventory_account_id;
      break;
    case "scrapped":
    case "adjustment_out":
      debitAccountId = await getSystemAccountId(db, orgId, "inventory_write_off");
      creditAccountId = product.inventory_account_id;
      break;
    default:
      return; // transfers + internal moves don't need GL entries
  }

  const je = await db.accJournalEntry.create({
    data: {
      org_id: orgId,
      entry_number: entryNumber,
      entry_date: new Date(),
      description: `Inventory: ${movementType} - ${product.name}`,
      source_type: "other",
      source_id: referenceId,
      financial_year: new Date().getFullYear(),
      financial_period: new Date().getMonth() + 1,
      lines: {
        create: [
          { account_id: debitAccountId, debit_amount: totalCost, credit_amount: 0, line_order: 0 },
          { account_id: creditAccountId, debit_amount: 0, credit_amount: totalCost, line_order: 1 },
        ],
      },
    },
  });

  await postJournalEntry(db, je.id, "system");
}
```

---

*End of Inventory v2 Implementation Document*
