---
applyTo: "apps/api/src/modules/patients/**,apps/api/src/modules/orders/**,apps/api/src/modules/samples/**,apps/api/src/modules/test-catalogue/**,apps/web/src/app/**/patients/**,apps/web/src/app/**/orders/**"
---

# Patients, Orders, and Samples Instructions

## Patient registration

- Unique `patientCode` generated server-side: `PAT-YYYYMMDD-NNNN` (sequential per day)
- Required fields: `firstName`, `lastName`, `phone`, `dateOfBirth`, `gender`
- Optional: `email`, `address`, `bloodGroup`
- Phone must be validated (10-digit Indian mobile)
- Search by name, phone, or patientCode — paginated
- Duplicate detection: warn if same name + phone already exists; do not block registration
- Patient records are never hard-deleted

## Test catalogue

- `LabTest` fields: `code`, `name`, `category`, `specimenType`, `department`, `price`, `isActive`, `turnaroundHours`
- `TestParameter` fields: `name`, `unit`, `referenceRangeLow`, `referenceRangeHigh`, `referenceRangeText`
- Price changes must not affect already-issued invoices (price snapshot on order item)
- Only OWNER and ADMIN can create/update/deactivate tests
- Deactivated tests cannot be added to new orders

## Test packages

- `TestPackage`: `name`, `description`, `price`, `isActive`
- `TestPackageItem`: links package to individual `LabTest`
- Package price is a fixed bundle price (not sum of individual tests)
- Adding a package to an order expands it into individual `LabOrderItem` records at the package price snapshot

## Order creation

- `LabOrder` fields: `orderNumber` (auto: `ORD-YYYYMMDD-NNNN`), `patientId`, `status`, `notes`, `createdById`
- `LabOrderItem` fields: `labTestId`, `priceSnapshot`, `testNameSnapshot`, `status`
- `priceSnapshot` and `testNameSnapshot` are captured at order creation — immutable thereafter
- An order must have at least one item
- Creating an order automatically creates a `Sample` record and an `Invoice`

## Sample tracking

- `Sample` fields: `sampleId` (auto: `SMP-YYYYMMDD-NNNN`), `orderId`, `collectedById`, `collectedAt`, `status`
- Status transitions (validated server-side):

```
PENDING → COLLECTED → PROCESSING → COMPLETED
                    ↘ REJECTED (with reason)
REJECTED → RECOLLECTION_REQUESTED → COLLECTED
```

- Only TECHNICIAN, ADMIN, OWNER can update sample status
- Each status change is recorded in an `AuditEvent`

## Order status machine

```
NEW → SAMPLE_COLLECTED → PROCESSING → RESULT_ENTERED → UNDER_REVIEW → APPROVED → REPORT_READY
```

- Order status is derived from the aggregate of its item statuses where practical
- Individual `LabOrderItem` statuses can differ (one test may be COMPLETED while another is PROCESSING)
- Status transitions are validated — no skipping states

## Business rules

- Cannot add items to an order once it moves past `NEW`
- Cannot cancel an order that has an approved report
- Cancellation requires a reason and creates an audit event
- All order and sample mutations record the acting user from JWT context
