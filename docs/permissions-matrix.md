# Permissions Matrix — Pathology Lab Management System

✓ = Allowed | ✗ = Denied | ✓* = Allowed with restrictions

## User and role management

| Operation                          | OWNER | ADMIN | RECEPTIONIST | TECHNICIAN | PATHOLOGIST |
|------------------------------------|-------|-------|--------------|------------|-------------|
| Create OWNER account               | ✓     | ✗     | ✗            | ✗          | ✗           |
| Create ADMIN account               | ✓     | ✗     | ✗            | ✗          | ✗           |
| Create RECEPTIONIST account        | ✓     | ✓     | ✗            | ✗          | ✗           |
| Create TECHNICIAN account          | ✓     | ✓     | ✗            | ✗          | ✗           |
| Create PATHOLOGIST account         | ✓     | ✓     | ✗            | ✗          | ✗           |
| Deactivate any account             | ✓     | ✓*    | ✗            | ✗          | ✗           |
| Reset any password                 | ✓     | ✓*    | ✗            | ✗          | ✗           |
| View staff list                    | ✓     | ✓     | ✗            | ✗          | ✗           |

*ADMIN cannot create or manage OWNER or ADMIN accounts. Password resets issue a
random temporary password that must be changed at next sign-in.

## Test catalogue and packages

| Operation                          | OWNER | ADMIN | RECEPTIONIST | TECHNICIAN | PATHOLOGIST |
|------------------------------------|-------|-------|--------------|------------|-------------|
| View test catalogue                | ✓     | ✓     | ✓            | ✓          | ✓           |
| Create / update test               | ✓     | ✓     | ✗            | ✗          | ✗           |
| Activate / deactivate test         | ✓     | ✓     | ✗            | ✗          | ✗           |
| Create / update test package       | ✓     | ✓     | ✗            | ✗          | ✗           |

## Patient management

| Operation                          | OWNER | ADMIN | RECEPTIONIST | TECHNICIAN | PATHOLOGIST |
|------------------------------------|-------|-------|--------------|------------|-------------|
| Register patient                   | ✓     | ✓     | ✓            | ✗          | ✗           |
| Edit patient details               | ✓     | ✓     | ✓            | ✗          | ✗           |
| View patient list and detail       | ✓     | ✓     | ✓            | ✓          | ✓           |
| View patient order history         | ✓     | ✓     | ✓            | ✓          | ✓           |

## Orders and samples

| Operation                          | OWNER | ADMIN | RECEPTIONIST | TECHNICIAN | PATHOLOGIST |
|------------------------------------|-------|-------|--------------|------------|-------------|
| Create order                       | ✓     | ✓     | ✓            | ✗          | ✗           |
| View order list and detail         | ✓     | ✓     | ✓            | ✓          | ✓           |
| Cancel order                       | ✓     | ✓     | ✗            | ✗          | ✗           |
| Update sample status               | ✓     | ✓     | ✗            | ✓          | ✗           |
| View sample list and detail        | ✓     | ✓     | ✓            | ✓          | ✓           |

## Results

| Operation                          | OWNER | ADMIN | RECEPTIONIST | TECHNICIAN | PATHOLOGIST |
|------------------------------------|-------|-------|--------------|------------|-------------|
| Enter / update draft result        | ✓     | ✓     | ✗            | ✓          | ✗           |
| Submit result for review           | ✓     | ✓     | ✗            | ✓          | ✗           |
| Approve result                     | ✓     | ✓     | ✗            | ✗          | ✓           |
| Reject result                      | ✓     | ✓     | ✗            | ✗          | ✓           |
| View results                       | ✓     | ✓     | ✗            | ✓          | ✓           |

## Reports

| Operation                          | OWNER | ADMIN | RECEPTIONIST | TECHNICIAN | PATHOLOGIST |
|------------------------------------|-------|-------|--------------|------------|-------------|
| Generate report                    | ✓     | ✓     | ✗            | ✗          | ✓           |
| Approve / finalize report          | ✓     | ✓     | ✗            | ✗          | ✓           |
| View / download report             | ✓     | ✓     | ✓            | ✗          | ✓           |

## Billing and payments

| Operation                          | OWNER | ADMIN | RECEPTIONIST | TECHNICIAN | PATHOLOGIST |
|------------------------------------|-------|-------|--------------|------------|-------------|
| View invoices                      | ✓     | ✓     | ✓            | ✗          | ✗           |
| Apply discount                     | ✓     | ✓     | ✗            | ✗          | ✗           |
| Cancel invoice                     | ✓     | ✓     | ✗            | ✗          | ✗           |
| Record payment                     | ✓     | ✓     | ✓            | ✗          | ✗           |
| Reverse payment                    | ✓     | ✓     | ✗            | ✗          | ✗           |
| Download receipt                   | ✓     | ✓     | ✓            | ✗          | ✗           |

## Dashboard and monitoring

| Operation                          | OWNER | ADMIN | RECEPTIONIST | TECHNICIAN | PATHOLOGIST |
|------------------------------------|-------|-------|--------------|------------|-------------|
| View KPI dashboard                 | ✓     | ✓     | ✗            | ✗          | ✗           |
| View financial summaries           | ✓     | ✓     | ✗            | ✗          | ✗           |
| View staff activity                | ✓     | ✓     | ✗            | ✗          | ✗           |
| View audit log                     | ✓     | ✓     | ✗            | ✗          | ✗           |
| View settings                      | ✓     | ✗     | ✗            | ✗          | ✗           |

## Implementation notes

- Permissions are enforced in NestJS guards and services — not just the frontend.
- `JwtStrategy` loads the active user from the database and `RolesGuard`
  authorizes using that server-side role, never a request-body value.
- Hiding a navigation item is a UX convenience, not a security control.
- ADMIN restrictions on OWNER accounts are enforced in the `UsersService`, not just the guard.
