---
applyTo: "apps/**/*.ts,apps/**/*.tsx,packages/**/*.ts"
---

# Architecture Instructions

## Module boundaries

```
apps/api/src/
  modules/
    auth/           JWT auth, login, logout, token refresh
    users/          User CRUD, password management
    roles/          Role and permission definitions
    patients/       Patient registration, search, history
    test-catalogue/ LabTest, TestCategory, TestParameter
    test-packages/  TestPackage, TestPackageItem
    orders/         LabOrder, LabOrderItem, price snapshots
    samples/        Sample records, status transitions
    results/        TestResult, ResultParameter entry
    reports/        LabReport, PDF generation, approval
    billing/        Invoice, InvoiceItem
    payments/       Payment, FinancialAdjustment
    dashboard/      Aggregated KPI queries
    audit/          AuditEvent, append-only log
    health/         /health endpoint
  common/
    guards/         JwtAuthGuard, RolesGuard
    decorators/     @CurrentUser, @Roles
    filters/        GlobalExceptionFilter
    interceptors/   ResponseTransformInterceptor, LoggingInterceptor
    pipes/          ValidationPipe config
    prisma/         PrismaService (singleton)
    types/          Shared backend types
```

## Dependency direction

```
Controller → Service → PrismaService
Controller → Service → other Services (same or imported module)
```

Never import a controller from another module.
Never import PrismaService directly into a controller.
Never import frontend code into the backend.

## REST API conventions

- Base prefix: `/api/v1`
- Resource naming: plural nouns (`/patients`, `/orders`, `/invoices`)
- Nested resources where ownership is clear: `/orders/:id/items`, `/invoices/:id/payments`
- HTTP verbs: GET (read), POST (create), PATCH (partial update), DELETE (soft delete/cancel)
- Never use GET for state-changing operations

## Response envelope

Success:
```json
{ "data": <payload>, "meta": { "page": 1, "total": 42 }, "message": "optional" }
```

Error:
```json
{ "statusCode": 400, "message": "Validation failed", "errors": ["field: reason"] }
```

## Naming conventions

- Files: `kebab-case.ts`
- Classes: `PascalCase`
- Functions/variables: `camelCase`
- DB enum values: `SCREAMING_SNAKE_CASE`
- Constants: `SCREAMING_SNAKE_CASE`
- React components: `PascalCase` in `PascalCase.tsx`

## Error handling

- Use NestJS built-in exceptions (`NotFoundException`, `BadRequestException`, `ForbiddenException`, etc.)
- Global exception filter normalizes all errors to the envelope above
- Never swallow exceptions or return fake success
- Log errors with context (module, operation, entity id) — never log passwords or tokens

## Shared contracts (`packages/shared`)

Only place here:
- TypeScript interfaces/types used by both frontend and backend
- Zod schemas for shared validation (must have zero runtime dependencies on Node or browser APIs)

Do not place NestJS decorators, Prisma types, or React hooks in `packages/shared`.
