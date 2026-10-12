# Database Schema — Pathology Lab Management System

All monetary fields use `NUMERIC(12,2)`. All timestamps are UTC. Prisma model names are PascalCase; table names are snake_case plural via `@@map`.

## Entity relationship summary

```
User ──────────────────────────────────────────────────────────────────┐
  │ createdBy                                                           │
Patient ──────────────────────────────────────────────────────────────┐│
  │                                                                    ││
LabOrder ──────────────────────────────────────────────────────────┐  ││
  │                                                                 │  ││
  ├── LabOrderItem ──── LabTest ──── TestParameter                  │  ││
  │       │                                                         │  ││
  │       └── TestResult ──── ResultParameter                       │  ││
  │                                                                 │  ││
  ├── Sample                                                        │  ││
  │                                                                 │  ││
  ├── Invoice ──── InvoiceItem                                      │  ││
  │       │                                                         │  ││
  │       ├── Payment                                               │  ││
  │       └── FinancialAdjustment                                   │  ││
  │                                                                 │  ││
  └── LabReport                                                     │  ││
                                                                    │  ││
AuditEvent ─────────────────────────────────────────────────────────┘  ││
TestCategory ──── LabTest                                               ││
TestPackage ──── TestPackageItem ──── LabTest                           ││
```

## Models

### User
```prisma
model User {
  id                  String    @id @default(uuid())
  employeeCode        String    @unique           // EMP-001
  firstName           String
  lastName            String
  email               String    @unique
  phone               String
  passwordHash        String
  role                Role
  isActive            Boolean   @default(true)
  mustChangePassword  Boolean   @default(false)
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  // Relations
  createdOrders     LabOrder[]        @relation("OrderCreatedBy")
  collectedSamples  Sample[]          @relation("SampleCollectedBy")
  enteredResults    TestResult[]      @relation("ResultEnteredBy")
  approvedReports   LabReport[]       @relation("ReportApprovedBy")
  createdInvoices   Invoice[]         @relation("InvoiceCreatedBy")
  recordedPayments  Payment[]         @relation("PaymentRecordedBy")
  auditEvents       AuditEvent[]      @relation("AuditActor")

  @@map("users")
}

enum Role {
  OWNER
  ADMIN
  RECEPTIONIST
  TECHNICIAN
  PATHOLOGIST
}
```

### Patient
```prisma
model Patient {
  id           String    @id @default(uuid())
  patientCode  String    @unique           // PAT-20250712-0001
  firstName    String
  lastName     String
  phone        String
  email        String?
  dateOfBirth  DateTime
  gender       Gender
  bloodGroup   BloodGroup?
  address      String?
  isActive     Boolean   @default(true)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  orders    LabOrder[]
  invoices  Invoice[]

  @@index([phone])
  @@index([firstName, lastName])
  @@map("patients")
}

enum Gender { MALE FEMALE OTHER }
enum BloodGroup { A_POS A_NEG B_POS B_NEG AB_POS AB_NEG O_POS O_NEG }
```

### TestCategory
```prisma
model TestCategory {
  id        String     @id @default(uuid())
  name      String     @unique   // Hematology, Biochemistry, etc.
  code      String     @unique   // HEM, BIO, etc.
  tests     LabTest[]
  @@map("test_categories")
}
```

### LabTest
```prisma
model LabTest {
  id               String        @id @default(uuid())
  code             String        @unique   // CBC, HB, FBG, etc.
  name             String
  categoryId       String
  specimenType     String        // Blood, Urine, Serum
  department       String
  price            Decimal       @db.Decimal(12, 2)
  turnaroundHours  Int           @default(24)
  isActive         Boolean       @default(true)
  description      String?
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt

  category    TestCategory    @relation(fields: [categoryId], references: [id])
  parameters  TestParameter[]
  orderItems  LabOrderItem[]
  packageItems TestPackageItem[]

  @@index([categoryId])
  @@index([isActive])
  @@map("lab_tests")
}
```

### TestParameter
```prisma
model TestParameter {
  id                   String   @id @default(uuid())
  labTestId            String
  name                 String
  unit                 String?
  referenceRangeLow    Decimal? @db.Decimal(10, 4)
  referenceRangeHigh   Decimal? @db.Decimal(10, 4)
  referenceRangeText   String?  // for non-numeric ranges
  sortOrder            Int      @default(0)

  labTest          LabTest           @relation(fields: [labTestId], references: [id])
  resultParameters ResultParameter[]

  @@index([labTestId])
  @@map("test_parameters")
}
```

