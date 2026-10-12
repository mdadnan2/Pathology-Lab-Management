# Architecture — Pathology Lab Management System

## Overview

A full-stack monorepo demo of a Pathology Laboratory Management System.
The system manages daily laboratory operations: patient registration, diagnostic test ordering,
sample processing, result entry, report generation, billing, and administrative monitoring.

**All data is fictional demo data. Not for clinical use.**

## Repository structure

```
pathology-lab-management/
├── apps/
│   ├── web/          Next.js 15 (App Router) — frontend
│   └── api/          NestJS — backend REST API
├── packages/
│   └── shared/       Shared TypeScript types and Zod schemas
├── docs/             Architecture, schema, API, feature specs
├── .github/
│   ├── copilot-instructions.md
│   └── instructions/ Path-scoped AI coding instructions
├── docker-compose.yml
├── pnpm-workspace.yaml
└── AGENTS.md
```

## Frontend (`apps/web`)

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS + shadcn/ui
- **Forms**: React Hook Form + Zod
- **Data fetching**: TanStack Query v5
- **Charts**: Recharts
- **Icons**: Lucide React

### Route structure

```
app/
  (auth)/
    login/            Public login page
  (dashboard)/
    layout.tsx        Protected layout with sidebar + topnav
    page.tsx          Dashboard (redirect to /dashboard)
    dashboard/        KPI cards, charts, activity feed
    patients/         Patient list, registration, detail
    test-catalogue/   Test list, add/edit tests
    test-packages/    Package list, add/edit packages
    orders/           Order list, create order, order detail
    samples/          Sample tracking board
    results/          Result entry per order
    reports/          Report list, view/download report
    billing/          Invoice list, invoice detail
    payments/         Payment recording, payment history
    staff/            Staff list, add/edit staff (admin only)
    audit/            Audit log (admin/owner only)
    settings/         Lab settings (owner only)
```

## Backend (`apps/api`)

- **Framework**: NestJS (modular monolith)
- **Language**: TypeScript (strict)
- **API style**: REST, versioned at `/api/v1`
- **Documentation**: Swagger at `/api/docs` (dev only)
- **Auth**: JWT via HTTP-only cookies, bcrypt passwords
- **ORM**: Prisma
- **Database**: PostgreSQL 16

### Module map

```
src/
  modules/
    auth/             Login, logout, JWT strategy, profile
    users/            User CRUD, password management
    roles/            Role definitions, permission checks
    patients/         Patient registration, search, history
    test-catalogue/   LabTest, TestCategory, TestParameter CRUD
    test-packages/    TestPackage, TestPackageItem CRUD
    orders/           LabOrder creation, status management
    samples/          Sample tracking, status transitions
    results/          TestResult, ResultParameter entry
    reports/          LabReport, PDF generation, approval
    billing/          Invoice, InvoiceItem management
    payments/         Payment recording, adjustments
    dashboard/        Aggregated KPI and activity queries
    audit/            AuditEvent log (read-only API)
    health/           /health endpoint
  common/
    guards/           JwtAuthGuard, RolesGuard
    decorators/       @CurrentUser(), @Roles()
    filters/          GlobalExceptionFilter
    interceptors/     ResponseTransformInterceptor
    pipes/            Global ValidationPipe
    prisma/           PrismaService singleton
```

## Shared package (`packages/shared`)

Contains only:
- TypeScript interfaces mirroring API response shapes
- Zod schemas for shared validation (no Node/browser runtime deps)

## Data flow

```
Browser → Next.js (RSC/Client) → REST API (/api/v1) → NestJS Service → Prisma → PostgreSQL
```

- Frontend never accesses PostgreSQL directly
- All authorization enforced in NestJS guards and services
- Financial calculations performed server-side only

## Security architecture

- JWT in HTTP-only `Secure` `SameSite=Strict` cookie (8h expiry)
- bcrypt password hashing (12 rounds)
- Role-based access control via `RolesGuard`
- Global `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true`
- All monetary arithmetic uses `Decimal.js`
- DB transactions for multi-record financial operations
- Audit events are append-only

## Infrastructure

- **Local dev**: Docker Compose for PostgreSQL
- **Package manager**: pnpm workspaces
- **Environment**: `.env` files (gitignored), `.env.example` committed

## Key design decisions

1. **Monorepo with pnpm workspaces** — simplifies cross-package type sharing and unified scripts.
2. **Modular NestJS monolith** — avoids microservice complexity for a demo; modules can be extracted later.
3. **HTTP-only cookie auth** — prevents XSS token theft vs localStorage.
4. **Price snapshots on order items** — ensures historical invoice accuracy when catalogue prices change.
5. **Decimal arithmetic** — prevents floating-point errors in financial calculations.
6. **Append-only audit log** — ensures tamper-evident activity history.
7. **Server-side PDF generation** — prevents XSS via user-supplied report content.
