# Feature Spec: Admin Dashboard and Audit

See [auth-rbac-audit.instructions.md](../../.github/instructions/auth-rbac-audit.instructions.md) for audit implementation rules.

## Dashboard KPIs (today's figures)

| KPI                        | Source                                              |
|----------------------------|-----------------------------------------------------|
| Total patients today       | COUNT patients registered today                     |
| Orders created today       | COUNT orders created today                          |
| Tests pending              | COUNT order items with status PENDING               |
| Tests processing           | COUNT order items with status PROCESSING            |
| Reports awaiting approval  | COUNT reports with status PENDING_APPROVAL          |
| Completed reports          | COUNT reports with status APPROVED or DELIVERED     |
| Total billed today         | SUM invoice totalAmount for invoices created today  |
| Total collected today      | SUM non-reversed payments recorded today            |
| Outstanding balance        | SUM balance for UNPAID + PARTIALLY_PAID invoices    |

All figures derived from persisted records — never hardcoded.

## Charts

1. **Collections by day** — bar chart, last 30 days, billed vs collected
2. **Orders by status** — donut chart, current distribution
3. **Tests by category** — bar chart, orders this month by test category

## Activity feed

Recent 20 significant audit events, showing:
- Timestamp
- Actor name and role
- Action description
- Entity type and identifier

## Bill activity view

Filterable by: date range, staff member, invoice status, payment method

Columns:
- Invoice number
- Patient code + name
- Total amount
- Paid amount
- Balance
- Status
- Created at
- Created by
- Payment count

Expandable row: payment history with recorder names

## Audit log

Filterable by: date range, actor, action type, entity type

Columns:
- Timestamp
- Actor (name + role)
- Action
- Entity type
- Entity ID
- Metadata summary

Paginated, read-only. No delete or edit operations.

## Audit actions tracked

```
USER_LOGIN
USER_LOGOUT
USER_CREATED
USER_UPDATED
USER_DEACTIVATED
PASSWORD_RESET
PATIENT_CREATED
PATIENT_UPDATED
TEST_CREATED
TEST_UPDATED
TEST_DEACTIVATED
PACKAGE_CREATED
PACKAGE_UPDATED
ORDER_CREATED
ORDER_CANCELLED
SAMPLE_STATUS_CHANGED
RESULT_ENTERED
RESULT_SUBMITTED
RESULT_APPROVED
RESULT_REJECTED
REPORT_GENERATED
REPORT_APPROVED
REPORT_DELIVERED
INVOICE_CREATED
DISCOUNT_APPLIED
INVOICE_CANCELLED
PAYMENT_RECORDED
PAYMENT_REVERSED
```

## UI screens

1. **Dashboard** — KPI cards, charts, recent activity, quick links
2. **Bill Activity** — filterable table with expandable payment rows
3. **Collections Report** — date-range chart + daily breakdown table
4. **Outstanding Dues** — list with patient contact info and balance
5. **Audit Log** — paginated, filterable, read-only event log
6. **Staff Management** — list, add, edit, deactivate staff accounts
