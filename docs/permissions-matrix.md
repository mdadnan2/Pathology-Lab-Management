# Permissions Matrix — Pathology Lab Management System

✓ = Allowed | ✗ = Denied | ✓* = Allowed with restrictions

This table documents role defaults from `apps/api/src/common/permissions/permission-policy.ts`.
An explicit clinical permission recorded for one staff account can add capabilities, except
that default role permissions cannot be revoked through the exception workflow. Only an
OWNER can grant or revoke clinical exceptions. The frontend follows effective permissions;
the API remains authoritative.

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
| Enter / update draft result        | ✗     | ✗     | ✗            | ✓          | ✗           |
| Submit result for review           | ✗     | ✗     | ✗            | ✓          | ✗           |
| Approve result                     | ✗     | ✗     | ✗            | ✗          | ✓           |
| Reject result                      | ✗     | ✗     | ✗            | ✗          | ✓           |
| View results                       | ✗     | ✗     | ✗            | ✓          | ✓           |

## Reports

| Operation                          | OWNER | ADMIN | RECEPTIONIST | TECHNICIAN | PATHOLOGIST |
|------------------------------------|-------|-------|--------------|------------|-------------|
| Generate report                    | ✗     | ✗     | ✗            | ✗          | ✓           |
| Approve / finalize report          | ✗     | ✗     | ✗            | ✗          | ✓           |
| View / download finalized report   | ✗     | ✗     | ✓*           | ✗          | ✓           |

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
- Clinical access is not implied by OWNER or ADMIN. An OWNER grants an exception to another
  active user with a mandatory reason; each grant and revoke creates an append-only
  permission event and an audit event. Self-grants/revokes and revocation of role defaults
  are prohibited.
- A result approver cannot approve their own entered result, and a report generator cannot
  approve that report. Legacy reports with no generator identity are grandfathered.
- RECEPTIONIST can read and download finalized reports only. Download marks the report
  delivered; unfinalized report data is not visible to RECEPTIONIST.
- Technician and Pathologist records are currently scoped by workflow state, not by
  individual assignment or department. Assignment data is not yet represented in the schema.
- Laboratory-role patient lists/details return only name, patient code, date of birth, and
  gender; phone, email, address, and blood group remain hidden. Their patient searches do
  not match phone numbers.
- Explicit permission exceptions are restricted to clinical result/report capabilities;
  catalogue, financial, staff, dashboard, and settings access remain role defaults.
