# ZenFlow

> **"Everything Flows."**

A full-featured SaaS platform — the open-source Zoho alternative built with the modern JavaScript stack.

## 🎨 Brand

| Token | Value |
|-------|-------|
| Primary | `#6366f1` Indigo |
| Secondary | `#8b5cf6` Violet |
| Accent | `#06b6d4` Cyan |

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router + RSC) |
| Language | TypeScript 5.x |
| Styling | Tailwind CSS + Shadcn/UI |
| API | tRPC v11 |
| ORM | Prisma v6 + PostgreSQL 16 |
| Auth | Auth.js v5 (Google / Microsoft / GitHub + TOTP MFA) |
| Queue | BullMQ v5 + Redis 7 |
| Storage | MinIO (S3-compatible) |
| Realtime | Socket.io |
| Monorepo | Turborepo + pnpm workspaces |

## 📦 Modules (13)

1. **Core Platform** — Auth, Multi-tenancy, RBAC, Billing
2. **CRM** — Contacts, Leads, Deals, Pipeline
3. **Forms Builder** — Drag-and-drop, Conditional logic, Webhooks
4. **Analytics** — Dashboards, Charts, Reports, KPIs
5. **Project Management** — Tasks, Boards, Gantt, Sprints
6. **HR** — Employees, Leave, Attendance, Payroll
7. **Help Desk** — Tickets, SLA, Knowledge Base
8. **Accounting** — Invoices, Expenses, P&L
9. **Inventory** — Products, Stock, Purchase Orders
10. **Workflow Automation** — Triggers, Actions, Integrations
11. **Documents** — Rich editor, Version control, Sharing
12. **Team Chat** — Channels, DMs, Threads, File sharing
13. **App Builder** — No-code custom apps

## 🛠️ Local Development

### Prerequisites
- Node.js 20+
- pnpm 9+
- Docker Desktop

### Setup

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/zenflow.git
cd zenflow

# Install dependencies
pnpm install

# Start infrastructure (DB, Redis, MinIO, Mail)
docker-compose up -d

# Setup database
pnpm db:push
pnpm db:seed

# Start development server
pnpm dev
```

### Services (Docker)

| Service | URL |
|---------|-----|
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |
| MinIO | `http://localhost:9000` |
| MinIO Console | `http://localhost:9001` |
| Mailhog | `http://localhost:8025` |

## 📁 Project Structure

```
zenflow/
├── apps/
│   └── web/                 # Next.js 15 main app
├── packages/
│   ├── db/                  # Prisma schema + client
│   ├── ui/                  # Shared Shadcn/UI components
│   ├── auth/                # Auth.js config
│   ├── config/              # Shared configs (eslint, tsconfig)
│   └── trpc/                # tRPC routers + context
├── docker-compose.yml
├── turbo.json
└── package.json
```

## 📄 License

MIT © 2026 Mohit Yadav / Mobilise App Lab Private Limited
