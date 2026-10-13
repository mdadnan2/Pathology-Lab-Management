---
applyTo: "apps/api/src/modules/results/**,apps/api/src/modules/reports/**,apps/web/src/app/**/results/**,apps/web/src/app/**/reports/**"
---

# Results and Reports Instructions

## Result entry

- `TestResult` fields: `labOrderItemId`, `enteredById`, `enteredAt`, `status`, `notes`
- `ResultParameter` fields: `testResultId`, `testParameterId`, `value`, `unit`, `isAbnormal`
- TECHNICIAN can enter and submit results by default. OWNER and ADMIN do not receive
  clinical permissions by role; an OWNER may explicitly grant clinical permissions to
  an individual staff account with a reason.
- `isAbnormal` is set server-side by comparing `value` against `referenceRangeLow/High`
- Reference range flags are informational demo indicators only — not clinical diagnosis
- Results can be saved as `DRAFT` before submission for review

## Result status machine

```
DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED
                  ↘ REJECTED (with reason) → DRAFT (re-entry)
```

- PATHOLOGIST can review, approve, and reject results by default. Other roles require
  explicitly granted individual clinical permissions.
- A result cannot be edited after `APPROVED`
- Rejection requires a reason; technician can re-enter and resubmit

## Report generation

- `LabReport` fields: `orderId`, `approvedById`, `approvedAt`, `generatedAt`, `pdfPath`, `status`
- Report can only be generated after all `LabOrderItem` results are `APPROVED`
- A report generator cannot approve the same report. The generator identity is stored on
  newly created reports; existing reports without generator identity are grandfathered.
- Report status: `DRAFT | PENDING_APPROVAL | APPROVED | DELIVERED`
- PDF is generated server-side using a template (no user-supplied HTML)
- PDF contains: lab identity (fictional demo), patient details, order number, test results, reference ranges, approval details, timestamps
- Do not use real accreditation claims, real signatures, or real provider details

## PDF generation rules

- Use a server-side PDF library (e.g., `@react-pdf/renderer` server-side or `pdfkit`)
- PDF template is code-controlled — report field values are escaped before rendering
- No user-provided HTML or Markdown is rendered into the PDF
- PDF stored in `apps/api/uploads/reports/` or returned as a stream
- Access to PDF requires authentication and authorization check
- RECEPTIONIST can access finalized reports only; accessing/downloading a finalized report
  marks it delivered.

## Report access

- Patient's report: accessible to RECEPTIONIST (for delivery), ADMIN, OWNER, PATHOLOGIST
- TECHNICIAN can view their own submitted results but not approve reports
- Report delivery status updated when report is accessed/downloaded

## Demo data rules

- All seeded results use fictional parameter values within or slightly outside reference ranges
- Reference ranges are illustrative demo values — not medically validated
- Reports clearly state: "DEMO DATA — NOT FOR CLINICAL USE"
- No real patient names, real provider names, or real accreditation numbers in seed data

## Audit requirements

Emit `AuditEvent` for:
- `RESULT_ENTERED`
- `RESULT_SUBMITTED`
- `RESULT_APPROVED`
- `RESULT_REJECTED`
- `REPORT_GENERATED`
- `REPORT_APPROVED`
- `REPORT_DELIVERED`
