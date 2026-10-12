---
applyTo: "apps/api/prisma/**,apps/api/src/**/*.ts"
---

# Database Instructions

## Prisma conventions

- Schema file: `apps/api/prisma/schema.prisma`
- Migrations: `apps/api/prisma/migrations/` — always version-controlled
- Seed script: `apps/api/prisma/seed.ts`
- Never make manual schema changes to the database; always use `prisma migrate dev`

## Naming

- Model names: `PascalCase` singular (`Patient`, `LabOrder`, `Invoice`)
- Field names: `camelCase` (`createdAt`, `patientId`, `totalAmount`)
- Enum names: `PascalCase` (`OrderStatus`, `PaymentMethod`)
- Enum values: `SCREAMING_SNAKE_CASE` (`SAMPLE_COLLECTED`, `PARTIALLY_PAID`)
- Table names: Prisma maps to `snake_case` plural via `@@map`

## Monetary values

- Store as `Decimal` in Prisma (`@db.Decimal(12, 2)`)
- Maps to `NUMERIC(12,2)` in PostgreSQL
- Never use JavaScript `number` for financial arithmetic — use the `Decimal.js` library
- Return monetary values as strings from the API to avoid JS float precision loss

## Indexes

Add indexes for:
- All foreign keys (Prisma adds these automatically for relations)
- Fields used in frequent WHERE clauses: `patientId`, `orderId`, `invoiceId`, `status`, `createdAt`
- Unique constraints: `patientCode`, `orderNumber`, `invoiceNumber`, `sampleId`

## Soft deletes and immutability

- Never hard-delete: `Patient`, `LabOrder`, `Invoice`, `Payment`, `AuditEvent`
- Use `isActive Boolean @default(true)` or `cancelledAt DateTime?` for soft deletion
- `AuditEvent` records must have no update or delete routes

## Relations and integrity

- Use explicit `onDelete` behavior: `Cascade` only where child records are meaningless without parent
- Use `Restrict` for financial records (cannot delete a patient with invoices)
- Always define both sides of a relation

## Key models summary

```
User            — staff accounts, hashed passwords, role
Patient         — registration, unique patientCode
TestCategory    — Hematology, Biochemistry, etc.
LabTest         — test catalogue entry, price, parameters
TestParameter   — individual result parameters per test
TestPackage     — named bundle of tests
LabOrder        — order header, patient, status
LabOrderItem    — one test per item, priceSnapshot
Sample          — physical sample, sampleId, status
TestResult      — result for one LabOrderItem
ResultParameter — value for one TestParameter
LabReport       — approved report, PDF path
Invoice         — billing header, totals
InvoiceItem     — one line per test, priceSnapshot
Payment         — payment record, method, amount
FinancialAdjustment — discount, reversal, cancellation
AuditEvent      — append-only activity log
```

Full schema documented in [docs/database-schema.md](../../docs/database-schema.md).

## Seed data rules

- All seeded data is clearly fictional demo data
- Seed is idempotent: use `upsert` with stable unique keys
- Seed creates: 3 admin/owner accounts, 12 staff accounts, test catalogue, packages, patients, orders, invoices, payments
- Seed script: `apps/api/prisma/seed.ts`, run with `pnpm db:seed`
- Never seed real patient names, real medical results, or real financial data
