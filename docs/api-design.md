# API Design — Pathology Lab Management System

Base URL: `http://localhost:3001/api/v1`
Swagger UI: `http://localhost:3001/api/docs` (development only)

> **Implementation status:** This milestone implements health, authentication,
> user administration, patients, test catalogue/packages, orders, samples, and
> audit APIs. Results, reports, billing, payments, and dashboard routes below
> are API design targets only and are not yet available. Protected feature
> routes require authentication and a server-loaded role; new/reset passwords
> must be changed before accessing protected workflows.

## Response envelope

### Success
```json
{
  "data": { ... },
  "message": "optional success message"
}
```

### Paginated success
```json
{
  "data": [ ... ],
  "meta": {
    "page": 1,
    "limit": 5,
    "total": 142,
    "totalPages": 29
  }
}
```

### Error
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": ["field: reason"]
}
```

## Authentication

| Method | Path                  | Auth | Description              |
|--------|-----------------------|------|--------------------------|
| POST   | /auth/login           | ✗    | Login, sets cookie       |
| POST   | /auth/logout          | ✓    | Logout, clears cookie    |
| GET    | /auth/me              | ✓    | Current user profile     |
| POST   | /auth/change-password | ✓    | Change current password  |

## Health

| Method | Path    | Auth | Description                       |
|--------|---------|------|-----------------------------------|
| GET    | /health | ✗    | API and PostgreSQL readiness      |

## Users

| Method | Path                  | Roles           | Description              |
|--------|-----------------------|-----------------|--------------------------|
| GET    | /users                | OWNER, ADMIN    | List staff (paginated)   |
| POST   | /users                | OWNER, ADMIN    | Create staff account     |
| GET    | /users/:id            | OWNER, ADMIN    | Get staff detail         |
| PATCH  | /users/:id            | OWNER, ADMIN    | Update staff             |
| PATCH  | /users/:id/deactivate | OWNER, ADMIN    | Deactivate account       |
| PATCH  | /users/:id/password   | OWNER, ADMIN    | Issue one-time password   |

## Patients

| Method | Path                  | Roles                        | Description              |
|--------|-----------------------|------------------------------|--------------------------|
| GET    | /patients             | All authenticated            | List/search patients     |
| POST   | /patients             | OWNER, ADMIN, RECEPTIONIST   | Register patient         |
| GET    | /patients/:id         | All authenticated            | Patient detail           |
| PATCH  | /patients/:id         | OWNER, ADMIN, RECEPTIONIST   | Update patient           |
| GET    | /patients/:id/orders  | All authenticated            | Patient order history    |

## Test Catalogue

| Method | Path                        | Roles           | Description              |
|--------|-----------------------------|-----------------|--------------------------|
| GET    | /test-catalogue             | All authenticated | List tests (paginated)  |
| POST   | /test-catalogue             | OWNER, ADMIN    | Create test              |
| GET    | /test-catalogue/:id         | All authenticated | Test detail             |
| PATCH  | /test-catalogue/:id         | OWNER, ADMIN    | Update test              |
| PATCH  | /test-catalogue/:id/toggle  | OWNER, ADMIN    | Activate/deactivate      |
| GET    | /test-catalogue/categories  | All authenticated | List categories         |

## Test Packages

| Method | Path                  | Roles           | Description              |
|--------|-----------------------|-----------------|--------------------------|
| GET    | /test-packages        | All authenticated | List packages           |
| POST   | /test-packages        | OWNER, ADMIN    | Create package           |
| GET    | /test-packages/:id    | All authenticated | Package detail          |
| PATCH  | /test-packages/:id    | OWNER, ADMIN    | Update package           |

## Orders

| Method | Path                  | Roles                        | Description              |
|--------|-----------------------|------------------------------|--------------------------|
| GET    | /orders               | All authenticated            | List orders (paginated)  |
| POST   | /orders               | OWNER, ADMIN, RECEPTIONIST   | Create order             |
| GET    | /orders/:id           | All authenticated            | Order detail             |
| PATCH  | /orders/:id/cancel    | OWNER, ADMIN                 | Cancel order             |

## Samples

| Method | Path                        | Roles                              | Description              |
|--------|-----------------------------|------------------------------------|--------------------------|
| GET    | /samples                    | All authenticated                  | List samples             |
| GET    | /samples/:id                | All authenticated                  | Sample detail            |
| PATCH  | /samples/:id/status         | OWNER, ADMIN, TECHNICIAN           | Update sample status     |

## Results

| Method | Path                        | Roles                              | Description              |
|--------|-----------------------------|------------------------------------|--------------------------|
| GET    | /results/order/:orderId     | All authenticated                  | Results for order        |
| POST   | /results                    | OWNER, ADMIN, TECHNICIAN           | Enter result             |
| PATCH  | /results/:id                | OWNER, ADMIN, TECHNICIAN           | Update draft result      |
| PATCH  | /results/:id/submit         | OWNER, ADMIN, TECHNICIAN           | Submit for review        |
| PATCH  | /results/:id/approve        | OWNER, ADMIN, PATHOLOGIST          | Approve result           |
| PATCH  | /results/:id/reject         | OWNER, ADMIN, PATHOLOGIST          | Reject result            |

## Reports

| Method | Path                        | Roles                              | Description              |
|--------|-----------------------------|------------------------------------|--------------------------|
| GET    | /reports                    | All authenticated                  | List reports             |
| GET    | /reports/:id                | All authenticated                  | Report detail            |
| POST   | /reports/generate/:orderId  | OWNER, ADMIN, PATHOLOGIST          | Generate report          |
| GET    | /reports/:id/pdf            | All authenticated                  | Download PDF             |

## Billing

| Method | Path                        | Roles                              | Description              |
|--------|-----------------------------|------------------------------------|--------------------------|
| GET    | /invoices                   | OWNER, ADMIN, RECEPTIONIST         | List invoices            |
| GET    | /invoices/:id               | OWNER, ADMIN, RECEPTIONIST         | Invoice detail           |
| PATCH  | /invoices/:id/discount      | OWNER, ADMIN                       | Apply discount           |
| PATCH  | /invoices/:id/cancel        | OWNER, ADMIN                       | Cancel invoice           |
| GET    | /invoices/:id/receipt       | All authenticated                  | Download receipt PDF     |

## Payments

| Method | Path                        | Roles                              | Description              |
|--------|-----------------------------|------------------------------------|--------------------------|
| POST   | /payments                   | OWNER, ADMIN, RECEPTIONIST         | Record payment           |
| GET    | /payments/invoice/:id       | OWNER, ADMIN, RECEPTIONIST         | Payments for invoice     |
| PATCH  | /payments/:id/reverse       | OWNER, ADMIN                       | Reverse payment          |

## Dashboard

| Method | Path                        | Roles           | Description              |
|--------|-----------------------------|-----------------|--------------------------|
| GET    | /dashboard/kpis             | OWNER, ADMIN    | Today's KPI summary      |
| GET    | /dashboard/collections      | OWNER, ADMIN    | Collections by date      |
| GET    | /dashboard/activity         | OWNER, ADMIN    | Recent activity feed     |
| GET    | /dashboard/outstanding      | OWNER, ADMIN    | Outstanding dues         |

## Audit

| Method | Path                        | Roles           | Description              |
|--------|-----------------------------|-----------------|--------------------------|
| GET    | /audit                      | OWNER, ADMIN    | Audit log (paginated)    |

## Pagination query parameters

All list endpoints accept:
- `page` (default: 1)
- `limit` (default: 20, max: 100)
- `search` (where applicable)
- `status` (where applicable)
- `from` / `to` (ISO date range, where applicable)
