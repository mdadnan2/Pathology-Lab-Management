---
applyTo: "apps/api/src/modules/auth/**,apps/api/src/modules/users/**,apps/api/src/modules/roles/**,apps/api/src/common/guards/**"
---

# Auth, RBAC, and Audit Instructions

## Authentication

- JWT delivered as HTTP-only `Secure` `SameSite=Strict` cookie named `access_token`
- Token expiry: 8 hours (configurable via `JWT_EXPIRES_IN` env var)
- Password hashing: bcrypt with ≥12 salt rounds
- Login endpoint: `POST /api/v1/auth/login` — returns user profile (no token in body)
- Logout endpoint: `POST /api/v1/auth/logout` — clears the cookie
- Profile endpoint: `GET /api/v1/auth/me` — returns current user from JWT
- Never return password hash in any response
- Never store JWT in localStorage; cookie transport only

## Roles

```ts
enum Role {
  OWNER        // full system access
  ADMIN        // lab operations management
  RECEPTIONIST // patient registration, billing
  TECHNICIAN   // sample processing, result entry
  PATHOLOGIST  // result review, report approval
}
```

## Guards

```ts
// Require authentication
@UseGuards(JwtAuthGuard)

// Require authentication + specific roles
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER, Role.ADMIN)
```

`JwtStrategy` resolves the active user from the database on every request.
`RolesGuard` authorizes using this authenticated server-side user, never a role
supplied in the request body.

## Permission matrix summary

See full matrix: [docs/permissions-matrix.md](../../docs/permissions-matrix.md)

| Operation                        | OWNER | ADMIN | RECEPTIONIST | TECHNICIAN | PATHOLOGIST |
|----------------------------------|-------|-------|--------------|------------|-------------|
| Manage users & roles             | ✓     | ✓*    | ✗            | ✗          | ✗           |
| Manage test catalogue & prices   | ✓     | ✓     | ✗            | ✗          | ✗           |
| Register / edit patients         | ✓     | ✓     | ✓            | ✗          | ✗           |
| Create orders                    | ✓     | ✓     | ✓            | ✗          | ✗           |
| Update sample status             | ✓     | ✓     | ✗            | ✓          | ✗           |
| Enter test results               | ✓     | ✓     | ✗            | ✓          | ✗           |
| Approve / finalize reports       | ✓     | ✓     | ✗            | ✗          | ✓           |
| Create invoices                  | ✓     | ✓     | ✓            | ✗          | ✗           |
| Record payments                  | ✓     | ✓     | ✓            | ✗          | ✗           |
| View financial dashboard         | ✓     | ✓     | ✗            | ✗          | ✗           |
| View audit logs                  | ✓     | ✓     | ✗            | ✗          | ✗           |

*ADMIN cannot manage OWNER accounts or change immutable audit history.

## Audit events

Emit an `AuditEvent` for every significant action via `AuditService.log()`:

```ts
interface AuditEventPayload {
  actorId: string;        // from JWT — never from request body
  action: AuditAction;    // enum: USER_LOGIN, PATIENT_CREATED, ORDER_CREATED, etc.
  entityType: string;     // 'Patient', 'Invoice', 'Payment', etc.
  entityId: string;
  metadata?: Record<string, unknown>;  // before/after for important field changes
}
```

Audit events:
- Are append-only — no update or delete endpoints
- Actor identity always comes from the authenticated server-side context
- Must not contain passwords, full card numbers, or unnecessary PII
- Are paginated and filterable in the admin audit log view

## User management rules

- Only OWNER can create or manage OWNER and ADMIN accounts
- ADMIN can manage RECEPTIONIST, TECHNICIAN, PATHOLOGIST accounts
- Password reset generates a random, one-time temporary password and requires a
  password change before access to protected workflows
- Deactivated users cannot log in; their historical records remain intact
