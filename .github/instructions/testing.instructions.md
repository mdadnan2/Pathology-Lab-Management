---
applyTo: "apps/api/**/*.spec.ts,apps/api/**/*.e2e-spec.ts,apps/web/**/*.test.ts,apps/web/**/*.test.tsx,apps/web/**/*.spec.ts"
---

# Testing Instructions

## Backend testing (Jest + Supertest)

### Unit tests — services
- File: `[feature].service.spec.ts` alongside the service
- Mock `PrismaService` using `jest.mock` or a manual mock
- Mock `AuditService` to verify audit events are emitted
- Test: happy path, validation failures, not-found cases, forbidden cases, state-machine violations
- Financial calculations must be tested with exact `Decimal` comparisons

### Integration tests — controllers
- File: `[feature].controller.spec.ts` or `test/[feature].e2e-spec.ts`
- Use `@nestjs/testing` `TestingModule` with a real in-memory or test DB
- Use Supertest to make HTTP requests
- Test: authentication required (401), wrong role (403), valid request (2xx), invalid body (400)
- Never weaken guards to make tests pass

### Test database
- Use a separate `TEST_DATABASE_URL` pointing to a test PostgreSQL database
- Run `prisma migrate deploy` before test suite
- Clean relevant tables between tests using `beforeEach` transactions or truncation

## Frontend testing (Vitest + Testing Library)

### Component tests
- File: `[Component].test.tsx` alongside the component
- Use `@testing-library/react` with `render`, `screen`, `userEvent`
- Mock API calls using `msw` (Mock Service Worker) or `vi.mock`
- Test: renders correctly, shows loading state, shows error state, shows empty state, user interactions

### Hook tests
- File: `use[Hook].test.ts`
- Use `renderHook` from `@testing-library/react`
- Wrap with `QueryClientProvider` for TanStack Query hooks

## Coverage requirements

Prioritize testing:
1. Financial calculation logic (billing service, payment service)
2. State machine transitions (order status, sample status, result status)
3. Authorization guards (correct roles can/cannot access endpoints)
4. Invoice and payment creation (correct totals, correct audit events)
5. Report approval workflow (cannot approve without all results approved)

## Test data

- Use factory functions or fixtures for test data — not copy-pasted objects
- Never use production seed data in tests
- Use `faker` or hardcoded fictional values for test entities

## Running tests

```bash
# Backend unit + integration tests
pnpm --filter api test
pnpm --filter api test:cov    # with coverage

# Frontend component tests
pnpm --filter web test        # Vitest + Testing Library

# All tests
pnpm test
```

## Rules

- Never skip failing tests with `.skip` without a documented reason
- Never use `any` in test assertions
- Never mock the module under test — only its dependencies
- Tests must be deterministic — no random data without seeded randomness