### TestPackage
```prisma
model TestPackage {
  id          String           @id @default(uuid())
  name        String           @unique
  description String?
  price       Decimal          @db.Decimal(12, 2)
  isActive    Boolean          @default(true)
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  items TestPackageItem[]
  @@map("test_packages")
}

model TestPackageItem {
  id         String      @id @default(uuid())
  packageId  String
  labTestId  String

  package  TestPackage @relation(fields: [packageId], references: [id])
  labTest  LabTest     @relation(fields: [labTestId], references: [id])

  @@unique([packageId, labTestId])
  @@map("test_package_items")
}
```

### LabOrder
```prisma
model LabOrder {
  id           String      @id @default(uuid())
  orderNumber  String      @unique   // ORD-20250712-0001
  patientId    String
  status       OrderStatus @default(NEW)
  notes        String?
  createdById  String
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
  cancelledAt  DateTime?
  cancelReason String?

  patient    Patient        @relation(fields: [patientId], references: [id])
  createdBy  User           @relation("OrderCreatedBy", fields: [createdById], references: [id])
  items      LabOrderItem[]
  samples    Sample[]
  invoice    Invoice?
  report     LabReport?

  @@index([patientId])
  @@index([status])
  @@index([createdAt])
  @@map("lab_orders")
}

enum OrderStatus {
  NEW
  SAMPLE_COLLECTED
  PROCESSING
  RESULT_ENTERED
  UNDER_REVIEW
  APPROVED
  REPORT_READY
  CANCELLED
}
```

### LabOrderItem
```prisma
model LabOrderItem {
  id                String          @id @default(uuid())
  orderId           String
  labTestId         String
  testNameSnapshot  String
  priceSnapshot     Decimal         @db.Decimal(12, 2)
  status            OrderItemStatus @default(PENDING)

  order      LabOrder     @relation(fields: [orderId], references: [id])
  labTest    LabTest      @relation(fields: [labTestId], references: [id])
  result     TestResult?
  invoiceItem InvoiceItem?

  @@index([orderId])
  @@map("lab_order_items")
}

enum OrderItemStatus {
  PENDING
  SAMPLE_COLLECTED
  PROCESSING
  RESULT_ENTERED
  APPROVED
  CANCELLED
}
```

### Sample
```prisma
model Sample {
  id             String       @id @default(uuid())
  sampleId       String       @unique   // SMP-20250712-0001
  orderId        String
  collectedById  String?
  collectedAt    DateTime?
  status         SampleStatus @default(PENDING)
  rejectionReason String?
  notes          String?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  order       LabOrder @relation(fields: [orderId], references: [id])
  collectedBy User?    @relation("SampleCollectedBy", fields: [collectedById], references: [id])

  @@index([orderId])
  @@index([status])
  @@map("samples")
}

enum SampleStatus {
  PENDING
  COLLECTED
  PROCESSING
  COMPLETED
  REJECTED
  RECOLLECTION_REQUESTED
}
```

### TestResult
```prisma
model TestResult {
  id             String            @id @default(uuid())
  orderItemId    String            @unique
  enteredById    String
  enteredAt      DateTime          @default(now())
  reviewedById   String?
  reviewedAt     DateTime?
  status         ResultStatus      @default(DRAFT)
  rejectionReason String?
  notes          String?

  orderItem   LabOrderItem      @relation(fields: [orderItemId], references: [id])
  enteredBy   User              @relation("ResultEnteredBy", fields: [enteredById], references: [id])
  parameters  ResultParameter[]

  @@map("test_results")
}

enum ResultStatus { DRAFT SUBMITTED UNDER_REVIEW APPROVED REJECTED }
```

### ResultParameter
```prisma
model ResultParameter {
  id               String        @id @default(uuid())
  testResultId     String
  testParameterId  String
  value            String
  unit             String?
  isAbnormal       Boolean       @default(false)

  testResult     TestResult    @relation(fields: [testResultId], references: [id])
  testParameter  TestParameter @relation(fields: [testParameterId], references: [id])

  @@index([testResultId])
  @@map("result_parameters")
}
```

