# ZenFlow — Complete Master Documentation
### Zoho Competitor SaaS Platform | Full-Stack | Solo Developer Edition
**Product Name:** ZenFlow | **Version:** 1.0.0 | **Date:** 2026-05-27 | **Author:** Mohit Yadav

---

> **Tagline:** *"Everything Flows."*
> **Local Project Directory:** `C:\xampp\htdocs\Claude`
> **Brand Colors:** Indigo `#6366f1` · Violet `#8b5cf6` · Cyan `#06b6d4`
> **Domain:** zenflow.io / getzenflow.com

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Local Environment Status](#2-local-environment-status)
3. [Complete Tech Stack](#3-complete-tech-stack)
4. [System Architecture](#4-system-architecture)
5. [Project File Structure](#5-project-file-structure)
6. [Docker Services & Local Infrastructure](#6-docker-services--local-infrastructure)
7. [Complete Database Schema (98 Tables)](#7-complete-database-schema-98-tables)
   - [Module 1 — Core Platform (17 Tables)](#module-1--core-platform-17-tables)
   - [Module 2 — CRM (12 Tables)](#module-2--crm-12-tables)
   - [Module 3 — Forms Builder (4 Tables)](#module-3--forms-builder-4-tables)
   - [Module 4 — Analytics & Reports (4 Tables)](#module-4--analytics--reports-4-tables)
   - [Module 5 — Project Management (8 Tables)](#module-5--project-management-8-tables)
   - [Module 6 — HR & People (8 Tables)](#module-6--hr--people-8-tables)
   - [Module 7 — Help Desk (7 Tables)](#module-7--help-desk-7-tables)
   - [Module 8 — Workflow Automation (5 Tables)](#module-8--workflow-automation-5-tables)
   - [Module 9 — Accounting (9 Tables)](#module-9--accounting-9-tables)
   - [Module 10 — Inventory (10 Tables)](#module-10--inventory-10-tables)
   - [Module 11 — Documents (4 Tables)](#module-11--documents-4-tables)
   - [Module 12 — Team Chat (5 Tables)](#module-12--team-chat-5-tables)
   - [Module 13 — App Builder (5 Tables)](#module-13--app-builder-5-tables)
8. [Database Summary](#8-database-summary)
9. [Build Phases & Timeline](#9-build-phases--timeline)
10. [Environment Variables](#10-environment-variables)
11. [Installation Guide](#11-installation-guide)
12. [Module Descriptions](#12-module-descriptions)

---

## 1. Project Overview

### What We Are Building
A **full-featured SaaS platform** that competes directly with Zoho — covering CRM, Forms Builder, Analytics, Project Management, HR, Help Desk, Accounting, Inventory, Workflow Automation, Documents, Team Chat, and a Low-Code App Builder.

### Goals
- Multi-tenant SaaS (one platform, multiple organizations)
- Zero-cost to start (all free-tier / open-source infrastructure locally)
- Solo developer buildable with modern tooling
- Production-ready, scalable architecture
- Different UI/UX from Zoho — modern, minimal, fast

### Platform Stats
| Metric | Count |
|--------|-------|
| Total Modules | 13 |
| Total Database Tables | 98 |
| Total Columns (approx) | ~1,035 |
| Total Project Files (Full) | ~1,200+ |
| Total Project Files (Phase 1 MVP) | ~180 |
| API Procedures (tRPC) | ~200+ |
| React Components | ~300+ |
| Pages / Routes | ~60+ |
| Docker Services | 5 |
| npm Packages | ~45 |

---

## 2. Local Environment Status

| Tool | Status | Version |
|------|--------|---------|
| Node.js | READY | v20.19.0 |
| npm | READY | 10.8.2 |
| pnpm | INSTALL NEEDED | — |
| Git | READY | 2.51.0 |
| Docker | READY | 28.3.3 |
| Docker Compose | READY | v2.39.2 |
| VS Code | READY | Latest |
| PostgreSQL | VIA DOCKER | — |
| Redis | VIA DOCKER | — |
| MinIO | VIA DOCKER | — |
| RAM | SUFFICIENT | 13.31 GB |
| CPU | STRONG | AMD Ryzen 7 7735HS |
| OS | COMPATIBLE | Windows 11 Enterprise |

### Pre-requisite Commands
```bash
# Step 1: Install pnpm
npm install -g pnpm

# Step 2: Verify pnpm
pnpm --version

# Step 3: Start Docker services (run after project setup)
docker compose up -d
```

---

## 3. Complete Tech Stack

### Frontend
| Category | Technology | Version |
|----------|-----------|---------|
| Framework | Next.js (App Router + RSC) | 15.x |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 3.x |
| UI Components | Shadcn/UI (Radix UI) | Latest |
| Icons | Lucide React | Latest |
| Animations | Framer Motion | 11.x |
| Global State | Zustand | 5.x |
| Server State | TanStack Query | v5 |
| Forms | React Hook Form + Zod | Latest |
| Tables | TanStack Table | v8 |
| Charts | Recharts + Apache ECharts | Latest |
| Rich Text Editor | Tiptap | v2 |
| Drag and Drop | dnd-kit | Latest |
| Date Utilities | date-fns | v3 |
| File Upload | React Dropzone | Latest |
| WebSocket Client | Socket.io Client | v4 |

### Backend
| Category | Technology | Version |
|----------|-----------|---------|
| API Framework | Next.js API Routes + tRPC | v11 |
| Type Safety | Zod + TypeScript | Latest |
| ORM | Prisma | v6 |
| Job Queues | BullMQ | v5 |
| File Storage | MinIO (S3-compatible) | Latest |
| Email | Nodemailer + React Email | Latest |
| PDF Generation | @react-pdf/renderer | Latest |
| WebSocket Server | Socket.io Server | v4 |
| Cron Jobs | node-cron | Latest |

### Database & Cache
| Service | Technology | Version |
|---------|-----------|---------|
| Primary Database | PostgreSQL | 16 |
| Cache / Queues | Redis | 7 |
| File Storage | MinIO | Latest |
| Search | PostgreSQL FTS | Built-in |

### Authentication
| Feature | Technology |
|---------|-----------|
| Auth Library | Auth.js v5 (NextAuth) |
| OAuth | Google, Microsoft, GitHub |
| MFA / 2FA | TOTP via otplib + Backup codes |
| Session Store | PostgreSQL (Prisma adapter) |
| Password Hashing | bcrypt |
| JWT | jose library |

### Infrastructure (Local)
| Tool | Purpose |
|------|---------|
| Turborepo | Monorepo task runner |
| pnpm workspaces | Package management |
| Docker Compose | Local service orchestration |
| GitHub Actions | CI/CD pipeline |
| Prisma Studio | Visual database editor |
| Mailhog | Email catcher (dev only) |

---

## 4. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SAAS PLATFORM                            │
├─────────────────┬───────────────────┬───────────────────────────┤
│   FRONTEND      │     BACKEND       │     INFRASTRUCTURE        │
│                 │                   │                           │
│  Next.js 15     │  tRPC API Layer   │  PostgreSQL 16            │
│  React 18       │  Auth.js v5       │  Redis 7                  │
│  Tailwind CSS   │  Prisma ORM       │  MinIO (S3 Files)         │
│  Shadcn/UI      │  BullMQ Jobs      │  Docker Compose           │
│  Zustand        │  Socket.io        │  Turborepo                │
│  TanStack       │  node-cron        │  GitHub Actions           │
└─────────────────┴───────────────────┴───────────────────────────┘

Multi-Tenancy Model:
  User → belongs to → Organization(s)
  Organization → has → Members (with Roles)
  Role → has → Permissions
  All data scoped by → organization_id

Request Flow:
  Browser → Next.js App Router
         → tRPC Router (type-safe API)
         → Prisma (DB queries)
         → PostgreSQL (data)
         → Redis (cache / sessions)
         → MinIO (files)
         → BullMQ (background jobs)
```

---

## 5. Project File Structure

```
saas-platform/                          ← ROOT MONOREPO
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
│
├── apps/
│   ├── web/                            ← MAIN APPLICATION
│   │   ├── public/
│   │   └── src/
│   │       ├── app/
│   │       │   ├── (auth)/
│   │       │   │   ├── login/page.tsx
│   │       │   │   ├── register/page.tsx
│   │       │   │   ├── forgot-password/page.tsx
│   │       │   │   └── verify-email/page.tsx
│   │       │   │
│   │       │   ├── (dashboard)/
│   │       │   │   ├── layout.tsx
│   │       │   │   ├── page.tsx
│   │       │   │   ├── crm/
│   │       │   │   │   ├── page.tsx
│   │       │   │   │   ├── contacts/page.tsx
│   │       │   │   │   ├── contacts/[id]/page.tsx
│   │       │   │   │   ├── companies/page.tsx
│   │       │   │   │   ├── leads/page.tsx
│   │       │   │   │   └── deals/page.tsx
│   │       │   │   ├── forms/
│   │       │   │   │   ├── page.tsx
│   │       │   │   │   ├── [id]/builder/page.tsx
│   │       │   │   │   └── [id]/submissions/page.tsx
│   │       │   │   ├── analytics/
│   │       │   │   │   ├── page.tsx
│   │       │   │   │   ├── dashboards/[id]/page.tsx
│   │       │   │   │   └── reports/[id]/page.tsx
│   │       │   │   ├── projects/
│   │       │   │   │   ├── page.tsx
│   │       │   │   │   ├── [id]/tasks/page.tsx
│   │       │   │   │   ├── [id]/board/page.tsx
│   │       │   │   │   └── [id]/gantt/page.tsx
│   │       │   │   ├── hr/
│   │       │   │   │   ├── employees/page.tsx
│   │       │   │   │   ├── attendance/page.tsx
│   │       │   │   │   ├── leaves/page.tsx
│   │       │   │   │   └── payroll/page.tsx
│   │       │   │   ├── helpdesk/
│   │       │   │   │   ├── tickets/page.tsx
│   │       │   │   │   └── knowledge-base/page.tsx
│   │       │   │   ├── accounting/
│   │       │   │   │   ├── invoices/page.tsx
│   │       │   │   │   ├── expenses/page.tsx
│   │       │   │   │   └── reports/page.tsx
│   │       │   │   ├── inventory/
│   │       │   │   │   ├── products/page.tsx
│   │       │   │   │   ├── stock/page.tsx
│   │       │   │   │   ├── purchase-orders/page.tsx
│   │       │   │   │   └── sales-orders/page.tsx
│   │       │   │   ├── automation/page.tsx
│   │       │   │   ├── documents/page.tsx
│   │       │   │   ├── chat/[channelId]/page.tsx
│   │       │   │   ├── app-builder/page.tsx
│   │       │   │   └── settings/
│   │       │   │       ├── organization/page.tsx
│   │       │   │       ├── members/page.tsx
│   │       │   │       ├── roles/page.tsx
│   │       │   │       ├── billing/page.tsx
│   │       │   │       ├── api-keys/page.tsx
│   │       │   │       ├── webhooks/page.tsx
│   │       │   │       └── audit-logs/page.tsx
│   │       │   │
│   │       │   └── api/
│   │       │       ├── auth/[...nextauth]/route.ts
│   │       │       ├── trpc/[trpc]/route.ts
│   │       │       └── public/forms/[slug]/route.ts
│   │       │
│   │       ├── components/
│   │       │   ├── layout/
│   │       │   │   ├── sidebar.tsx
│   │       │   │   ├── header.tsx
│   │       │   │   └── command-palette.tsx
│   │       │   ├── shared/
│   │       │   │   ├── data-table.tsx
│   │       │   │   ├── page-header.tsx
│   │       │   │   ├── empty-state.tsx
│   │       │   │   ├── confirm-dialog.tsx
│   │       │   │   ├── file-uploader.tsx
│   │       │   │   └── rich-text-editor.tsx
│   │       │   ├── crm/
│   │       │   ├── forms/
│   │       │   ├── analytics/
│   │       │   ├── projects/
│   │       │   ├── hr/
│   │       │   ├── helpdesk/
│   │       │   ├── accounting/
│   │       │   ├── inventory/
│   │       │   ├── automation/
│   │       │   ├── documents/
│   │       │   ├── chat/
│   │       │   └── app-builder/
│   │       │
│   │       ├── server/
│   │       │   ├── trpc.ts
│   │       │   ├── context.ts
│   │       │   └── routers/
│   │       │       ├── _app.ts
│   │       │       ├── auth.ts
│   │       │       ├── organization.ts
│   │       │       ├── crm.ts
│   │       │       ├── forms.ts
│   │       │       ├── analytics.ts
│   │       │       ├── projects.ts
│   │       │       ├── hr.ts
│   │       │       ├── helpdesk.ts
│   │       │       ├── accounting.ts
│   │       │       ├── inventory.ts
│   │       │       ├── automation.ts
│   │       │       ├── documents.ts
│   │       │       ├── chat.ts
│   │       │       └── app-builder.ts
│   │       │
│   │       ├── hooks/
│   │       │   ├── use-auth.ts
│   │       │   ├── use-organization.ts
│   │       │   ├── use-permissions.ts
│   │       │   └── use-debounce.ts
│   │       │
│   │       ├── stores/
│   │       │   ├── auth-store.ts
│   │       │   ├── ui-store.ts
│   │       │   └── notification-store.ts
│   │       │
│   │       └── lib/
│   │           ├── auth.ts
│   │           ├── trpc.ts
│   │           └── utils.ts
│   │
│   └── landing/                        ← Marketing / Landing Page
│
├── packages/
│   ├── db/                             ← Prisma + DB Client
│   │   ├── prisma/
│   │   │   ├── schema.prisma           ← ALL 98 TABLES
│   │   │   ├── seed.ts
│   │   │   └── migrations/
│   │   └── src/index.ts
│   │
│   ├── ui/                             ← Shared Components
│   ├── auth/                           ← Auth Config
│   ├── email/                          ← Email Templates
│   ├── validators/                     ← Zod Schemas
│   └── config/                         ← Shared Configs
│
├── docker-compose.yml                  ← All 5 local services
├── .env.example
├── .env.local
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## 6. Docker Services & Local Infrastructure

### docker-compose.yml Services

| Service | Port | Purpose | Image |
|---------|------|---------|-------|
| PostgreSQL 16 | 5432 | Primary database | postgres:16-alpine |
| Redis 7 | 6379 | Cache + Job queues | redis:7-alpine |
| MinIO | 9000 | File storage (S3) | minio/minio:latest |
| MinIO Console | 9001 | File storage UI | minio/minio:latest |
| Mailhog | 8025 | Email catcher (dev) | mailhog/mailhog |

### Your App Services

| Service | Port | Purpose |
|---------|------|---------|
| Next.js Dev Server | 3000 | Main application |
| Prisma Studio | 5555 | Visual DB editor |

---

## 7. Complete Database Schema (98 Tables)

> **Convention:** All tables use UUID primary keys with `gen_random_uuid()`. All tables have `created_at TIMESTAMP DEFAULT NOW()`. Soft-deletes use `deleted_at TIMESTAMP DEFAULT NULL`.

---

### MODULE 1 — CORE PLATFORM (17 Tables)

---

#### TABLE 1: users
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| email | VARCHAR(255) | NO | — | Unique email address |
| email_verified | BOOLEAN | NO | false | Email verification status |
| email_verified_at | TIMESTAMP | YES | NULL | When email was verified |
| name | VARCHAR(255) | NO | — | Full display name |
| avatar_url | TEXT | YES | NULL | Profile picture URL |
| password_hash | TEXT | YES | NULL | bcrypt hash (null for OAuth users) |
| phone | VARCHAR(20) | YES | NULL | Phone number |
| phone_verified | BOOLEAN | NO | false | Phone verification status |
| timezone | VARCHAR(100) | NO | 'UTC' | User timezone |
| locale | VARCHAR(10) | NO | 'en' | Language/locale |
| is_active | BOOLEAN | NO | true | Account active status |
| is_superadmin | BOOLEAN | NO | false | Platform superadmin flag |
| last_login_at | TIMESTAMP | YES | NULL | Last login timestamp |
| last_login_ip | VARCHAR(45) | YES | NULL | Last login IP address |
| created_at | TIMESTAMP | NO | NOW() | Record creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |
| deleted_at | TIMESTAMP | YES | NULL | Soft delete timestamp |

---

#### TABLE 2: organizations
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| name | VARCHAR(255) | NO | — | Organization name |
| slug | VARCHAR(100) | NO | — | UNIQUE URL-friendly identifier |
| logo_url | TEXT | YES | NULL | Organization logo |
| website | VARCHAR(255) | YES | NULL | Website URL |
| industry | VARCHAR(100) | YES | NULL | Industry type |
| size | VARCHAR(50) | YES | NULL | Company size (1-10, 11-50...) |
| country | VARCHAR(100) | YES | NULL | Country |
| timezone | VARCHAR(100) | NO | 'UTC' | Organization timezone |
| currency | VARCHAR(10) | NO | 'USD' | Default currency |
| plan_id | UUID | YES | NULL | FK → plans.id |
| is_active | BOOLEAN | NO | true | Organization status |
| trial_ends_at | TIMESTAMP | YES | NULL | Trial period end date |
| created_by | UUID | NO | — | FK → users.id |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |
| deleted_at | TIMESTAMP | YES | NULL | Soft delete timestamp |

---

#### TABLE 3: organization_members
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| user_id | UUID | NO | — | FK → users.id |
| role_id | UUID | NO | — | FK → roles.id |
| is_owner | BOOLEAN | NO | false | Is organization owner |
| joined_at | TIMESTAMP | NO | NOW() | Join timestamp |
| invited_by | UUID | YES | NULL | FK → users.id |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |

*UNIQUE CONSTRAINT: (organization_id, user_id)*

---

#### TABLE 4: roles
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | YES | NULL | FK → organizations.id (NULL = system role) |
| name | VARCHAR(100) | NO | — | Role display name |
| slug | VARCHAR(100) | NO | — | Role identifier (admin, member, viewer) |
| description | TEXT | YES | NULL | Role description |
| is_system | BOOLEAN | NO | false | System-defined role |
| is_default | BOOLEAN | NO | false | Assigned to new members by default |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |

---

#### TABLE 5: permissions
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| module | VARCHAR(100) | NO | — | Module name (crm, forms, hr...) |
| action | VARCHAR(100) | NO | — | Action (create, read, update, delete, export) |
| resource | VARCHAR(100) | NO | — | Resource name (contact, deal, form...) |
| description | TEXT | YES | NULL | Permission description |
| created_at | TIMESTAMP | NO | NOW() | Creation time |

*UNIQUE CONSTRAINT: (module, action, resource)*

---

#### TABLE 6: role_permissions
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| role_id | UUID | NO | — | FK → roles.id |
| permission_id | UUID | NO | — | FK → permissions.id |
| created_at | TIMESTAMP | NO | NOW() | Creation time |

*UNIQUE CONSTRAINT: (role_id, permission_id)*

---

#### TABLE 7: sessions
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | VARCHAR(255) | NO | — | Session token (Primary key) |
| user_id | UUID | NO | — | FK → users.id |
| organization_id | UUID | YES | NULL | FK → organizations.id |
| expires_at | TIMESTAMP | NO | — | Session expiry time |
| ip_address | VARCHAR(45) | YES | NULL | Client IP address |
| user_agent | TEXT | YES | NULL | Browser user agent |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |

---

#### TABLE 8: oauth_accounts
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| user_id | UUID | NO | — | FK → users.id |
| provider | VARCHAR(50) | NO | — | Provider (google, microsoft, github) |
| provider_account_id | VARCHAR(255) | NO | — | Provider's user ID |
| access_token | TEXT | YES | NULL | OAuth access token |
| refresh_token | TEXT | YES | NULL | OAuth refresh token |
| expires_at | TIMESTAMP | YES | NULL | Token expiry |
| token_type | VARCHAR(50) | YES | NULL | Token type (Bearer) |
| scope | TEXT | YES | NULL | OAuth scopes |
| id_token | TEXT | YES | NULL | OpenID Connect token |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |

*UNIQUE CONSTRAINT: (provider, provider_account_id)*

---

#### TABLE 9: two_factor_auth
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| user_id | UUID | NO | — | FK → users.id (UNIQUE) |
| secret | TEXT | NO | — | Encrypted TOTP secret |
| backup_codes | TEXT[] | NO | '{}' | Array of backup codes (hashed) |
| is_enabled | BOOLEAN | NO | false | 2FA enabled status |
| enabled_at | TIMESTAMP | YES | NULL | When 2FA was enabled |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |

---

#### TABLE 10: api_keys
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| user_id | UUID | NO | — | FK → users.id |
| name | VARCHAR(255) | NO | — | Key display name |
| key_hash | VARCHAR(255) | NO | — | UNIQUE hashed API key |
| key_prefix | VARCHAR(10) | NO | — | First 8 chars for display |
| scopes | TEXT[] | NO | '{}' | Allowed API scopes |
| last_used_at | TIMESTAMP | YES | NULL | Last usage timestamp |
| expires_at | TIMESTAMP | YES | NULL | Expiry (NULL = never) |
| is_active | BOOLEAN | NO | true | Key active status |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |

---

#### TABLE 11: invitations
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| email | VARCHAR(255) | NO | — | Invitee email |
| role_id | UUID | NO | — | FK → roles.id |
| token | VARCHAR(255) | NO | — | UNIQUE invitation token |
| invited_by | UUID | NO | — | FK → users.id |
| accepted_at | TIMESTAMP | YES | NULL | When invitation was accepted |
| expires_at | TIMESTAMP | NO | — | Invitation expiry |
| created_at | TIMESTAMP | NO | NOW() | Creation time |

---

#### TABLE 12: password_reset_tokens
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| user_id | UUID | NO | — | FK → users.id |
| token | VARCHAR(255) | NO | — | UNIQUE reset token |
| expires_at | TIMESTAMP | NO | — | Token expiry |
| used_at | TIMESTAMP | YES | NULL | When token was used |
| created_at | TIMESTAMP | NO | NOW() | Creation time |

---

#### TABLE 13: audit_logs
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | YES | NULL | FK → organizations.id |
| user_id | UUID | YES | NULL | FK → users.id |
| action | VARCHAR(255) | NO | — | Action name (user.login, contact.created) |
| resource_type | VARCHAR(100) | YES | NULL | Resource type (contact, deal, user) |
| resource_id | UUID | YES | NULL | Resource UUID |
| old_values | JSONB | YES | NULL | Before-change values |
| new_values | JSONB | YES | NULL | After-change values |
| ip_address | VARCHAR(45) | YES | NULL | Client IP |
| user_agent | TEXT | YES | NULL | Browser info |
| metadata | JSONB | YES | NULL | Additional context |
| created_at | TIMESTAMP | NO | NOW() | Event timestamp |

---

#### TABLE 14: notifications
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| user_id | UUID | NO | — | FK → users.id |
| type | VARCHAR(100) | NO | — | Notification type |
| title | VARCHAR(500) | NO | — | Notification title |
| message | TEXT | YES | NULL | Notification body |
| data | JSONB | YES | NULL | Extra data payload |
| is_read | BOOLEAN | NO | false | Read status |
| read_at | TIMESTAMP | YES | NULL | When read |
| action_url | TEXT | YES | NULL | Click destination URL |
| created_at | TIMESTAMP | NO | NOW() | Creation time |

---

#### TABLE 15: plans
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| name | VARCHAR(100) | NO | — | Plan display name |
| slug | VARCHAR(100) | NO | — | UNIQUE plan identifier |
| description | TEXT | YES | NULL | Plan description |
| price_monthly | DECIMAL(10,2) | NO | 0.00 | Monthly price |
| price_yearly | DECIMAL(10,2) | NO | 0.00 | Yearly price |
| currency | VARCHAR(10) | NO | 'USD' | Currency code |
| max_users | INTEGER | YES | NULL | Max users (NULL = unlimited) |
| max_storage_gb | INTEGER | YES | NULL | Max storage GB |
| features | JSONB | NO | '{}' | Feature flags |
| is_active | BOOLEAN | NO | true | Plan availability |
| is_free | BOOLEAN | NO | false | Free plan flag |
| stripe_monthly_price_id | VARCHAR(255) | YES | NULL | Stripe price ID |
| stripe_yearly_price_id | VARCHAR(255) | YES | NULL | Stripe price ID |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |

---

#### TABLE 16: subscriptions
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| plan_id | UUID | NO | — | FK → plans.id |
| status | VARCHAR(50) | NO | 'active' | active, cancelled, past_due, trialing |
| billing_cycle | VARCHAR(20) | NO | 'monthly' | monthly or yearly |
| current_period_start | TIMESTAMP | NO | — | Billing period start |
| current_period_end | TIMESTAMP | NO | — | Billing period end |
| cancel_at_period_end | BOOLEAN | NO | false | Cancel at end of period |
| cancelled_at | TIMESTAMP | YES | NULL | Cancellation timestamp |
| stripe_subscription_id | VARCHAR(255) | YES | NULL | Stripe subscription ID |
| stripe_customer_id | VARCHAR(255) | YES | NULL | Stripe customer ID |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |

---

#### TABLE 17: webhook_endpoints
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| url | TEXT | NO | — | Webhook destination URL |
| description | VARCHAR(500) | YES | NULL | Description |
| events | TEXT[] | NO | '{}' | Subscribed event types |
| secret | VARCHAR(255) | NO | — | Webhook signing secret |
| is_active | BOOLEAN | NO | true | Active status |
| last_triggered_at | TIMESTAMP | YES | NULL | Last trigger time |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |

---

### MODULE 2 — CRM (12 Tables)

---

#### TABLE 18: crm_pipelines
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| name | VARCHAR(255) | NO | — | Pipeline name |
| description | TEXT | YES | NULL | Pipeline description |
| is_default | BOOLEAN | NO | false | Default pipeline |
| created_by | UUID | NO | — | FK → users.id |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |
| deleted_at | TIMESTAMP | YES | NULL | Soft delete |

---

#### TABLE 19: crm_pipeline_stages
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| pipeline_id | UUID | NO | — | FK → crm_pipelines.id |
| name | VARCHAR(255) | NO | — | Stage name |
| order | INTEGER | NO | 0 | Display order |
| color | VARCHAR(20) | YES | NULL | Hex color code |
| probability | INTEGER | YES | NULL | Win probability % (0-100) |
| is_closed_won | BOOLEAN | NO | false | Closed Won stage |
| is_closed_lost | BOOLEAN | NO | false | Closed Lost stage |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |

---

#### TABLE 20: crm_contacts
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| first_name | VARCHAR(255) | NO | — | First name |
| last_name | VARCHAR(255) | YES | NULL | Last name |
| email | VARCHAR(255) | YES | NULL | Email address |
| phone | VARCHAR(50) | YES | NULL | Phone number |
| mobile | VARCHAR(50) | YES | NULL | Mobile number |
| title | VARCHAR(255) | YES | NULL | Job title |
| company_id | UUID | YES | NULL | FK → crm_companies.id |
| department | VARCHAR(255) | YES | NULL | Department |
| website | VARCHAR(255) | YES | NULL | Personal website |
| linkedin_url | VARCHAR(255) | YES | NULL | LinkedIn profile URL |
| twitter_handle | VARCHAR(100) | YES | NULL | Twitter handle |
| address_line1 | VARCHAR(255) | YES | NULL | Address line 1 |
| address_line2 | VARCHAR(255) | YES | NULL | Address line 2 |
| city | VARCHAR(100) | YES | NULL | City |
| state | VARCHAR(100) | YES | NULL | State/Province |
| country | VARCHAR(100) | YES | NULL | Country |
| postal_code | VARCHAR(20) | YES | NULL | ZIP/Postal code |
| avatar_url | TEXT | YES | NULL | Contact photo URL |
| source | VARCHAR(100) | YES | NULL | Lead source (web, referral...) |
| status | VARCHAR(50) | NO | 'active' | Contact status |
| lead_score | INTEGER | NO | 0 | Lead score (0-100) |
| owner_id | UUID | YES | NULL | FK → users.id (assigned to) |
| custom_fields | JSONB | NO | '{}' | Custom field values |
| created_by | UUID | NO | — | FK → users.id |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |
| deleted_at | TIMESTAMP | YES | NULL | Soft delete |

---

#### TABLE 21: crm_companies
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| name | VARCHAR(255) | NO | — | Company name |
| website | VARCHAR(255) | YES | NULL | Company website |
| email | VARCHAR(255) | YES | NULL | General email |
| phone | VARCHAR(50) | YES | NULL | Phone number |
| industry | VARCHAR(100) | YES | NULL | Industry type |
| size | VARCHAR(50) | YES | NULL | Company size |
| annual_revenue | DECIMAL(15,2) | YES | NULL | Annual revenue |
| employees_count | INTEGER | YES | NULL | Number of employees |
| address_line1 | VARCHAR(255) | YES | NULL | Address |
| address_line2 | VARCHAR(255) | YES | NULL | Address line 2 |
| city | VARCHAR(100) | YES | NULL | City |
| state | VARCHAR(100) | YES | NULL | State |
| country | VARCHAR(100) | YES | NULL | Country |
| postal_code | VARCHAR(20) | YES | NULL | ZIP code |
| logo_url | TEXT | YES | NULL | Company logo URL |
| description | TEXT | YES | NULL | Company description |
| linkedin_url | VARCHAR(255) | YES | NULL | LinkedIn URL |
| owner_id | UUID | YES | NULL | FK → users.id |
| custom_fields | JSONB | NO | '{}' | Custom field values |
| created_by | UUID | NO | — | FK → users.id |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |
| deleted_at | TIMESTAMP | YES | NULL | Soft delete |

---

#### TABLE 22: crm_leads
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| first_name | VARCHAR(255) | NO | — | First name |
| last_name | VARCHAR(255) | YES | NULL | Last name |
| email | VARCHAR(255) | YES | NULL | Email address |
| phone | VARCHAR(50) | YES | NULL | Phone number |
| company_name | VARCHAR(255) | YES | NULL | Company name |
| title | VARCHAR(255) | YES | NULL | Job title |
| status | VARCHAR(50) | NO | 'new' | new, contacted, qualified, converted, lost |
| source | VARCHAR(100) | YES | NULL | Lead source |
| lead_score | INTEGER | NO | 0 | Lead quality score |
| notes | TEXT | YES | NULL | Notes about lead |
| owner_id | UUID | YES | NULL | FK → users.id |
| converted_contact_id | UUID | YES | NULL | FK → crm_contacts.id |
| converted_deal_id | UUID | YES | NULL | FK → crm_deals.id |
| converted_at | TIMESTAMP | YES | NULL | Conversion timestamp |
| custom_fields | JSONB | NO | '{}' | Custom field values |
| created_by | UUID | NO | — | FK → users.id |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |
| deleted_at | TIMESTAMP | YES | NULL | Soft delete |

---

#### TABLE 23: crm_deals
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| title | VARCHAR(255) | NO | — | Deal title |
| value | DECIMAL(15,2) | YES | NULL | Deal value |
| currency | VARCHAR(10) | NO | 'USD' | Currency code |
| pipeline_id | UUID | NO | — | FK → crm_pipelines.id |
| stage_id | UUID | NO | — | FK → crm_pipeline_stages.id |
| probability | INTEGER | YES | NULL | Win probability % |
| expected_close_date | DATE | YES | NULL | Expected close date |
| actual_close_date | DATE | YES | NULL | Actual close date |
| contact_id | UUID | YES | NULL | FK → crm_contacts.id |
| company_id | UUID | YES | NULL | FK → crm_companies.id |
| owner_id | UUID | YES | NULL | FK → users.id |
| source | VARCHAR(100) | YES | NULL | Deal source |
| status | VARCHAR(50) | NO | 'open' | open, won, lost |
| lost_reason | TEXT | YES | NULL | Reason for losing deal |
| description | TEXT | YES | NULL | Deal description |
| custom_fields | JSONB | NO | '{}' | Custom field values |
| created_by | UUID | NO | — | FK → users.id |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |
| deleted_at | TIMESTAMP | YES | NULL | Soft delete |

---

#### TABLE 24: crm_activities
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| type | VARCHAR(50) | NO | — | call, email, meeting, task, note |
| subject | VARCHAR(500) | NO | — | Activity subject |
| description | TEXT | YES | NULL | Detailed notes |
| status | VARCHAR(50) | NO | 'pending' | pending, completed, cancelled |
| due_date | TIMESTAMP | YES | NULL | Due date/time |
| completed_at | TIMESTAMP | YES | NULL | Completion timestamp |
| duration_minutes | INTEGER | YES | NULL | Activity duration |
| contact_id | UUID | YES | NULL | FK → crm_contacts.id |
| company_id | UUID | YES | NULL | FK → crm_companies.id |
| deal_id | UUID | YES | NULL | FK → crm_deals.id |
| lead_id | UUID | YES | NULL | FK → crm_leads.id |
| assigned_to | UUID | YES | NULL | FK → users.id |
| created_by | UUID | NO | — | FK → users.id |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |

---

#### TABLE 25: crm_notes
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| content | TEXT | NO | — | Note content (rich text) |
| contact_id | UUID | YES | NULL | FK → crm_contacts.id |
| company_id | UUID | YES | NULL | FK → crm_companies.id |
| deal_id | UUID | YES | NULL | FK → crm_deals.id |
| lead_id | UUID | YES | NULL | FK → crm_leads.id |
| created_by | UUID | NO | — | FK → users.id |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |

---

#### TABLE 26: crm_tags
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| name | VARCHAR(100) | NO | — | Tag name |
| color | VARCHAR(20) | NO | '#6366f1' | Tag color (hex) |
| created_at | TIMESTAMP | NO | NOW() | Creation time |

*UNIQUE CONSTRAINT: (organization_id, name)*

---

#### TABLE 27: crm_contact_tags (Junction)
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| contact_id | UUID | NO | — | FK → crm_contacts.id |
| tag_id | UUID | NO | — | FK → crm_tags.id |

*PRIMARY KEY: (contact_id, tag_id)*

---

#### TABLE 28: crm_deal_tags (Junction)
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| deal_id | UUID | NO | — | FK → crm_deals.id |
| tag_id | UUID | NO | — | FK → crm_tags.id |

*PRIMARY KEY: (deal_id, tag_id)*

---

#### TABLE 29: crm_custom_fields
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| module | VARCHAR(100) | NO | — | contact, company, deal, lead |
| name | VARCHAR(255) | NO | — | Field display name |
| slug | VARCHAR(255) | NO | — | Field identifier |
| type | VARCHAR(50) | NO | — | text, number, date, dropdown, checkbox, url, email |
| options | JSONB | YES | NULL | Options for dropdown fields |
| is_required | BOOLEAN | NO | false | Required field flag |
| order | INTEGER | NO | 0 | Display order |
| created_at | TIMESTAMP | NO | NOW() | Creation time |

*UNIQUE CONSTRAINT: (organization_id, module, slug)*

---

### MODULE 3 — FORMS BUILDER (4 Tables)

---

#### TABLE 30: forms
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| title | VARCHAR(500) | NO | — | Form title |
| description | TEXT | YES | NULL | Form description |
| slug | VARCHAR(255) | NO | — | UNIQUE public URL slug |
| status | VARCHAR(50) | NO | 'draft' | draft, published, closed |
| settings | JSONB | NO | '{}' | Notification settings, etc. |
| theme | JSONB | NO | '{}' | Colors, fonts, branding |
| is_multi_step | BOOLEAN | NO | false | Multi-step form flag |
| success_message | TEXT | YES | 'Thank you!' | Post-submission message |
| redirect_url | TEXT | YES | NULL | Post-submission redirect |
| max_submissions | INTEGER | YES | NULL | Max response limit |
| close_at | TIMESTAMP | YES | NULL | Auto-close date |
| submission_count | INTEGER | NO | 0 | Total submissions count |
| created_by | UUID | NO | — | FK → users.id |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |
| deleted_at | TIMESTAMP | YES | NULL | Soft delete |

---

#### TABLE 31: form_fields
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| form_id | UUID | NO | — | FK → forms.id |
| step | INTEGER | NO | 1 | Step number (multi-step) |
| type | VARCHAR(50) | NO | — | text, email, phone, number, date, time, datetime, dropdown, checkbox, radio, file, textarea, heading, paragraph, divider, rating, signature, address |
| label | VARCHAR(500) | NO | — | Field label |
| placeholder | VARCHAR(500) | YES | NULL | Placeholder text |
| help_text | TEXT | YES | NULL | Help/hint text |
| is_required | BOOLEAN | NO | false | Required field |
| order | INTEGER | NO | 0 | Display order |
| options | JSONB | YES | NULL | Options (dropdown/radio/checkbox) |
| validation | JSONB | YES | NULL | Validation rules (min, max, regex) |
| logic | JSONB | YES | NULL | Conditional logic rules |
| settings | JSONB | NO | '{}' | Width, column span settings |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |

---

#### TABLE 32: form_submissions
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| form_id | UUID | NO | — | FK → forms.id |
| submission_number | INTEGER | NO | — | Sequential submission number |
| status | VARCHAR(50) | NO | 'new' | new, reviewed, starred, trashed |
| ip_address | VARCHAR(45) | YES | NULL | Submitter IP |
| user_agent | TEXT | YES | NULL | Browser info |
| referrer | TEXT | YES | NULL | Referrer URL |
| submitted_by | UUID | YES | NULL | FK → users.id (if logged in) |
| created_at | TIMESTAMP | NO | NOW() | Submission time |

---

#### TABLE 33: form_submission_data
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| submission_id | UUID | NO | — | FK → form_submissions.id |
| field_id | UUID | NO | — | FK → form_fields.id |
| value | TEXT | YES | NULL | Field value (text) |
| file_url | TEXT | YES | NULL | File URL (for file fields) |
| created_at | TIMESTAMP | NO | NOW() | Creation time |

---

### MODULE 4 — ANALYTICS & REPORTS (4 Tables)

---

#### TABLE 34: dashboards
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| name | VARCHAR(255) | NO | — | Dashboard name |
| description | TEXT | YES | NULL | Dashboard description |
| is_default | BOOLEAN | NO | false | Default dashboard |
| is_public | BOOLEAN | NO | false | Publicly accessible |
| layout | JSONB | NO | '[]' | Widget grid layout config |
| created_by | UUID | NO | — | FK → users.id |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |
| deleted_at | TIMESTAMP | YES | NULL | Soft delete |

---

#### TABLE 35: dashboard_widgets
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| dashboard_id | UUID | NO | — | FK → dashboards.id |
| type | VARCHAR(100) | NO | — | bar_chart, line_chart, pie_chart, donut_chart, area_chart, kpi_card, table, funnel, scatter |
| title | VARCHAR(255) | NO | — | Widget title |
| config | JSONB | NO | '{}' | Query config, filters, styling |
| position_x | INTEGER | NO | 0 | Grid column position |
| position_y | INTEGER | NO | 0 | Grid row position |
| width | INTEGER | NO | 4 | Grid column span (max 12) |
| height | INTEGER | NO | 3 | Grid row span |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |

---

#### TABLE 36: reports
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| name | VARCHAR(255) | NO | — | Report name |
| description | TEXT | YES | NULL | Report description |
| module | VARCHAR(100) | NO | — | crm, hr, projects, helpdesk, accounting |
| type | VARCHAR(50) | NO | — | tabular, summary, matrix, pivot |
| config | JSONB | NO | '{}' | Columns, filters, grouping, sorting |
| is_public | BOOLEAN | NO | false | Public access flag |
| created_by | UUID | NO | — | FK → users.id |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |
| deleted_at | TIMESTAMP | YES | NULL | Soft delete |

---

#### TABLE 37: report_schedules
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| report_id | UUID | NO | — | FK → reports.id |
| frequency | VARCHAR(50) | NO | — | daily, weekly, monthly |
| day_of_week | INTEGER | YES | NULL | 0=Sun to 6=Sat (for weekly) |
| day_of_month | INTEGER | YES | NULL | 1-31 (for monthly) |
| time_hour | INTEGER | NO | 9 | Hour (0-23) |
| time_minute | INTEGER | NO | 0 | Minute (0-59) |
| timezone | VARCHAR(100) | NO | 'UTC' | Schedule timezone |
| recipients | TEXT[] | NO | — | Email recipients array |
| format | VARCHAR(20) | NO | 'pdf' | pdf, xlsx, csv |
| is_active | BOOLEAN | NO | true | Schedule active status |
| last_sent_at | TIMESTAMP | YES | NULL | Last send timestamp |
| created_at | TIMESTAMP | NO | NOW() | Creation time |

---

### MODULE 5 — PROJECT MANAGEMENT (8 Tables)

---

#### TABLE 38: projects
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| name | VARCHAR(255) | NO | — | Project name |
| description | TEXT | YES | NULL | Project description |
| status | VARCHAR(50) | NO | 'active' | active, on_hold, completed, cancelled |
| priority | VARCHAR(20) | NO | 'medium' | low, medium, high, urgent |
| start_date | DATE | YES | NULL | Project start date |
| end_date | DATE | YES | NULL | Project end date |
| budget | DECIMAL(15,2) | YES | NULL | Project budget |
| progress | INTEGER | NO | 0 | Completion % (0-100) |
| logo_url | TEXT | YES | NULL | Project icon URL |
| color | VARCHAR(20) | NO | '#6366f1' | Project color |
| owner_id | UUID | NO | — | FK → users.id |
| client_name | VARCHAR(255) | YES | NULL | Client name |
| tags | TEXT[] | NO | '{}' | Project tags |
| custom_fields | JSONB | NO | '{}' | Custom fields |
| created_by | UUID | NO | — | FK → users.id |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |
| deleted_at | TIMESTAMP | YES | NULL | Soft delete |

---

#### TABLE 39: project_members
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| project_id | UUID | NO | — | FK → projects.id |
| user_id | UUID | NO | — | FK → users.id |
| role | VARCHAR(50) | NO | 'member' | owner, manager, member, viewer |
| joined_at | TIMESTAMP | NO | NOW() | Join timestamp |

*UNIQUE CONSTRAINT: (project_id, user_id)*

---

#### TABLE 40: task_lists
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| project_id | UUID | NO | — | FK → projects.id |
| name | VARCHAR(255) | NO | — | List/section name |
| order | INTEGER | NO | 0 | Display order |
| color | VARCHAR(20) | YES | NULL | Section color |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |

---

#### TABLE 41: tasks
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| project_id | UUID | YES | NULL | FK → projects.id |
| task_list_id | UUID | YES | NULL | FK → task_lists.id |
| parent_task_id | UUID | YES | NULL | FK → tasks.id (subtask) |
| title | VARCHAR(500) | NO | — | Task title |
| description | TEXT | YES | NULL | Task description (rich text) |
| status | VARCHAR(50) | NO | 'todo' | todo, in_progress, review, done |
| priority | VARCHAR(20) | NO | 'medium' | low, medium, high, urgent |
| assignee_id | UUID | YES | NULL | FK → users.id |
| reporter_id | UUID | NO | — | FK → users.id |
| start_date | DATE | YES | NULL | Task start date |
| due_date | DATE | YES | NULL | Task due date |
| completed_at | TIMESTAMP | YES | NULL | Completion timestamp |
| estimated_hours | DECIMAL(6,2) | YES | NULL | Time estimate |
| actual_hours | DECIMAL(6,2) | NO | 0 | Logged hours |
| order | INTEGER | NO | 0 | Sort order |
| tags | TEXT[] | NO | '{}' | Task tags |
| custom_fields | JSONB | NO | '{}' | Custom field values |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |
| deleted_at | TIMESTAMP | YES | NULL | Soft delete |

---

#### TABLE 42: task_comments
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| task_id | UUID | NO | — | FK → tasks.id |
| user_id | UUID | NO | — | FK → users.id |
| content | TEXT | NO | — | Comment content |
| is_edited | BOOLEAN | NO | false | Edit flag |
| parent_id | UUID | YES | NULL | FK → task_comments.id (reply) |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |
| deleted_at | TIMESTAMP | YES | NULL | Soft delete |

---

#### TABLE 43: task_attachments
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| task_id | UUID | NO | — | FK → tasks.id |
| name | VARCHAR(255) | NO | — | File name |
| url | TEXT | NO | — | File URL (MinIO) |
| size | BIGINT | YES | NULL | File size in bytes |
| mime_type | VARCHAR(100) | YES | NULL | MIME type |
| uploaded_by | UUID | NO | — | FK → users.id |
| created_at | TIMESTAMP | NO | NOW() | Creation time |

---

#### TABLE 44: milestones
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| project_id | UUID | NO | — | FK → projects.id |
| name | VARCHAR(255) | NO | — | Milestone name |
| description | TEXT | YES | NULL | Milestone description |
| due_date | DATE | YES | NULL | Target date |
| status | VARCHAR(50) | NO | 'pending' | pending, completed |
| completed_at | TIMESTAMP | YES | NULL | Completion timestamp |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |

---

#### TABLE 45: time_logs
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| task_id | UUID | YES | NULL | FK → tasks.id |
| project_id | UUID | YES | NULL | FK → projects.id |
| user_id | UUID | NO | — | FK → users.id |
| description | TEXT | YES | NULL | Work description |
| hours | DECIMAL(6,2) | NO | — | Hours logged |
| log_date | DATE | NO | — | Date of work |
| billable | BOOLEAN | NO | true | Billable flag |
| hourly_rate | DECIMAL(10,2) | YES | NULL | Override hourly rate |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |

---

### MODULE 6 — HR & PEOPLE (8 Tables)

---

#### TABLE 46: departments
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| name | VARCHAR(255) | NO | — | Department name |
| code | VARCHAR(50) | YES | NULL | Department code |
| parent_id | UUID | YES | NULL | FK → departments.id (hierarchy) |
| manager_id | UUID | YES | NULL | FK → employees.id |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |

---

#### TABLE 47: designations
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| name | VARCHAR(255) | NO | — | Designation/Job title name |
| level | INTEGER | YES | NULL | Seniority level |
| created_at | TIMESTAMP | NO | NOW() | Creation time |

---

#### TABLE 48: employees
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| user_id | UUID | YES | NULL | FK → users.id |
| employee_code | VARCHAR(100) | YES | NULL | Unique employee ID |
| first_name | VARCHAR(255) | NO | — | First name |
| last_name | VARCHAR(255) | YES | NULL | Last name |
| email | VARCHAR(255) | NO | — | Work email |
| phone | VARCHAR(50) | YES | NULL | Phone number |
| avatar_url | TEXT | YES | NULL | Profile photo |
| department_id | UUID | YES | NULL | FK → departments.id |
| designation_id | UUID | YES | NULL | FK → designations.id |
| manager_id | UUID | YES | NULL | FK → employees.id |
| employment_type | VARCHAR(50) | NO | 'full_time' | full_time, part_time, contract, intern |
| status | VARCHAR(50) | NO | 'active' | active, inactive, terminated |
| date_of_birth | DATE | YES | NULL | Date of birth |
| gender | VARCHAR(20) | YES | NULL | Gender |
| marital_status | VARCHAR(20) | YES | NULL | Marital status |
| nationality | VARCHAR(100) | YES | NULL | Nationality |
| join_date | DATE | NO | — | Employment start date |
| termination_date | DATE | YES | NULL | Employment end date |
| address | TEXT | YES | NULL | Home address |
| emergency_contact_name | VARCHAR(255) | YES | NULL | Emergency contact |
| emergency_contact_phone | VARCHAR(50) | YES | NULL | Emergency phone |
| bank_account_number | VARCHAR(100) | YES | NULL | Bank account |
| bank_name | VARCHAR(255) | YES | NULL | Bank name |
| pan_number | VARCHAR(50) | YES | NULL | PAN/Tax number |
| custom_fields | JSONB | NO | '{}' | Custom field values |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |
| deleted_at | TIMESTAMP | YES | NULL | Soft delete |

---

#### TABLE 49: leave_types
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| name | VARCHAR(255) | NO | — | Leave type name |
| code | VARCHAR(50) | NO | — | Code (CL, SL, EL, PL) |
| color | VARCHAR(20) | NO | '#10b981' | Display color |
| days_per_year | DECIMAL(5,1) | NO | — | Allocated days/year |
| is_paid | BOOLEAN | NO | true | Paid leave flag |
| carry_forward | BOOLEAN | NO | false | Allow carry forward |
| max_carry_forward_days | DECIMAL(5,1) | YES | NULL | Max carry forward days |
| requires_approval | BOOLEAN | NO | true | Needs approval |
| created_at | TIMESTAMP | NO | NOW() | Creation time |

---

#### TABLE 50: leave_requests
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| employee_id | UUID | NO | — | FK → employees.id |
| leave_type_id | UUID | NO | — | FK → leave_types.id |
| start_date | DATE | NO | — | Leave start date |
| end_date | DATE | NO | — | Leave end date |
| total_days | DECIMAL(5,1) | NO | — | Number of days |
| reason | TEXT | YES | NULL | Reason for leave |
| status | VARCHAR(50) | NO | 'pending' | pending, approved, rejected, cancelled |
| approved_by | UUID | YES | NULL | FK → users.id |
| approved_at | TIMESTAMP | YES | NULL | Approval timestamp |
| rejection_reason | TEXT | YES | NULL | Rejection reason |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |

---

#### TABLE 51: leave_balances
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| employee_id | UUID | NO | — | FK → employees.id |
| leave_type_id | UUID | NO | — | FK → leave_types.id |
| year | INTEGER | NO | — | Calendar year |
| total_days | DECIMAL(5,1) | NO | — | Total allocated days |
| used_days | DECIMAL(5,1) | NO | 0 | Used days |
| pending_days | DECIMAL(5,1) | NO | 0 | Pending approval days |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |

*UNIQUE CONSTRAINT: (employee_id, leave_type_id, year)*

---

#### TABLE 52: attendance_records
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| employee_id | UUID | NO | — | FK → employees.id |
| date | DATE | NO | — | Attendance date |
| check_in | TIMESTAMP | YES | NULL | Check-in time |
| check_out | TIMESTAMP | YES | NULL | Check-out time |
| check_in_location | VARCHAR(255) | YES | NULL | Check-in location |
| check_out_location | VARCHAR(255) | YES | NULL | Check-out location |
| status | VARCHAR(50) | NO | 'present' | present, absent, late, half_day, on_leave, holiday |
| total_hours | DECIMAL(5,2) | YES | NULL | Total work hours |
| overtime_hours | DECIMAL(5,2) | NO | 0 | Overtime hours |
| notes | TEXT | YES | NULL | Notes |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |

*UNIQUE CONSTRAINT: (employee_id, date)*

---

#### TABLE 53: payroll_records
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| employee_id | UUID | NO | — | FK → employees.id |
| month | INTEGER | NO | — | Month (1-12) |
| year | INTEGER | NO | — | Year |
| basic_salary | DECIMAL(12,2) | NO | — | Basic salary |
| allowances | JSONB | NO | '{}' | Allowance breakdown |
| deductions | JSONB | NO | '{}' | Deduction breakdown |
| gross_salary | DECIMAL(12,2) | NO | — | Gross salary |
| net_salary | DECIMAL(12,2) | NO | — | Net take-home salary |
| tax_amount | DECIMAL(12,2) | NO | 0 | Income tax |
| pf_amount | DECIMAL(12,2) | NO | 0 | Provident fund |
| esi_amount | DECIMAL(12,2) | NO | 0 | ESI contribution |
| status | VARCHAR(50) | NO | 'draft' | draft, approved, paid |
| payment_date | DATE | YES | NULL | Payment date |
| payment_method | VARCHAR(50) | YES | NULL | bank_transfer, cash, cheque |
| notes | TEXT | YES | NULL | Payroll notes |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |

*UNIQUE CONSTRAINT: (employee_id, month, year)*

---

### MODULE 7 — HELP DESK (7 Tables)

---

#### TABLE 54: ticket_categories
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| name | VARCHAR(255) | NO | — | Category name |
| description | TEXT | YES | NULL | Category description |
| parent_id | UUID | YES | NULL | FK → ticket_categories.id |
| color | VARCHAR(20) | YES | NULL | Category color |
| created_at | TIMESTAMP | NO | NOW() | Creation time |

---

#### TABLE 55: sla_policies
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| name | VARCHAR(255) | NO | — | SLA policy name |
| description | TEXT | YES | NULL | Policy description |
| priority | VARCHAR(20) | NO | — | low, medium, high, urgent |
| first_response_hours | INTEGER | NO | — | First response time limit |
| resolution_hours | INTEGER | NO | — | Resolution time limit |
| business_hours_only | BOOLEAN | NO | true | Count only business hours |
| is_active | BOOLEAN | NO | true | Policy active status |
| created_at | TIMESTAMP | NO | NOW() | Creation time |

---

#### TABLE 56: tickets
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| ticket_number | VARCHAR(50) | NO | — | Auto-generated ticket # |
| subject | VARCHAR(500) | NO | — | Ticket subject |
| description | TEXT | YES | NULL | Issue description |
| status | VARCHAR(50) | NO | 'open' | open, pending, resolved, closed |
| priority | VARCHAR(20) | NO | 'medium' | low, medium, high, urgent |
| category_id | UUID | YES | NULL | FK → ticket_categories.id |
| sla_policy_id | UUID | YES | NULL | FK → sla_policies.id |
| customer_name | VARCHAR(255) | YES | NULL | Customer name |
| customer_email | VARCHAR(255) | YES | NULL | Customer email |
| customer_phone | VARCHAR(50) | YES | NULL | Customer phone |
| contact_id | UUID | YES | NULL | FK → crm_contacts.id |
| assignee_id | UUID | YES | NULL | FK → users.id |
| source | VARCHAR(50) | NO | 'web' | web, email, phone, chat |
| first_response_at | TIMESTAMP | YES | NULL | First agent response time |
| resolved_at | TIMESTAMP | YES | NULL | Resolution timestamp |
| closed_at | TIMESTAMP | YES | NULL | Close timestamp |
| due_at | TIMESTAMP | YES | NULL | SLA due date |
| tags | TEXT[] | NO | '{}' | Ticket tags |
| custom_fields | JSONB | NO | '{}' | Custom fields |
| created_by | UUID | YES | NULL | FK → users.id |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |
| deleted_at | TIMESTAMP | YES | NULL | Soft delete |

---

#### TABLE 57: ticket_comments
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| ticket_id | UUID | NO | — | FK → tickets.id |
| user_id | UUID | YES | NULL | FK → users.id |
| content | TEXT | NO | — | Comment content |
| is_private | BOOLEAN | NO | false | Internal note (not visible to customer) |
| is_customer | BOOLEAN | NO | false | Customer-submitted reply |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |
| deleted_at | TIMESTAMP | YES | NULL | Soft delete |

---

#### TABLE 58: ticket_attachments
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| ticket_id | UUID | NO | — | FK → tickets.id |
| comment_id | UUID | YES | NULL | FK → ticket_comments.id |
| name | VARCHAR(255) | NO | — | File name |
| url | TEXT | NO | — | File URL |
| size | BIGINT | YES | NULL | File size in bytes |
| mime_type | VARCHAR(100) | YES | NULL | MIME type |
| uploaded_by | UUID | NO | — | FK → users.id |
| created_at | TIMESTAMP | NO | NOW() | Creation time |

---

#### TABLE 59: knowledge_base_categories
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| name | VARCHAR(255) | NO | — | Category name |
| description | TEXT | YES | NULL | Category description |
| parent_id | UUID | YES | NULL | FK → knowledge_base_categories.id |
| order | INTEGER | NO | 0 | Display order |
| icon | VARCHAR(50) | YES | NULL | Icon name |
| is_public | BOOLEAN | NO | true | Publicly accessible |
| created_at | TIMESTAMP | NO | NOW() | Creation time |

---

#### TABLE 60: knowledge_base_articles
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| category_id | UUID | NO | — | FK → knowledge_base_categories.id |
| title | VARCHAR(500) | NO | — | Article title |
| slug | VARCHAR(500) | NO | — | URL-friendly slug |
| content | TEXT | NO | — | Article content (rich text) |
| status | VARCHAR(50) | NO | 'draft' | draft, published |
| is_public | BOOLEAN | NO | true | Public visibility |
| views | INTEGER | NO | 0 | View count |
| helpful_count | INTEGER | NO | 0 | Helpful votes |
| not_helpful_count | INTEGER | NO | 0 | Not helpful votes |
| tags | TEXT[] | NO | '{}' | Article tags |
| author_id | UUID | NO | — | FK → users.id |
| published_at | TIMESTAMP | YES | NULL | Publish timestamp |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |

---

### MODULE 8 — WORKFLOW AUTOMATION (5 Tables)

---

#### TABLE 61: workflows
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| name | VARCHAR(255) | NO | — | Workflow name |
| description | TEXT | YES | NULL | Workflow description |
| status | VARCHAR(50) | NO | 'draft' | draft, active, paused |
| trigger_type | VARCHAR(100) | NO | — | form_submitted, record_created, schedule, webhook, manual |
| trigger_config | JSONB | NO | '{}' | Trigger configuration |
| created_by | UUID | NO | — | FK → users.id |
| run_count | INTEGER | NO | 0 | Total executions |
| last_run_at | TIMESTAMP | YES | NULL | Last execution time |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |

---

#### TABLE 62: workflow_steps
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| workflow_id | UUID | NO | — | FK → workflows.id |
| type | VARCHAR(100) | NO | — | action, condition, delay, loop |
| name | VARCHAR(255) | NO | — | Step name |
| config | JSONB | NO | '{}' | Step configuration |
| order | INTEGER | NO | — | Execution order |
| parent_step_id | UUID | YES | NULL | FK → workflow_steps.id |
| branch | VARCHAR(20) | YES | NULL | 'true' or 'false' for conditions |
| created_at | TIMESTAMP | NO | NOW() | Creation time |

---

#### TABLE 63: workflow_runs
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| workflow_id | UUID | NO | — | FK → workflows.id |
| status | VARCHAR(50) | NO | 'running' | running, completed, failed, cancelled |
| trigger_data | JSONB | YES | NULL | Data that triggered the run |
| context | JSONB | NO | '{}' | Execution context variables |
| started_at | TIMESTAMP | NO | NOW() | Start timestamp |
| completed_at | TIMESTAMP | YES | NULL | End timestamp |
| error_message | TEXT | YES | NULL | Error details |

---

#### TABLE 64: workflow_run_logs
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| run_id | UUID | NO | — | FK → workflow_runs.id |
| step_id | UUID | YES | NULL | FK → workflow_steps.id |
| status | VARCHAR(50) | NO | — | success, failed, skipped |
| input | JSONB | YES | NULL | Step input data |
| output | JSONB | YES | NULL | Step output data |
| error | TEXT | YES | NULL | Error message |
| duration_ms | INTEGER | YES | NULL | Execution time in ms |
| created_at | TIMESTAMP | NO | NOW() | Log timestamp |

---

#### TABLE 65: app_integrations
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| app_name | VARCHAR(100) | NO | — | App identifier (slack, gmail...) |
| display_name | VARCHAR(255) | NO | — | Display name |
| credentials | TEXT | NO | — | Encrypted credentials JSON |
| status | VARCHAR(50) | NO | 'active' | active, expired, disconnected |
| connected_by | UUID | NO | — | FK → users.id |
| connected_at | TIMESTAMP | NO | NOW() | Connection timestamp |
| expires_at | TIMESTAMP | YES | NULL | Credential expiry |
| created_at | TIMESTAMP | NO | NOW() | Creation time |

---

### MODULE 9 — ACCOUNTING (9 Tables)

---

#### TABLE 66: acc_chart_of_accounts
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| code | VARCHAR(50) | NO | — | Account code |
| name | VARCHAR(255) | NO | — | Account name |
| type | VARCHAR(50) | NO | — | asset, liability, equity, income, expense |
| parent_id | UUID | YES | NULL | FK → acc_chart_of_accounts.id |
| description | TEXT | YES | NULL | Account description |
| is_system | BOOLEAN | NO | false | System account flag |
| created_at | TIMESTAMP | NO | NOW() | Creation time |

---

#### TABLE 67: acc_customers
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| contact_id | UUID | YES | NULL | FK → crm_contacts.id |
| name | VARCHAR(255) | NO | — | Customer name |
| email | VARCHAR(255) | YES | NULL | Email address |
| phone | VARCHAR(50) | YES | NULL | Phone |
| billing_address | TEXT | YES | NULL | Billing address |
| shipping_address | TEXT | YES | NULL | Shipping address |
| tax_number | VARCHAR(100) | YES | NULL | GST/VAT number |
| currency | VARCHAR(10) | NO | 'USD' | Default currency |
| payment_terms | INTEGER | NO | 30 | Payment terms (days) |
| credit_limit | DECIMAL(15,2) | YES | NULL | Credit limit |
| outstanding_balance | DECIMAL(15,2) | NO | 0 | Current outstanding |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |

---

#### TABLE 68: acc_vendors
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| name | VARCHAR(255) | NO | — | Vendor name |
| email | VARCHAR(255) | YES | NULL | Email |
| phone | VARCHAR(50) | YES | NULL | Phone |
| address | TEXT | YES | NULL | Address |
| tax_number | VARCHAR(100) | YES | NULL | Tax number |
| currency | VARCHAR(10) | NO | 'USD' | Currency |
| payment_terms | INTEGER | NO | 30 | Payment terms |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |

---

#### TABLE 69: acc_invoices
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| invoice_number | VARCHAR(100) | NO | — | Auto-generated invoice # |
| customer_id | UUID | NO | — | FK → acc_customers.id |
| status | VARCHAR(50) | NO | 'draft' | draft, sent, paid, overdue, cancelled |
| issue_date | DATE | NO | — | Invoice issue date |
| due_date | DATE | NO | — | Payment due date |
| currency | VARCHAR(10) | NO | 'USD' | Currency |
| subtotal | DECIMAL(15,2) | NO | 0 | Before tax amount |
| tax_amount | DECIMAL(15,2) | NO | 0 | Tax amount |
| discount_amount | DECIMAL(15,2) | NO | 0 | Discount |
| total_amount | DECIMAL(15,2) | NO | 0 | Total amount |
| amount_paid | DECIMAL(15,2) | NO | 0 | Amount received |
| notes | TEXT | YES | NULL | Invoice notes |
| terms | TEXT | YES | NULL | Payment terms text |
| reference | VARCHAR(255) | YES | NULL | PO/reference number |
| sent_at | TIMESTAMP | YES | NULL | Email send timestamp |
| paid_at | TIMESTAMP | YES | NULL | Payment received time |
| created_by | UUID | NO | — | FK → users.id |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |

---

#### TABLE 70: acc_invoice_items
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| invoice_id | UUID | NO | — | FK → acc_invoices.id |
| description | VARCHAR(500) | NO | — | Item description |
| quantity | DECIMAL(10,3) | NO | 1 | Quantity |
| unit_price | DECIMAL(15,2) | NO | — | Price per unit |
| discount_percent | DECIMAL(5,2) | NO | 0 | Discount % |
| tax_rate | DECIMAL(5,2) | NO | 0 | Tax rate % |
| amount | DECIMAL(15,2) | NO | — | Line total |
| order | INTEGER | NO | 0 | Display order |
| created_at | TIMESTAMP | NO | NOW() | Creation time |

---

#### TABLE 71: acc_expenses
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| category | VARCHAR(255) | NO | — | Expense category |
| amount | DECIMAL(15,2) | NO | — | Expense amount |
| currency | VARCHAR(10) | NO | 'USD' | Currency |
| vendor_id | UUID | YES | NULL | FK → acc_vendors.id |
| description | TEXT | YES | NULL | Expense description |
| expense_date | DATE | NO | — | Date of expense |
| receipt_url | TEXT | YES | NULL | Receipt file URL |
| status | VARCHAR(50) | NO | 'pending' | pending, approved, rejected, paid |
| paid_from_account_id | UUID | YES | NULL | FK → acc_bank_accounts.id |
| submitted_by | UUID | NO | — | FK → users.id |
| approved_by | UUID | YES | NULL | FK → users.id |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |

---

#### TABLE 72: acc_bank_accounts
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| name | VARCHAR(255) | NO | — | Account name |
| account_number | VARCHAR(100) | YES | NULL | Account number |
| bank_name | VARCHAR(255) | YES | NULL | Bank name |
| account_type | VARCHAR(50) | NO | — | checking, savings, credit_card, cash |
| currency | VARCHAR(10) | NO | 'USD' | Currency |
| opening_balance | DECIMAL(15,2) | NO | 0 | Opening balance |
| current_balance | DECIMAL(15,2) | NO | 0 | Current balance |
| is_primary | BOOLEAN | NO | false | Primary account flag |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |

---

#### TABLE 73: acc_transactions
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| bank_account_id | UUID | YES | NULL | FK → acc_bank_accounts.id |
| type | VARCHAR(50) | NO | — | income, expense, transfer |
| amount | DECIMAL(15,2) | NO | — | Transaction amount |
| currency | VARCHAR(10) | NO | 'USD' | Currency |
| date | DATE | NO | — | Transaction date |
| description | TEXT | YES | NULL | Description |
| reference | VARCHAR(255) | YES | NULL | Reference number |
| account_id | UUID | YES | NULL | FK → acc_chart_of_accounts.id |
| invoice_id | UUID | YES | NULL | FK → acc_invoices.id |
| expense_id | UUID | YES | NULL | FK → acc_expenses.id |
| created_by | UUID | NO | — | FK → users.id |
| created_at | TIMESTAMP | NO | NOW() | Creation time |

---

#### TABLE 74: acc_tax_rates
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| name | VARCHAR(255) | NO | — | Tax name (GST 18%, VAT 20%) |
| rate | DECIMAL(5,2) | NO | — | Tax rate |
| type | VARCHAR(50) | NO | 'percentage' | percentage or fixed |
| is_active | BOOLEAN | NO | true | Active status |
| created_at | TIMESTAMP | NO | NOW() | Creation time |

---

### MODULE 10 — INVENTORY (10 Tables)

---

#### TABLE 75: inv_categories
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| name | VARCHAR(255) | NO | — | Category name |
| parent_id | UUID | YES | NULL | FK → inv_categories.id |
| description | TEXT | YES | NULL | Category description |
| created_at | TIMESTAMP | NO | NOW() | Creation time |

---

#### TABLE 76: inv_units
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| name | VARCHAR(100) | NO | — | Unit name (pieces, kg, liters) |
| abbreviation | VARCHAR(20) | NO | — | Short form (pcs, kg, L) |
| created_at | TIMESTAMP | NO | NOW() | Creation time |

---

#### TABLE 77: inv_products
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| sku | VARCHAR(100) | NO | — | Stock keeping unit code |
| name | VARCHAR(255) | NO | — | Product name |
| description | TEXT | YES | NULL | Product description |
| category_id | UUID | YES | NULL | FK → inv_categories.id |
| unit_id | UUID | YES | NULL | FK → inv_units.id |
| type | VARCHAR(50) | NO | 'product' | product or service |
| selling_price | DECIMAL(15,2) | YES | NULL | Sale price |
| cost_price | DECIMAL(15,2) | YES | NULL | Purchase cost |
| tax_rate | DECIMAL(5,2) | NO | 0 | Default tax % |
| image_url | TEXT | YES | NULL | Product image |
| barcode | VARCHAR(100) | YES | NULL | Barcode/QR |
| is_active | BOOLEAN | NO | true | Active status |
| track_inventory | BOOLEAN | NO | true | Track stock flag |
| reorder_point | DECIMAL(10,2) | YES | NULL | Low stock threshold |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |

---

#### TABLE 78: inv_warehouses
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| name | VARCHAR(255) | NO | — | Warehouse name |
| address | TEXT | YES | NULL | Warehouse address |
| is_primary | BOOLEAN | NO | false | Primary warehouse |
| created_at | TIMESTAMP | NO | NOW() | Creation time |

---

#### TABLE 79: inv_stock
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| product_id | UUID | NO | — | FK → inv_products.id |
| warehouse_id | UUID | NO | — | FK → inv_warehouses.id |
| quantity | DECIMAL(10,2) | NO | 0 | Available stock |
| reserved_quantity | DECIMAL(10,2) | NO | 0 | Reserved for orders |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |

*UNIQUE CONSTRAINT: (product_id, warehouse_id)*

---

#### TABLE 80: inv_stock_movements
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| product_id | UUID | NO | — | FK → inv_products.id |
| warehouse_id | UUID | NO | — | FK → inv_warehouses.id |
| type | VARCHAR(50) | NO | — | in, out, transfer, adjustment |
| quantity | DECIMAL(10,2) | NO | — | Movement quantity |
| reference_type | VARCHAR(50) | YES | NULL | purchase_order, sales_order |
| reference_id | UUID | YES | NULL | Reference record ID |
| notes | TEXT | YES | NULL | Movement notes |
| created_by | UUID | NO | — | FK → users.id |
| created_at | TIMESTAMP | NO | NOW() | Creation time |

---

#### TABLE 81: inv_purchase_orders
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| po_number | VARCHAR(100) | NO | — | Purchase order number |
| vendor_id | UUID | NO | — | FK → acc_vendors.id |
| warehouse_id | UUID | NO | — | FK → inv_warehouses.id |
| status | VARCHAR(50) | NO | 'draft' | draft, sent, received, cancelled |
| order_date | DATE | NO | — | PO date |
| expected_date | DATE | YES | NULL | Expected delivery date |
| received_date | DATE | YES | NULL | Actual receipt date |
| subtotal | DECIMAL(15,2) | NO | 0 | Subtotal |
| tax_amount | DECIMAL(15,2) | NO | 0 | Tax amount |
| total_amount | DECIMAL(15,2) | NO | 0 | Total amount |
| notes | TEXT | YES | NULL | PO notes |
| created_by | UUID | NO | — | FK → users.id |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |

---

#### TABLE 82: inv_purchase_order_items
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| po_id | UUID | NO | — | FK → inv_purchase_orders.id |
| product_id | UUID | NO | — | FK → inv_products.id |
| quantity | DECIMAL(10,2) | NO | — | Ordered quantity |
| received_quantity | DECIMAL(10,2) | NO | 0 | Received quantity |
| unit_price | DECIMAL(15,2) | NO | — | Unit cost |
| tax_rate | DECIMAL(5,2) | NO | 0 | Tax rate % |
| amount | DECIMAL(15,2) | NO | — | Line total |
| created_at | TIMESTAMP | NO | NOW() | Creation time |

---

#### TABLE 83: inv_sales_orders
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| so_number | VARCHAR(100) | NO | — | Sales order number |
| customer_id | UUID | NO | — | FK → acc_customers.id |
| warehouse_id | UUID | NO | — | FK → inv_warehouses.id |
| status | VARCHAR(50) | NO | 'draft' | draft, confirmed, shipped, delivered, cancelled |
| order_date | DATE | NO | — | Order date |
| shipping_date | DATE | YES | NULL | Ship date |
| delivery_date | DATE | YES | NULL | Delivery date |
| subtotal | DECIMAL(15,2) | NO | 0 | Subtotal |
| tax_amount | DECIMAL(15,2) | NO | 0 | Tax |
| shipping_amount | DECIMAL(15,2) | NO | 0 | Shipping cost |
| total_amount | DECIMAL(15,2) | NO | 0 | Total |
| shipping_address | TEXT | YES | NULL | Ship-to address |
| notes | TEXT | YES | NULL | Order notes |
| created_by | UUID | NO | — | FK → users.id |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |

---

#### TABLE 84: inv_sales_order_items
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| so_id | UUID | NO | — | FK → inv_sales_orders.id |
| product_id | UUID | NO | — | FK → inv_products.id |
| quantity | DECIMAL(10,2) | NO | — | Ordered quantity |
| shipped_quantity | DECIMAL(10,2) | NO | 0 | Shipped quantity |
| unit_price | DECIMAL(15,2) | NO | — | Unit price |
| tax_rate | DECIMAL(5,2) | NO | 0 | Tax rate % |
| discount_percent | DECIMAL(5,2) | NO | 0 | Discount % |
| amount | DECIMAL(15,2) | NO | — | Line total |
| created_at | TIMESTAMP | NO | NOW() | Creation time |

---

### MODULE 11 — DOCUMENTS (4 Tables)

---

#### TABLE 85: doc_folders
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| name | VARCHAR(255) | NO | — | Folder name |
| parent_id | UUID | YES | NULL | FK → doc_folders.id |
| created_by | UUID | NO | — | FK → users.id |
| is_shared | BOOLEAN | NO | false | Shared folder flag |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |
| deleted_at | TIMESTAMP | YES | NULL | Soft delete |

---

#### TABLE 86: doc_files
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| folder_id | UUID | YES | NULL | FK → doc_folders.id |
| name | VARCHAR(255) | NO | — | File name |
| description | TEXT | YES | NULL | File description |
| url | TEXT | NO | — | MinIO storage URL |
| size | BIGINT | NO | — | File size in bytes |
| mime_type | VARCHAR(100) | NO | — | MIME type |
| extension | VARCHAR(20) | YES | NULL | File extension |
| version | INTEGER | NO | 1 | Current version number |
| is_public | BOOLEAN | NO | false | Publicly accessible |
| public_token | VARCHAR(100) | YES | NULL | UNIQUE public share token |
| tags | TEXT[] | NO | '{}' | File tags |
| uploaded_by | UUID | NO | — | FK → users.id |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |
| deleted_at | TIMESTAMP | YES | NULL | Soft delete |

---

#### TABLE 87: doc_file_versions
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| file_id | UUID | NO | — | FK → doc_files.id |
| version | INTEGER | NO | — | Version number |
| url | TEXT | NO | — | Version file URL |
| size | BIGINT | NO | — | File size |
| change_summary | TEXT | YES | NULL | What changed in this version |
| uploaded_by | UUID | NO | — | FK → users.id |
| created_at | TIMESTAMP | NO | NOW() | Upload timestamp |

---

#### TABLE 88: doc_shares
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| file_id | UUID | YES | NULL | FK → doc_files.id |
| folder_id | UUID | YES | NULL | FK → doc_folders.id |
| shared_with | UUID | NO | — | FK → users.id |
| permission | VARCHAR(20) | NO | 'view' | view, edit, admin |
| shared_by | UUID | NO | — | FK → users.id |
| created_at | TIMESTAMP | NO | NOW() | Creation time |

---

### MODULE 12 — TEAM CHAT (5 Tables)

---

#### TABLE 89: chat_channels
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| name | VARCHAR(100) | NO | — | Channel name |
| description | TEXT | YES | NULL | Channel description |
| type | VARCHAR(20) | NO | 'public' | public, private, direct |
| created_by | UUID | NO | — | FK → users.id |
| is_archived | BOOLEAN | NO | false | Archived flag |
| archived_at | TIMESTAMP | YES | NULL | Archive timestamp |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |

---

#### TABLE 90: chat_channel_members
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| channel_id | UUID | NO | — | FK → chat_channels.id |
| user_id | UUID | NO | — | FK → users.id |
| role | VARCHAR(20) | NO | 'member' | owner, admin, member |
| last_read_at | TIMESTAMP | YES | NULL | Last read timestamp |
| is_muted | BOOLEAN | NO | false | Muted flag |
| joined_at | TIMESTAMP | NO | NOW() | Join timestamp |

*UNIQUE CONSTRAINT: (channel_id, user_id)*

---

#### TABLE 91: chat_messages
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| channel_id | UUID | NO | — | FK → chat_channels.id |
| user_id | UUID | NO | — | FK → users.id |
| content | TEXT | YES | NULL | Message content |
| type | VARCHAR(50) | NO | 'text' | text, file, image, system |
| parent_id | UUID | YES | NULL | FK → chat_messages.id (thread) |
| reply_count | INTEGER | NO | 0 | Thread reply count |
| is_edited | BOOLEAN | NO | false | Edited flag |
| edited_at | TIMESTAMP | YES | NULL | Edit timestamp |
| created_at | TIMESTAMP | NO | NOW() | Send timestamp |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |
| deleted_at | TIMESTAMP | YES | NULL | Soft delete |

---

#### TABLE 92: chat_message_attachments
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| message_id | UUID | NO | — | FK → chat_messages.id |
| name | VARCHAR(255) | NO | — | File name |
| url | TEXT | NO | — | File URL |
| size | BIGINT | YES | NULL | File size |
| mime_type | VARCHAR(100) | YES | NULL | MIME type |
| created_at | TIMESTAMP | NO | NOW() | Creation time |

---

#### TABLE 93: chat_reactions
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| message_id | UUID | NO | — | FK → chat_messages.id |
| user_id | UUID | NO | — | FK → users.id |
| emoji | VARCHAR(50) | NO | — | Emoji code |
| created_at | TIMESTAMP | NO | NOW() | Creation time |

*UNIQUE CONSTRAINT: (message_id, user_id, emoji)*

---

### MODULE 13 — APP BUILDER (5 Tables)

---

#### TABLE 94: builder_apps
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | — | FK → organizations.id |
| name | VARCHAR(255) | NO | — | App name |
| description | TEXT | YES | NULL | App description |
| slug | VARCHAR(100) | NO | — | URL-friendly identifier |
| icon | VARCHAR(50) | YES | NULL | Lucide icon name |
| color | VARCHAR(20) | NO | '#6366f1' | App theme color |
| status | VARCHAR(50) | NO | 'draft' | draft, published |
| settings | JSONB | NO | '{}' | App settings |
| created_by | UUID | NO | — | FK → users.id |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |
| deleted_at | TIMESTAMP | YES | NULL | Soft delete |

---

#### TABLE 95: builder_app_tables
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| app_id | UUID | NO | — | FK → builder_apps.id |
| name | VARCHAR(255) | NO | — | Table display name |
| slug | VARCHAR(100) | NO | — | Table identifier |
| description | TEXT | YES | NULL | Table description |
| icon | VARCHAR(50) | YES | NULL | Table icon |
| created_at | TIMESTAMP | NO | NOW() | Creation time |

*UNIQUE CONSTRAINT: (app_id, slug)*

---

#### TABLE 96: builder_app_fields
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| table_id | UUID | NO | — | FK → builder_app_tables.id |
| name | VARCHAR(255) | NO | — | Field display name |
| slug | VARCHAR(100) | NO | — | Field identifier |
| type | VARCHAR(50) | NO | — | text, number, date, boolean, select, multi_select, file, relation, formula, url, email, phone |
| options | JSONB | YES | NULL | Select options |
| is_required | BOOLEAN | NO | false | Required field |
| is_unique | BOOLEAN | NO | false | Unique constraint |
| default_value | TEXT | YES | NULL | Default value |
| formula | TEXT | YES | NULL | Formula expression |
| order | INTEGER | NO | 0 | Display order |
| created_at | TIMESTAMP | NO | NOW() | Creation time |

*UNIQUE CONSTRAINT: (table_id, slug)*

---

#### TABLE 97: builder_app_records
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| table_id | UUID | NO | — | FK → builder_app_tables.id |
| data | JSONB | NO | '{}' | All field values as JSON |
| created_by | UUID | YES | NULL | FK → users.id |
| updated_by | UUID | YES | NULL | FK → users.id |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |
| deleted_at | TIMESTAMP | YES | NULL | Soft delete |

---

#### TABLE 98: builder_app_views
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| app_id | UUID | NO | — | FK → builder_apps.id |
| name | VARCHAR(255) | NO | — | View name |
| type | VARCHAR(50) | NO | — | list, form, detail, calendar, kanban, gallery, map |
| table_id | UUID | YES | NULL | FK → builder_app_tables.id |
| config | JSONB | NO | '{}' | Layout, columns, filters config |
| order | INTEGER | NO | 0 | Navigation order |
| is_home | BOOLEAN | NO | false | Default/home view |
| created_at | TIMESTAMP | NO | NOW() | Creation time |
| updated_at | TIMESTAMP | NO | NOW() | Last update time |

---

## 8. Database Summary

| Module | Tables | Approx. Columns |
|--------|--------|-----------------|
| Core / Auth / Platform | 17 | ~190 |
| CRM | 12 | ~135 |
| Forms Builder | 4 | ~48 |
| Analytics & Reports | 4 | ~42 |
| Project Management | 8 | ~95 |
| HR & People | 8 | ~105 |
| Help Desk | 7 | ~75 |
| Workflow Automation | 5 | ~52 |
| Accounting | 9 | ~105 |
| Inventory | 10 | ~105 |
| Documents | 4 | ~42 |
| Team Chat | 5 | ~48 |
| App Builder | 5 | ~48 |
| **TOTAL** | **98** | **~1,090** |

---

## 9. Build Phases & Timeline

| Phase | Module | Duration | Key Deliverables |
|-------|--------|----------|-----------------|
| 1 | Foundation + Auth | Weeks 1-4 | Monorepo, Docker, Auth, Multi-tenancy, Dashboard Shell |
| 2 | CRM | Weeks 5-8 | Contacts, Companies, Leads, Deals, Pipeline |
| 3 | Forms Builder | Weeks 9-12 | Drag-drop builder, Submissions, Conditional Logic |
| 4 | Analytics & Reports | Weeks 13-16 | Dashboards, Charts, Report Builder, Schedules |
| 5 | Project Management | Weeks 17-20 | Tasks, Board, Gantt, Time Tracking |
| 6 | HR & People | Weeks 21-24 | Employees, Attendance, Leaves, Payroll |
| 7 | Help Desk | Weeks 25-28 | Tickets, SLA, Knowledge Base |
| 8 | Workflow Automation | Weeks 29-32 | Visual Builder, Triggers, Actions |
| 9 | Accounting | Weeks 33-36 | Invoices, Expenses, Bank Accounts |
| 10 | Inventory | Weeks 37-40 | Products, Stock, Purchase/Sales Orders |
| 11 | Documents + Chat | Weeks 41-44 | File Manager, Team Chat, Reactions |
| 12 | App Builder | Weeks 45-48 | Low-code Builder, Custom Tables, Views |
| 13 | Billing + Launch | Weeks 49-52 | Stripe, Admin Panel, Optimization, Launch |

---

## 10. Environment Variables

```env
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME="YourSaaS"
NODE_ENV=development

# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/saasdb"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/saasdb"

# Redis
REDIS_URL="redis://localhost:6379"

# Auth
AUTH_SECRET="your-super-secret-key-min-32-chars"
AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"
AUTH_MICROSOFT_CLIENT_ID="your-microsoft-client-id"
AUTH_MICROSOFT_CLIENT_SECRET="your-microsoft-client-secret"
AUTH_GITHUB_ID="your-github-client-id"
AUTH_GITHUB_SECRET="your-github-client-secret"

# MinIO (File Storage)
MINIO_ENDPOINT="localhost"
MINIO_PORT=9000
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin"
MINIO_BUCKET_NAME="saasplatform"
MINIO_USE_SSL=false

# Email (Mailhog for dev)
SMTP_HOST="localhost"
SMTP_PORT=1025
SMTP_USER=""
SMTP_PASS=""
EMAIL_FROM="noreply@yoursaas.com"

# Stripe (Phase 6)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
```

---

## 11. Installation Guide

### Step 1: Install pnpm
```bash
npm install -g pnpm
pnpm --version
```

### Step 2: Navigate to project folder
```bash
cd C:\xampp\htdocs\Claude
git init
```

### Step 3: Start Docker services
```bash
docker compose up -d
# This starts: PostgreSQL, Redis, MinIO, Mailhog
```

### Step 4: Install dependencies
```bash
pnpm install
```

### Step 5: Setup database
```bash
pnpm db:push        # Apply schema
pnpm db:seed        # Seed initial data
pnpm db:studio      # Open Prisma Studio (port 5555)
```

### Step 6: Start development
```bash
pnpm dev            # Starts all apps (port 3000)
```

### Access Points
| Service | URL |
|---------|-----|
| Main App | http://localhost:3000 |
| Prisma Studio | http://localhost:5555 |
| MinIO Console | http://localhost:9001 |
| Mailhog | http://localhost:8025 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

---

## 12. Module Descriptions

### 🔐 Core Platform
Multi-tenant authentication and authorization system. Supports email/password, Google OAuth, Microsoft OAuth, GitHub OAuth, MFA/2FA with TOTP, organization management, role-based access control, API keys, webhooks, and comprehensive audit logging.

### 👥 CRM (Customer Relationship Management)
Full-featured CRM with contacts, companies, leads, and deals. Includes visual sales pipeline (Kanban), activity tracking (calls, emails, meetings), notes, custom fields, and lead scoring.

### 📋 Forms Builder
Drag-and-drop form builder with 18+ field types, conditional logic, multi-step forms, custom themes, submission management, and public form sharing via unique URLs.

### 📊 Analytics & Reports
Dashboard builder with 10+ chart types, KPI cards, and customizable widget grids. Report builder for tabular, summary, and pivot reports with scheduled email delivery.

### 📁 Project Management
Full project lifecycle management with task lists, Kanban boards, Gantt charts, milestones, time tracking, and team collaboration via comments and attachments.

### 👔 HR & People
Complete HR management including employee profiles, department hierarchy, leave management, attendance tracking (with check-in/check-out), and payroll processing.

### 🎫 Help Desk
Customer support ticketing system with SLA policies, ticket categories, knowledge base, internal notes, customer portal, and performance reports.

### 🔄 Workflow Automation
Visual workflow builder with event-based triggers, conditional branching, delay steps, app integrations (Slack, Gmail, Sheets, etc.), and detailed run logs.

### 💰 Accounting
Small business accounting with chart of accounts, invoicing, expense tracking, bank account management, transaction reconciliation, and financial reports.

### 📦 Inventory
Product catalog with multi-warehouse stock management, purchase orders, sales orders, stock movement tracking, and low-stock alerts.

### 📄 Documents
File storage and management with folder hierarchy, version control, file sharing, access permissions, and MinIO-backed secure storage.

### 💬 Team Chat
Real-time team communication with public/private channels, direct messages, threaded replies, emoji reactions, and file sharing.

### 🏗️ App Builder
Low-code application builder allowing users to create custom apps with their own tables, fields, views (list, form, kanban, calendar, gallery), and workflows — without writing code.

---

*End of Documentation*

---
**Generated:** 2026-05-27 | **Platform:** SaaS Platform v1.0 | **Author:** Mohit Yadav
