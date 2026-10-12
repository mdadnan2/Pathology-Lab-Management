# Feature Spec: Billing and Payments

See [billing-payments.instructions.md](../../.github/instructions/billing-payments.instructions.md) for implementation rules.

## Invoice lifecycle

```
UNPAID → PARTIALLY_PAID → PAID
       ↘ CANCELLED
```

An invoice is created automatically when an order is created.
Invoice status is derived from `paidAmount` vs `totalAmount`:
- `paidAmount == 0` → `UNPAID`
- `0 < paidAmount < totalAmount` → `PARTIALLY_PAID`
- `paidAmount == totalAmount` → `PAID`

## Invoice number format
`INV-YYYYMMDD-NNNN` — sequential per day, generated server-side.

## Calculation rules

```
subtotal      = Σ (priceSnapshot × quantity) for all InvoiceItems
totalAmount   = subtotal - discountAmount
paidAmount    = Σ amount for all non-reversed Payments
balance       = totalAmount - paidAmount
```

All arithmetic uses `Decimal.js`. Results stored as `NUMERIC(12,2)`.

## Payment recording

Required fields:
- `invoiceId` — from URL param, not request body
- `amount` — must be > 0 and ≤ balance
- `method` — CASH | CARD | UPI | BANK_TRANSFER
- `referenceNumber` — optional (for CARD/UPI/BANK_TRANSFER)
- `notes` — optional

`recordedById` is always taken from the JWT — never from the request body.

After recording: update `paidAmount` and `status` in the same DB transaction.

## Discount rules

- Discount applied to invoice level (not per item)
- `discountAmount` must be ≥ 0 and < `subtotal`
- Reason is mandatory
- Only OWNER and ADMIN can apply discounts
- Discount creates a `FinancialAdjustment` record with type `DISCOUNT`

## Cancellation rules

- Cannot cancel an invoice with `status = PAID`
- If partially paid, payments must be reversed first
- Cancellation creates a `FinancialAdjustment` with type `CANCELLATION`
- Sets `cancelledAt` timestamp on invoice

## Receipt format

PDF receipt contains:
- Lab name and address (fictional demo identity)
- Invoice number and date
- Patient name and code
- Itemized test list with prices
- Subtotal, discount, total
- Payment history (date, method, amount, recorded by)
- Outstanding balance
- "DEMO DATA — NOT FOR CLINICAL USE" watermark

## Daily collections report

Aggregates by date:
- Total billed (sum of `totalAmount` for invoices created on date)
- Total collected (sum of non-reversed payments on date)
- By payment method breakdown
- Outstanding (sum of `balance` for UNPAID + PARTIALLY_PAID invoices)

## Bill activity view (admin)

Per invoice row:
- Invoice number, patient code, patient name
- Total amount, paid amount, balance
- Invoice status
- Created at, created by (staff name)
- Payment records: date, amount, method, recorded by
- Adjustment records: type, amount, reason, authorized by

## UI screens

1. **Invoice List** — filterable by status, date, patient; shows balance column
2. **Invoice Detail** — items, payment history, adjustment history, action buttons
3. **Record Payment** — modal/drawer with amount, method, reference
4. **Apply Discount** — modal with amount and mandatory reason
5. **Receipt** — printable/downloadable PDF
6. **Daily Collections** — date-range chart + table
7. **Outstanding Dues** — list of unpaid/partially-paid invoices