### LabReport
```prisma
model LabReport {
  id           String       @id @default(uuid())
  orderId      String       @unique
  approvedById String?
  approvedAt   DateTime?
  generatedAt  DateTime?
  pdfPath      String?
  status       ReportStatus @default(DRAFT)
  createdAt    DateTime     @default(now())

  order      LabOrder @relation(fields: [orderId], references: [id])
  approvedBy User?    @relation("ReportApprovedBy", fields: [approvedById], references: [id])

  @@map("lab_reports")
}

enum ReportStatus { DRAFT PENDING_APPROVAL APPROVED DELIVERED }
```

### Invoice
```prisma
model Invoice {
  id              String        @id @default(uuid())
  invoiceNumber   String        @unique   // INV-20250712-0001
  orderId         String        @unique
  patientId       String
  subtotal        Decimal       @db.Decimal(12, 2)
  discountAmount  Decimal       @db.Decimal(12, 2) @default(0)
  totalAmount     Decimal       @db.Decimal(12, 2)
  paidAmount      Decimal       @db.Decimal(12, 2) @default(0)
  status          InvoiceStatus @default(UNPAID)
  createdById     String
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  cancelledAt     DateTime?

  order       LabOrder              @relation(fields: [orderId], references: [id])
  patient     Patient               @relation(fields: [patientId], references: [id])
  createdBy   User                  @relation("InvoiceCreatedBy", fields: [createdById], references: [id])
  items       InvoiceItem[]
  payments    Payment[]
  adjustments FinancialAdjustment[]

  @@index([patientId])
  @@index([status])
  @@index([createdAt])
  @@map("invoices")
}

enum InvoiceStatus { UNPAID PARTIALLY_PAID PAID CANCELLED }
```

### InvoiceItem
```prisma
model InvoiceItem {
  id               String   @id @default(uuid())
  invoiceId        String
  orderItemId      String   @unique
  testNameSnapshot String
  priceSnapshot    Decimal  @db.Decimal(12, 2)
  quantity         Int      @default(1)

  invoice   Invoice      @relation(fields: [invoiceId], references: [id])
  orderItem LabOrderItem @relation(fields: [orderItemId], references: [id])

  @@index([invoiceId])
  @@map("invoice_items")
}
```

### Payment
```prisma
model Payment {
  id              String        @id @default(uuid())
  invoiceId       String
  amount          Decimal       @db.Decimal(12, 2)
  method          PaymentMethod
  referenceNumber String?
  notes           String?
  recordedById    String
  paidAt          DateTime      @default(now())
  isReversed      Boolean       @default(false)
  reversedAt      DateTime?

  invoice    Invoice @relation(fields: [invoiceId], references: [id])
  recordedBy User    @relation("PaymentRecordedBy", fields: [recordedById], references: [id])

  @@index([invoiceId])
  @@index([paidAt])
  @@map("payments")
}

enum PaymentMethod { CASH CARD UPI BANK_TRANSFER }
```

### FinancialAdjustment
```prisma
model FinancialAdjustment {
  id             String           @id @default(uuid())
  invoiceId      String
  type           AdjustmentType
  amount         Decimal          @db.Decimal(12, 2)
  reason         String
  authorizedById String
  createdAt      DateTime         @default(now())

  invoice      Invoice @relation(fields: [invoiceId], references: [id])

  @@index([invoiceId])
  @@map("financial_adjustments")
}

enum AdjustmentType { DISCOUNT REVERSAL CANCELLATION }
```

### AuditEvent
```prisma
model AuditEvent {
  id          String      @id @default(uuid())
  actorId     String
  action      AuditAction
  entityType  String
  entityId    String
  metadata    Json?
  createdAt   DateTime    @default(now())

  actor User @relation("AuditActor", fields: [actorId], references: [id])

  @@index([actorId])
  @@index([entityType, entityId])
  @@index([createdAt])
  @@map("audit_events")
}
```

## Key design decisions

1. **Price snapshots** on `LabOrderItem` and `InvoiceItem` — catalogue price changes never affect issued invoices.
2. **Append-only `AuditEvent`** — no update/delete routes; tamper-evident history.
3. **`NUMERIC(12,2)`** for all monetary fields — no floating-point precision issues.
4. **Soft deletes** on `Patient`, `LabOrder`, `Invoice` — historical records preserved.
5. **`LabOrderItem` status** tracks individual test progress independently of the order-level status.
6. **`FinancialAdjustment`** is append-only — discounts, reversals, and cancellations are recorded, not edited.
