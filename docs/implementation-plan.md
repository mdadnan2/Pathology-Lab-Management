# Implementation Plan — Pathology Lab Management System

## Current status: Phase 3 — implementation complete; database verification pending

The repository now has a runnable Next.js/NestJS foundation and the first
authentication and staff-administration workflows. The configured PostgreSQL
target could not be reached with the demo credentials in this environment, so
database migration application, seeding, and live HTTP verification remain
pending. Do not describe the application as complete or ready for clinical use.

## Phase 0 — Repository inspection and AI instructions

**Complete.** Existing workspace, source modules, instructions, schema, and
specifications were inspected before implementation. Existing code was retained
and extended.

## Phase 1 — Project foundation

**Implementation complete; local database/runtime verification pending.**

- [x] NestJS application module and bootstrap with `/api/v1` prefix.
- [x] Global DTO validation, exception envelope, response transform, cookie
  parser, credentialed CORS, and shutdown hooks.
- [x] Development-only Swagger documentation.
- [x] PostgreSQL readiness endpoint at `GET /api/v1/health`.
- [x] Prisma client generation and versioned initial migration for the existing
  schema.
- [x] Next.js App Router scaffold, Tailwind CSS, shadcn/ui base components,
  TanStack Query provider, and Axios API client.
- [x] Login and authenticated dashboard layouts, including loading and error
  handling.
- [x] API and web `.env.example` files.
- [x] API and web production builds, lint, and TypeScript checks.
- [x] Production web server returned HTTP 200 for the rendered login page.
- [ ] Apply the migration and seed against the configured PostgreSQL instance.
- [ ] Start both HTTP servers and verify API health, Swagger, and the browser
  login flow end to end.

## Phase 2 — Authentication and administration

**In progress.**

- [x] Cookie-based login/logout and authenticated profile endpoints.
- [x] bcrypt password hashing with 12 rounds; no password hash or JWT in the
  login response.
- [x] Role guard applied alongside authentication on protected feature
  controllers; user role is loaded from the database for each authenticated
  request.
- [x] OWNER-only creation and assignment of OWNER/ADMIN accounts; ADMIN is
  limited to managing reception, technician, and pathologist accounts.
- [x] Staff directory UI with search, pagination, account creation, and
  deactivation.
- [x] Random one-time reset passwords, hashed at rest and forced to change
  before staff can access protected workflows.
- [x] Fictional, idempotent seed for 3 administrative and 12 staff accounts.
  Password comes from local `DEMO_USER_PASSWORD`; no credentials are committed.
- [x] Append-only audit endpoint and audit logging for auth and user actions.
- [x] Unit tests for password workflows, password-change gate, and role
  boundaries.
- [ ] Apply schema migration and seed the local database.
- [ ] Verify 401/403 and complete browser/API auth flows against live PostgreSQL.

## Phase 3 — Patients, catalogue, orders, and samples

**Implementation complete; live database and browser/API workflow verification
remain pending.**

- [x] Patient, catalogue, package, order, and sample API modules exist.
- [x] Validate patient demographics and warn on duplicate phone numbers.
- [x] Create orders from individual tests or fixed-price packages, recording
  test/price snapshots and creating samples and invoices in one transaction.
- [x] Preserve package totals exactly when expanding package prices across
  order-item snapshots.
- [x] Enforce sample state transitions; sample collection/processing updates
  order and eligible order-item statuses without advancing result/report state.
- [x] Seed 15 fictional patients, 15 illustrative tests, 4 packages, and 15
  sample orders with invoices across initial/collection/processing states.
- [x] Build patient list/detail/registration, test catalogue/package browsing,
  order creation/list/detail, and sample tracking screens.
- [x] Add backend service tests across all API feature modules and frontend
  component/page tests for authentication, dashboard, staff, patients,
  catalogue, orders, and samples.
- [ ] Verify end-to-end patient-to-order workflow.

## Phase 4 — Billing and payment tracking

**Not verified; implementation and transaction tests remain.**

- [ ] Complete invoice, payment, balance, cancellation, and adjustment flows.
- [ ] Verify exact Decimal arithmetic, duplicate-submit protection, and audit
  events.
- [ ] Build billing, payments, receipts, collections, and dues screens.
- [ ] Seed fictional invoices and payments.

## Phase 5 — Results and reports

**Implementation and focused unit/UI tests complete; live database/browser verification remains.**

- [x] Add result draft entry, server-side abnormal flags, submission, review, approval, and rejection/re-entry state transitions.
- [x] Restrict result entry/review/report actions to their required roles on the API and in navigation/UI.
- [x] Prevent report generation unless every order item has an approved result.
- [x] Build report generation, approval, authenticated PDF delivery, and delivery audit events.
- [x] Add illustrative demo parameter ranges, a submitted review example, and a report-awaiting-approval example to the idempotent seed.
- [x] Add focused results/report service and role-aware UI tests.
- [ ] Verify the seeded workflow against a clean local PostgreSQL database and exercise it in the browser.

## Phase 6 — Dashboard and operational monitoring

**The current dashboard is a system-readiness placeholder, not an operational
KPI dashboard.**

- [ ] Derive operational and financial KPIs from persisted records.
- [ ] Add collection, invoice, bill-activity, and audit views.
- [ ] Verify summaries against source records.

## Phase 7 — Quality and demo readiness

- [x] API and web type checks and lint checks.
- [x] API unit suite: 12 suites, 37 tests passing.
- [x] Web component and API-client suite: 2 files, 17 tests passing.
- [x] Prisma schema validation and frozen-lockfile installation.
- [ ] Run migrations and seed from a clean PostgreSQL database.
- [ ] Run the complete workspace test suite and browser/API workflows.
- [ ] Update all feature documentation as their implementation is completed.
- [ ] Finalize demo guide after features and limitations are verified.

## Environment blockers

- Docker Desktop is not running.
- Local PostgreSQL services are running, but the configured `pathlab` credentials
  do not authenticate to the local `pathlab_db`; no migration or database writes
  were attempted.
- The full application has not yet been started or verified through HTTP.

## Next steps

1. Configure `DATABASE_URL` for a PostgreSQL database controlled by this demo.
2. Apply `pnpm db:migrate`, then set a private `DEMO_USER_PASSWORD` and run
   `pnpm db:seed`.
3. Start the API and web app, then verify login, forced password change, roles,
   and health checks end to end.
4. Apply the migration and seed, then verify patient-to-order/sample workflows
   against the configured local database.
