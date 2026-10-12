# AGENTS.md — Pathology Lab Management System

## What this project does

A full-stack demo of a **Pathology Laboratory Management System** for a real prospective client.
It covers patient registration, diagnostic test ordering, sample tracking, result entry, report
generation, billing, payments, and administrative monitoring — all scoped to diagnostic pathology
operations, not a generic hospital or pharmacy system.

All seeded patients, staff, results, invoices, and transactions are **fictional demo data**.

## Technology stack

| Layer      | Technology                                                                 |
|------------|----------------------------------------------------------------------------|
| Frontend   | Next.js 15 (App Router), React, TypeScript strict, Tailwind CSS, shadcn/ui |
| Forms      | React Hook Form + Zod                                                      |
| Data fetch | TanStack Query v5                                                          |
| Charts     | Recharts                                                                   |
| Icons      | Lucide React                                                               |
| Backend    | NestJS, TypeScript strict, REST, Swagger/OpenAPI                           |
| Validation | class-validator + class-transformer                                        |
| Database   | PostgreSQL 16, Prisma ORM, versioned migrations                            |
| Auth       | JWT via HTTP-only cookies, bcrypt password hashing                         |
| Testing    | Jest + Supertest (backend), Vitest + Testing Library (frontend)            |
| Tooling    | pnpm workspaces, ESLint, Prettier, Docker Compose                          |

## High-level architecture

```
apps/
  web/          Next.js frontend (App Router, RSC + client components)
  api/          NestJS backend (modular monolith)
packages/
  shared/       Shared TypeScript types and Zod schemas (no Node/browser deps)
docs/           Architecture, schema, API, feature specs, implementation plan
.github/
  instructions/ Path-scoped AI coding instructions
  copilot-instructions.md
AGENTS.md       ← this file
```

The backend is a **modular monolith** organized around business responsibilities.
Controllers are thin (HTTP only). Services own business logic. Prisma handles persistence.
The frontend never connects directly to PostgreSQL or bypasses backend authorization.

## Most important coding and security rules

1. Inspect existing code before editing any file.
2. Never place business logic in controllers or React components.
3. Validate all incoming data on the server (class-validator DTOs).
4. Apply auth guards and role guards to every protected endpoint.
5. Never trust prices, totals, roles, or audit actors from the client.
6. Calculate financial totals server-side; use `Decimal` / integer cents — no JS float math.
7. Use database transactions for multi-record financial or status operations.
8. Never commit secrets, passwords, or real credentials — use `.env` (gitignored).
9. Prefer explicit TypeScript types; avoid `any`; justify exceptions with a comment.
10. Do not physically delete invoices, payments, or audit events — use soft cancellation.
11. Enforce permissions in backend guards/services; hiding a UI button is not security.
12. Use migrations for all schema changes; never make untracked manual DB changes.

## Where detailed feature instructions live

| Topic                        | File                                                              |
|------------------------------|-------------------------------------------------------------------|
| Architecture & conventions   | [.github/instructions/architecture.instructions.md](.github/instructions/architecture.instructions.md) |
| Frontend                     | [.github/instructions/frontend.instructions.md](.github/instructions/frontend.instructions.md) |
| Backend                      | [.github/instructions/backend.instructions.md](.github/instructions/backend.instructions.md) |
| Database                     | [.github/instructions/database.instructions.md](.github/instructions/database.instructions.md) |
| Auth, RBAC & audit           | [.github/instructions/auth-rbac-audit.instructions.md](.github/instructions/auth-rbac-audit.instructions.md) |
| Patients, orders & samples   | [.github/instructions/patients-orders-samples.instructions.md](.github/instructions/patients-orders-samples.instructions.md) |
| Billing & payments           | [.github/instructions/billing-payments.instructions.md](.github/instructions/billing-payments.instructions.md) |
| Results & reports            | [.github/instructions/results-reports.instructions.md](.github/instructions/results-reports.instructions.md) |
| Testing                      | [.github/instructions/testing.instructions.md](.github/instructions/testing.instructions.md) |

## Where documentation lives

| Document                     | Path                                                  |
|------------------------------|-------------------------------------------------------|
| Architecture                 | [docs/architecture.md](docs/architecture.md)          |
| Database schema              | [docs/database-schema.md](docs/database-schema.md)    |
| API design                   | [docs/api-design.md](docs/api-design.md)              |
| Permissions matrix           | [docs/permissions-matrix.md](docs/permissions-matrix.md) |
| Implementation plan          | [docs/implementation-plan.md](docs/implementation-plan.md) |
| Demo guide                   | [docs/demo-guide.md](docs/demo-guide.md)              |
| Feature: patients/orders     | [docs/feature-specs/patients-orders-samples.md](docs/feature-specs/patients-orders-samples.md) |
| Feature: billing/payments    | [docs/feature-specs/billing-payments.md](docs/feature-specs/billing-payments.md) |
| Feature: results/reports     | [docs/feature-specs/results-reports.md](docs/feature-specs/results-reports.md) |
| Feature: admin dashboard     | [docs/feature-specs/admin-dashboard-audit.md](docs/feature-specs/admin-dashboard-audit.md) |

## How to run the application

### Prerequisites
- Node.js ≥ 20, pnpm ≥ 9
- Docker Desktop (for PostgreSQL) **or** a local PostgreSQL 16 instance

### Quick start

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Install all dependencies
pnpm install

# 3. Configure environment variables
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# Edit both files with your local values

# 4. Run migrations
pnpm db:migrate

# 5. Seed demo data
pnpm db:seed

# 6. Start both apps in development
pnpm dev
# Frontend: http://localhost:3000
# Backend:  http://localhost:3001
# Swagger:  http://localhost:3001/api/docs
```

### Useful commands

```bash
pnpm db:studio          # Prisma Studio GUI
pnpm db:reset           # Drop, re-migrate, re-seed (dev only)
pnpm lint               # ESLint across all packages
pnpm typecheck          # tsc --noEmit across all packages
pnpm test               # Jest (api) + Vitest (web)
pnpm build              # Production build
```

## Rule for narrower instructions

When working on a specific feature, **always read the corresponding `.instructions.md` file**
listed in the table above before making changes. Those files contain domain rules, field
constraints, state-machine definitions, and security requirements that are not repeated here.
