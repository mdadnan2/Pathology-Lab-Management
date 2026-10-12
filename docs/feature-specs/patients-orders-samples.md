# Feature Spec: Patients, Orders, and Samples

See [architecture.instructions.md](../../.github/instructions/patients-orders-samples.instructions.md) for implementation rules.

## Patient registration

### Fields
| Field       | Type     | Required | Validation                        |
|-------------|----------|----------|-----------------------------------|
| firstName   | string   | ✓        | 1–100 chars                       |
| lastName    | string   | ✓        | 1–100 chars                       |
| phone       | string   | ✓        | 10-digit Indian mobile            |
| dateOfBirth | date     | ✓        | Past date, not > 120 years ago    |
| gender      | enum     | ✓        | MALE / FEMALE / OTHER             |
| email       | string   | ✗        | Valid email format                |
| bloodGroup  | enum     | ✗        | A_POS, A_NEG, B_POS, etc.        |
| address     | string   | ✗        | Max 500 chars                     |

### Patient code generation
Format: `PAT-YYYYMMDD-NNNN` (sequential per day, zero-padded to 4 digits)
Generated server-side; never supplied by client.

### Duplicate detection
If an active patient with the same `phone` already exists, return a warning in
the response (`meta.duplicateWarning: true`) but do not block registration.

## Test catalogue

### Seeded categories
- Hematology (HEM)
- Biochemistry (BIO)
- Clinical Pathology (CLI)
- Thyroid (THY)
- Lipid Profile (LIP)
- Liver Function (LFT)
- Kidney Function (KFT)
- Microbiology (MIC)

### Seeded tests (illustrative demo prices — not market prices)
| Code | Name                        | Category | Price (INR) | Specimen |
|------|-----------------------------|----------|-------------|----------|
| CBC  | Complete Blood Count        | HEM      | 350         | Blood    |
| HB   | Hemoglobin                  | HEM      | 150         | Blood    |
| FBG  | Fasting Blood Glucose       | BIO      | 120         | Blood    |
| PPBG | Post-Prandial Blood Glucose | BIO      | 120         | Blood    |
| LIP  | Lipid Profile               | LIP      | 650         | Blood    |
| LFT  | Liver Function Test         | LFT      | 800         | Blood    |
| KFT  | Kidney Function Test        | KFT      | 750         | Blood    |
| TSH  | Thyroid Stimulating Hormone | THY      | 450         | Blood    |
| T3   | Triiodothyronine (T3)       | THY      | 350         | Blood    |
| T4   | Thyroxine (T4)              | THY      | 350         | Blood    |
| URE  | Urine Routine Examination   | CLI      | 200         | Urine    |
| CRP  | C-Reactive Protein          | BIO      | 500         | Blood    |
| HBA1C| HbA1c (Glycated Hemoglobin) | BIO      | 600         | Blood    |
| ESR  | Erythrocyte Sedimentation Rate | HEM   | 150         | Blood    |
| URIC | Uric Acid                   | BIO      | 200         | Blood    |

**All prices are illustrative demo values. Not current market prices.**

### Seeded packages
| Name                  | Price (INR) | Tests included                    |
|-----------------------|-------------|-----------------------------------|
| Basic Health Checkup  | 800         | CBC, FBG, URE                     |
| Thyroid Panel         | 950         | TSH, T3, T4                       |
| Diabetes Panel        | 900         | FBG, PPBG, HBA1C                  |
| Comprehensive Panel   | 2500        | CBC, LFT, KFT, LIP, TSH, FBG, URE|

## Order workflow

### Order creation
1. Select existing patient (or register new patient inline)
2. Select one or more tests or a package
3. System captures `priceSnapshot` and `testNameSnapshot` for each item
4. System creates `LabOrder`, `LabOrderItem[]`, `Sample`, and `Invoice` atomically
5. Order status: `NEW`; Sample status: `PENDING`; Invoice status: `UNPAID`

### Status transitions
```
Order:  NEW → SAMPLE_COLLECTED → PROCESSING → RESULT_ENTERED → UNDER_REVIEW → APPROVED → REPORT_READY
Sample: PENDING → COLLECTED → PROCESSING → COMPLETED
                            ↘ REJECTED → RECOLLECTION_REQUESTED → COLLECTED
```

### Seeded demo patients (fictional)
15 fictional patients with Indian names, fictional phone numbers, and varied
demographics. The seed includes one order and invoice per patient; sample/order
workflow examples cover new, collected, and processing states. Results and
reports are intentionally not fabricated before the Phase 5 workflow exists.

## UI screens

1. **Patient List** — searchable table, paginated, "Register Patient" button
2. **Patient Registration** — form with validation, duplicate warning
3. **Patient Detail** — demographics, order history, invoice summary
4. **Test Catalogue** — searchable by name/code/category, toggle active/inactive
5. **Create Order** — patient selector, test/package selector, price preview, confirm
6. **Order List** — searchable and filterable by order status, sample status,
   date range, and patient
7. **Order Detail** — items, sample status and transitions, invoice summary,
   and patient link
8. **Sample Tracking** — filterable sample table with valid transition actions
