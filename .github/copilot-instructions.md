# GitHub Copilot Instructions — Pathology Lab Management System

## Project purpose

Full-stack demo of a **Pathology Laboratory Management System**.
Covers patient registration, test ordering, sample tracking, result entry, billing, payments,
and administrative monitoring. All data is fictional demo data.

See [AGENTS.md](../AGENTS.md) for the full technology stack and architecture overview.

## Repository layout

```
apps/web/     Next.js 15 App Router frontend
apps/api/     NestJS backend (modular monolith)
packages/shared/  Shared TS types only (no runtime deps)
docs/         Architecture, schema, API, feature specs
.github/instructions/  Path-scoped detailed instructions
```

## Package manager

Use **pnpm** exclusively. Never use `npm install` or `yarn` inside this repo.

```bash
pnpm install                    # install all workspaces
pnpm --filter api <script>      # run a script in apps/api
pnpm --filter web <script>      # run a script in apps/web
```

## Architecture boundaries

- Controllers → HTTP only (parse request, call service, return response).
- Services → all business logic, validation rules, state machines.
- Prisma client → only accessed from services or dedicated repository classes.
- Frontend → calls REST API only; never accesses DB or bypasses auth.
- `packages/shared` → pure TypeScript types and Zod schemas; no Node or browser APIs.

## Security requirements

- Every protected endpoint must have `@UseGuards(JwtAuthGuard, RolesGuard)`.
- Never trust client-supplied prices, totals, roles, or actor identity.
- Financial totals calculated server-side using `Decimal` arithmetic.
- Passwords hashed with bcrypt (≥12 rounds). Never logged or returned in responses.
- JWT delivered via HTTP-only `Secure` cookie. Never in `localStorage`.
- Use DB transactions for any operation touching multiple related records.
- Audit events are append-only; no update/delete routes exist for them.

## Conventions

- API prefix: `/api/v1`
- Response envelope: `{ data, meta?, message? }` for success; `{ statusCode, message, errors? }` for errors.
- Monetary values stored as `Decimal` in Prisma (maps to `NUMERIC(12,2)` in Postgres).
- Dates stored as UTC; displayed in IST (`Asia/Kolkata`) on the frontend.
- Currency: INR (₹). Format with `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`.
- Enum values: `SCREAMING_SNAKE_CASE` in DB/backend; same values exposed to frontend.
- File naming: `kebab-case` for files, `PascalCase` for classes/components, `camelCase` for functions.

## Testing and verification

- Run `pnpm typecheck` and `pnpm lint` before committing.
- Backend: Jest unit tests for services; Supertest integration tests for controllers.
- Frontend: Vitest + Testing Library for components and hooks.
- Never weaken authorization or skip guards to make tests pass.
- Never mark a feature complete if its tests are failing or skipped.

## Before changing any feature

Read the relevant instruction file in `.github/instructions/` first:

| Feature area              | Instruction file                                      |
|---------------------------|-------------------------------------------------------|
| Architecture              | `architecture.instructions.md`                        |
| Frontend                  | `frontend.instructions.md`                            |
| Backend                   | `backend.instructions.md`                             |
| Database                  | `database.instructions.md`                            |
| Auth / RBAC / Audit       | `auth-rbac-audit.instructions.md`                     |
| Patients / Orders         | `patients-orders-samples.instructions.md`             |
| Billing / Payments        | `billing-payments.instructions.md`                    |
| Results / Reports         | `results-reports.instructions.md`                     |
| Testing                   | `testing.instructions.md`                             |

## Additional rules

- Do not refactor unrelated code while implementing a feature.
- Do not add dependencies without a clear justification.
- Document significant design decisions in the relevant `docs/` file.
- Do not duplicate business rules between frontend and backend.
- Do not remove existing tests or weaken assertions.
