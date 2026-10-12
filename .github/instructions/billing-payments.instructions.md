---
applyTo: "apps/api/src/modules/billing/**,apps/api/src/modules/payments/**,apps/web/src/app/**/billing/**,apps/web/src/app/**/payments/**"
---

# Billing and Payments Instructions

## Invoice creation

- `Invoice` fields: `invoiceNumber` (auto: `INV-YYYYMMDD-NNNN`), `orderId`, `patientId`, `subtotal`, `discountAmount`, `totalAmount`, `paidAmount`, `status`, `createdById`
- `InvoiceItem` fields: `labTestId`, `testNameSnapshot`, `priceSnapshot`, `quantity`
- Invoice is created automatically when an order is created
- `priceSnapshot` on each item is immutable — never recalculated from current catalogue price
- `subtotal` = sum of `(priceSnapshot × quantity)` for all items
- `totalAmount` = `subtotal` - `discountAmount`
- `paidAmount` = sum of all non-reversed `Payment` records for this invoice
- `status`: `UNPAID | PARTIALLY_PAID | PAID | CANCELLED`

## Payment recording

- `Payment` fields: `invoiceId`, `amount`, `method` (`CASH | CARD | UPI | BANK_TRANSFER`), `recordedById`, `paidAt`, `referenceNumber?`, `notes?`
- Payment amount must be > 0 and ≤ remaining balance
- Multiple payments allowed per invoice (partial payment support)
- After each payment: recalculate `paidAmount` and update `status` in the same DB transaction
- `recordedById` comes from JWT — never from request body

## Financial integrity rules

- All monetary arithmetic uses `Decimal.js` — never JavaScript `number` for money
- Store amounts as `NUMERIC(12,2)` in PostgreSQL
- Return amounts as strings in API responses
- Use a DB transaction for: payment recording + invoice status update
- Protect against duplicate submissions: check idempotency key or enforce unique constraint on payment reference where applicable
- Never allow `paidAmount > totalAmount`

## Discounts and adjustments

- `FinancialAdjustment` fields: `invoiceId`, `type` (`DISCOUNT | REVERSAL | CANCELLATION`), `amount`, `reason`, `authorizedById`, `createdAt`
- Only ADMIN and OWNER can apply discounts > configured threshold
- Discount reason is mandatory
- Adjustments are append-only — no editing or deletion

## Cancellations

- Invoice cancellation: sets `status = CANCELLED`, records a `FinancialAdjustment` with type `CANCELLATION`
- Cannot cancel an invoice with recorded payments unless payments are first reversed
- Payment reversal: creates a `FinancialAdjustment` with type `REVERSAL`, reduces `paidAmount`
- All cancellations and reversals create `AuditEvent` records

## Receipts

- Receipt endpoint: `GET /api/v1/invoices/:id/receipt` — returns PDF
- Receipt contains: invoice number, patient details, itemized tests, amounts, payment history, balance
- Receipt is generated server-side — no user-supplied HTML

## Financial reports

- Daily collections: sum of payments by date, grouped by method
- Outstanding dues: invoices where `status IN (UNPAID, PARTIALLY_PAID)`
- Bill activity view: invoice + patient + creator + payments + payment recorders
- All figures derived from persisted records — never hardcoded

## Audit requirements

Emit `AuditEvent` for:
- `INVOICE_CREATED`
- `PAYMENT_RECORDED`
- `PAYMENT_REVERSED`
- `DISCOUNT_APPLIED`
- `INVOICE_CANCELLED`
