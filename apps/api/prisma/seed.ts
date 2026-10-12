import {
  Gender,
  InvoiceStatus,
  OrderItemStatus,
  OrderStatus,
  PrismaClient,
  ReportStatus,
  ResultStatus,
  Role,
  SampleStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import Decimal from 'decimal.js';

const prisma = new PrismaClient();

const DEMO_USERS = [
  { employeeCode: 'EMP-001', firstName: 'Aarav', lastName: 'Mehta', email: 'owner@pathlab.demo', phone: '9990000001', role: Role.OWNER },
  { employeeCode: 'EMP-002', firstName: 'Anaya', lastName: 'Rao', email: 'admin.one@pathlab.demo', phone: '9990000002', role: Role.ADMIN },
  { employeeCode: 'EMP-003', firstName: 'Kabir', lastName: 'Shah', email: 'admin.two@pathlab.demo', phone: '9990000003', role: Role.ADMIN },
  { employeeCode: 'EMP-004', firstName: 'Diya', lastName: 'Iyer', email: 'reception.one@pathlab.demo', phone: '9990000004', role: Role.RECEPTIONIST },
  { employeeCode: 'EMP-005', firstName: 'Ishaan', lastName: 'Patel', email: 'reception.two@pathlab.demo', phone: '9990000005', role: Role.RECEPTIONIST },
  { employeeCode: 'EMP-006', firstName: 'Mira', lastName: 'Nair', email: 'reception.three@pathlab.demo', phone: '9990000006', role: Role.RECEPTIONIST },
  { employeeCode: 'EMP-007', firstName: 'Neel', lastName: 'Das', email: 'reception.four@pathlab.demo', phone: '9990000007', role: Role.RECEPTIONIST },
  { employeeCode: 'EMP-008', firstName: 'Tara', lastName: 'Menon', email: 'tech.one@pathlab.demo', phone: '9990000008', role: Role.TECHNICIAN },
  { employeeCode: 'EMP-009', firstName: 'Arjun', lastName: 'Joshi', email: 'tech.two@pathlab.demo', phone: '9990000009', role: Role.TECHNICIAN },
  { employeeCode: 'EMP-010', firstName: 'Sana', lastName: 'Bose', email: 'tech.three@pathlab.demo', phone: '9990000010', role: Role.TECHNICIAN },
  { employeeCode: 'EMP-011', firstName: 'Rohan', lastName: 'Sethi', email: 'tech.four@pathlab.demo', phone: '9990000011', role: Role.TECHNICIAN },
  { employeeCode: 'EMP-012', firstName: 'Leela', lastName: 'Kapoor', email: 'tech.five@pathlab.demo', phone: '9990000012', role: Role.TECHNICIAN },
  { employeeCode: 'EMP-013', firstName: 'Kavya', lastName: 'Sen', email: 'pathologist.one@pathlab.demo', phone: '9990000013', role: Role.PATHOLOGIST },
  { employeeCode: 'EMP-014', firstName: 'Dev', lastName: 'Kulkarni', email: 'pathologist.two@pathlab.demo', phone: '9990000014', role: Role.PATHOLOGIST },
  { employeeCode: 'EMP-015', firstName: 'Nila', lastName: 'Thomas', email: 'pathologist.three@pathlab.demo', phone: '9990000015', role: Role.PATHOLOGIST },
] satisfies Array<{
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: Role;
}>;

const DEMO_CATEGORIES = [
  { code: 'HEM', name: 'Hematology' },
  { code: 'BIO', name: 'Biochemistry' },
  { code: 'CLI', name: 'Clinical Pathology' },
  { code: 'THY', name: 'Thyroid' },
  { code: 'LIP', name: 'Lipid Profile' },
  { code: 'LFT', name: 'Liver Function' },
  { code: 'KFT', name: 'Kidney Function' },
  { code: 'MIC', name: 'Microbiology' },
];

const DEMO_TESTS = [
  { code: 'CBC', name: 'Complete Blood Count', categoryCode: 'HEM', price: '350.00', specimenType: 'Blood', department: 'Hematology' },
  { code: 'HB', name: 'Hemoglobin', categoryCode: 'HEM', price: '150.00', specimenType: 'Blood', department: 'Hematology' },
  { code: 'FBG', name: 'Fasting Blood Glucose', categoryCode: 'BIO', price: '120.00', specimenType: 'Blood', department: 'Biochemistry' },
  { code: 'PPBG', name: 'Post-Prandial Blood Glucose', categoryCode: 'BIO', price: '120.00', specimenType: 'Blood', department: 'Biochemistry' },
  { code: 'LIP', name: 'Lipid Profile', categoryCode: 'LIP', price: '650.00', specimenType: 'Blood', department: 'Biochemistry' },
  { code: 'LFT', name: 'Liver Function Test', categoryCode: 'LFT', price: '800.00', specimenType: 'Blood', department: 'Biochemistry' },
  { code: 'KFT', name: 'Kidney Function Test', categoryCode: 'KFT', price: '750.00', specimenType: 'Blood', department: 'Biochemistry' },
  { code: 'TSH', name: 'Thyroid Stimulating Hormone', categoryCode: 'THY', price: '450.00', specimenType: 'Blood', department: 'Immunology' },
  { code: 'T3', name: 'Triiodothyronine (T3)', categoryCode: 'THY', price: '350.00', specimenType: 'Blood', department: 'Immunology' },
  { code: 'T4', name: 'Thyroxine (T4)', categoryCode: 'THY', price: '350.00', specimenType: 'Blood', department: 'Immunology' },
  { code: 'URE', name: 'Urine Routine Examination', categoryCode: 'CLI', price: '200.00', specimenType: 'Urine', department: 'Clinical Pathology' },
  { code: 'CRP', name: 'C-Reactive Protein', categoryCode: 'BIO', price: '500.00', specimenType: 'Blood', department: 'Biochemistry' },
  { code: 'HBA1C', name: 'HbA1c (Glycated Hemoglobin)', categoryCode: 'BIO', price: '600.00', specimenType: 'Blood', department: 'Biochemistry' },
  { code: 'ESR', name: 'Erythrocyte Sedimentation Rate', categoryCode: 'HEM', price: '150.00', specimenType: 'Blood', department: 'Hematology' },
  { code: 'URIC', name: 'Uric Acid', categoryCode: 'BIO', price: '200.00', specimenType: 'Blood', department: 'Biochemistry' },
];

const DEMO_TEST_PARAMETERS: Record<string, Array<{
  name: string;
  unit: string;
  low: string;
  high: string;
}>> = {
  CBC: [
    { name: 'Hemoglobin', unit: 'g/dL', low: '12', high: '17.5' },
    { name: 'WBC Count', unit: '10^3/uL', low: '4', high: '11' },
    { name: 'Platelet Count', unit: '10^3/uL', low: '150', high: '400' },
    { name: 'RBC Count', unit: '10^6/uL', low: '4.2', high: '5.9' },
    { name: 'Hematocrit', unit: '%', low: '36', high: '52' },
  ],
  HB: [{ name: 'Hemoglobin', unit: 'g/dL', low: '12', high: '17.5' }],
  FBG: [{ name: 'Glucose (Fasting)', unit: 'mg/dL', low: '70', high: '100' }],
  PPBG: [{ name: 'Glucose (Post-Prandial)', unit: 'mg/dL', low: '70', high: '140' }],
  LIP: [
    { name: 'Total Cholesterol', unit: 'mg/dL', low: '0', high: '200' },
    { name: 'HDL Cholesterol', unit: 'mg/dL', low: '40', high: '60' },
    { name: 'LDL Cholesterol', unit: 'mg/dL', low: '0', high: '130' },
    { name: 'Triglycerides', unit: 'mg/dL', low: '0', high: '150' },
  ],
  TSH: [{ name: 'TSH', unit: 'uIU/mL', low: '0.4', high: '4' }],
  T3: [{ name: 'T3', unit: 'ng/mL', low: '0.8', high: '2' }],
  T4: [{ name: 'T4', unit: 'ug/dL', low: '5', high: '12' }],
  LFT: [
    { name: 'ALT', unit: 'U/L', low: '7', high: '56' },
    { name: 'AST', unit: 'U/L', low: '10', high: '40' },
  ],
  KFT: [
    { name: 'Creatinine', unit: 'mg/dL', low: '0.6', high: '1.3' },
    { name: 'Urea', unit: 'mg/dL', low: '15', high: '45' },
  ],
  URE: [{ name: 'Specific Gravity', unit: '', low: '1.005', high: '1.03' }],
  CRP: [{ name: 'C-Reactive Protein', unit: 'mg/L', low: '0', high: '10' }],
  HBA1C: [{ name: 'HbA1c', unit: '%', low: '4', high: '5.7' }],
  ESR: [{ name: 'ESR', unit: 'mm/hr', low: '0', high: '20' }],
  URIC: [{ name: 'Uric Acid', unit: 'mg/dL', low: '2.5', high: '7' }],
};

const DEMO_PACKAGES = [
  { name: 'Basic Health Checkup', description: 'Fictional demo bundle: CBC, fasting glucose, and urine routine.', price: '800.00', testCodes: ['CBC', 'FBG', 'URE'] },
  { name: 'Thyroid Panel', description: 'Fictional demo bundle: TSH, T3, and T4.', price: '950.00', testCodes: ['TSH', 'T3', 'T4'] },
  { name: 'Diabetes Panel', description: 'Fictional demo bundle: fasting and post-prandial glucose, and HbA1c.', price: '900.00', testCodes: ['FBG', 'PPBG', 'HBA1C'] },
  { name: 'Comprehensive Panel', description: 'Fictional demo bundle: CBC, LFT, KFT, lipid, TSH, glucose, and urine tests.', price: '2500.00', testCodes: ['CBC', 'LFT', 'KFT', 'LIP', 'TSH', 'FBG', 'URE'] },
];

const DEMO_PATIENTS = [
  { firstName: 'Aditi', lastName: 'Nair', phone: '9000000001', dateOfBirth: '1988-04-12', gender: Gender.FEMALE },
  { firstName: 'Rohan', lastName: 'Mehta', phone: '9000000002', dateOfBirth: '1979-11-03', gender: Gender.MALE },
  { firstName: 'Maya', lastName: 'Rao', phone: '9000000003', dateOfBirth: '1995-02-21', gender: Gender.FEMALE },
  { firstName: 'Ishan', lastName: 'Kapoor', phone: '9000000004', dateOfBirth: '1983-08-17', gender: Gender.MALE },
  { firstName: 'Sara', lastName: 'Das', phone: '9000000005', dateOfBirth: '1991-06-29', gender: Gender.FEMALE },
  { firstName: 'Dev', lastName: 'Menon', phone: '9000000006', dateOfBirth: '1975-01-14', gender: Gender.MALE },
  { firstName: 'Nila', lastName: 'Shah', phone: '9000000007', dateOfBirth: '2001-03-08', gender: Gender.FEMALE },
  { firstName: 'Arjun', lastName: 'Sen', phone: '9000000008', dateOfBirth: '1986-09-25', gender: Gender.MALE },
  { firstName: 'Tara', lastName: 'Bose', phone: '9000000009', dateOfBirth: '1998-12-01', gender: Gender.FEMALE },
  { firstName: 'Kabir', lastName: 'Joshi', phone: '9000000010', dateOfBirth: '1971-07-19', gender: Gender.MALE },
  { firstName: 'Leela', lastName: 'Patel', phone: '9000000011', dateOfBirth: '1993-10-11', gender: Gender.FEMALE },
  { firstName: 'Neel', lastName: 'Iyer', phone: '9000000012', dateOfBirth: '1980-05-05', gender: Gender.MALE },
  { firstName: 'Kavya', lastName: 'Thomas', phone: '9000000013', dateOfBirth: '2000-02-16', gender: Gender.FEMALE },
  { firstName: 'Aarav', lastName: 'Kulkarni', phone: '9000000014', dateOfBirth: '1989-04-30', gender: Gender.MALE },
  { firstName: 'Mira', lastName: 'Sethi', phone: '9000000015', dateOfBirth: '1996-08-22', gender: Gender.FEMALE },
];

async function seedDemoUsers(): Promise<void> {
  const demoPassword = process.env.DEMO_USER_PASSWORD;
  if (!demoPassword || demoPassword.length < 12) {
    throw new Error(
      'Set DEMO_USER_PASSWORD to a local value of at least 12 characters before seeding.',
    );
  }

  const usersWithHashedPasswords = await Promise.all(
    DEMO_USERS.map(async (user) => ({
      ...user,
      passwordHash: await bcrypt.hash(demoPassword, 12),
    })),
  );
  await prisma.$transaction(
    usersWithHashedPasswords.map((user) =>
      prisma.user.upsert({
        where: { email: user.email },
        create: user,
        update: {
          ...user,
          isActive: true,
          mustChangePassword: false,
        },
      }),
    ),
  );
  console.info(`Seeded ${DEMO_USERS.length} fictional staff accounts.`);
}

async function seedCatalogueAndPatients(): Promise<void> {
  const categoryIds = new Map<string, string>();
  for (const category of DEMO_CATEGORIES) {
    const record = await prisma.testCategory.upsert({
      where: { code: category.code },
      create: category,
      update: { name: category.name },
    });
    categoryIds.set(category.code, record.id);
  }

  const testIds = new Map<string, string>();
  for (const test of DEMO_TESTS) {
    const categoryId = categoryIds.get(test.categoryCode);
    if (!categoryId) {
      throw new Error(`Missing demo test category ${test.categoryCode}`);
    }
    const record = await prisma.labTest.upsert({
      where: { code: test.code },
      create: {
        code: test.code,
        name: test.name,
        categoryId,
        price: test.price,
        specimenType: test.specimenType,
        department: test.department,
        description: 'Illustrative demo catalogue entry; not a clinical instruction.',
      },
      update: {
        name: test.name,
        categoryId,
        price: test.price,
        specimenType: test.specimenType,
        department: test.department,
        isActive: true,
      },
    });
    testIds.set(test.code, record.id);
  }

  for (const [testCode, parameters] of Object.entries(DEMO_TEST_PARAMETERS)) {
    const labTestId = testIds.get(testCode);
    if (!labTestId) throw new Error(`Missing demo test ${testCode}`);
    for (let index = 0; index < parameters.length; index += 1) {
      const parameter = parameters[index];
      const existing = await prisma.testParameter.findFirst({
        where: { labTestId, name: parameter.name },
      });
      const data = {
        unit: parameter.unit || null,
        referenceRangeLow: parameter.low,
        referenceRangeHigh: parameter.high,
        referenceRangeText: `${parameter.low} - ${parameter.high}`,
        sortOrder: index,
      };
      if (existing) {
        await prisma.testParameter.update({ where: { id: existing.id }, data });
      } else {
        await prisma.testParameter.create({
          data: { labTestId, name: parameter.name, ...data },
        });
      }
    }
  }

  for (const demoPackage of DEMO_PACKAGES) {
    const labTestIds = demoPackage.testCodes.map((code) => {
      const id = testIds.get(code);
      if (!id) throw new Error(`Missing demo test ${code}`);
      return id;
    });
    const record = await prisma.testPackage.upsert({
      where: { name: demoPackage.name },
      create: {
        name: demoPackage.name,
        description: demoPackage.description,
        price: demoPackage.price,
      },
      update: {
        description: demoPackage.description,
        price: demoPackage.price,
        isActive: true,
      },
    });
    await prisma.$transaction([
      prisma.testPackageItem.deleteMany({ where: { packageId: record.id } }),
      prisma.testPackageItem.createMany({
        data: labTestIds.map((labTestId) => ({
          packageId: record.id,
          labTestId,
        })),
      }),
    ]);
  }

  const patientIds: string[] = [];
  for (let index = 0; index < DEMO_PATIENTS.length; index += 1) {
    const patient = DEMO_PATIENTS[index];
    const patientCode = `PAT-DEMO-${String(index + 1).padStart(4, '0')}`;
    const record = await prisma.patient.upsert({
      where: { patientCode },
      create: {
        patientCode,
        ...patient,
        dateOfBirth: new Date(`${patient.dateOfBirth}T00:00:00.000Z`),
      },
      update: {
        ...patient,
        dateOfBirth: new Date(`${patient.dateOfBirth}T00:00:00.000Z`),
        isActive: true,
      },
    });
    patientIds.push(record.id);
  }
  await seedDemoOrders(patientIds, testIds);
  await seedDemoResults();
  console.info(
    `Seeded ${DEMO_CATEGORIES.length} categories, ${DEMO_TESTS.length} illustrative tests, ${DEMO_PACKAGES.length} packages, ${DEMO_PATIENTS.length} fictional patients, and ${DEMO_PATIENTS.length} fictional orders.`,
  );
}

async function seedDemoOrders(
  patientIds: string[],
  testIds: Map<string, string>,
): Promise<void> {
  const receptionist = await prisma.user.findUnique({
    where: { email: 'reception.one@pathlab.demo' },
    select: { id: true },
  });
  const technician = await prisma.user.findUnique({
    where: { email: 'tech.one@pathlab.demo' },
    select: { id: true },
  });
  if (!receptionist || !technician) {
    throw new Error('Seed demo staff accounts before creating demo orders.');
  }

  const selections = [
    ['CBC', 'FBG'],
    ['TSH', 'T3', 'T4'],
    ['LIP'],
    ['CBC', 'LFT', 'KFT'],
    ['URE'],
    ['FBG', 'PPBG', 'HBA1C'],
    ['CRP'],
    ['CBC', 'ESR'],
    ['URIC'],
    ['LFT', 'LIP'],
    ['TSH'],
    ['KFT', 'URE'],
    ['HB', 'CBC'],
    ['HBA1C', 'FBG'],
    ['CRP', 'ESR'],
  ];
  const workflow = [
    {
      order: OrderStatus.NEW,
      item: OrderItemStatus.PENDING,
      sample: SampleStatus.PENDING,
    },
    {
      order: OrderStatus.SAMPLE_COLLECTED,
      item: OrderItemStatus.SAMPLE_COLLECTED,
      sample: SampleStatus.COLLECTED,
    },
    {
      order: OrderStatus.PROCESSING,
      item: OrderItemStatus.PROCESSING,
      sample: SampleStatus.PROCESSING,
    },
  ] as const;
  const testPrices = new Map(DEMO_TESTS.map((test) => [test.code, test.price]));

  for (let index = 0; index < patientIds.length; index += 1) {
    const testCodes = selections[index % selections.length];
    const selectedTests = testCodes.map((code) => {
      const id = testIds.get(code);
      const price = testPrices.get(code);
      if (!id || !price) throw new Error(`Missing seeded test ${code}`);
      return { id, code, price };
    });
    const total = selectedTests.reduce(
      (sum, test) => sum.plus(test.price),
      new Decimal(0),
    );
    const current = workflow[index % workflow.length];
    const orderNumber = `DEMO-ORD-${String(index + 1).padStart(4, '0')}`;
    const sampleId = `DEMO-SMP-${String(index + 1).padStart(4, '0')}`;
    const invoiceNumber = `DEMO-INV-${String(index + 1).padStart(4, '0')}`;

    await prisma.$transaction(async (tx) => {
      const order = await tx.labOrder.upsert({
        where: { orderNumber },
        create: {
          orderNumber,
          patientId: patientIds[index],
          status: current.order,
          notes: 'Fictional seeded workflow example.',
          createdById: receptionist.id,
          items: {
            create: selectedTests.map((test) => {
              const seededTest = DEMO_TESTS.find(
                (seedTest) => seedTest.code === test.code,
              );
              if (!seededTest) throw new Error(`Missing seeded test ${test.code}`);
              return {
                labTestId: test.id,
                testNameSnapshot: seededTest.name,
                priceSnapshot: test.price,
                status: current.item,
              };
            }),
          },
        },
        update: {
          patientId: patientIds[index],
          status: current.order,
          notes: 'Fictional seeded workflow example.',
          items: {
            updateMany: {
              where: {},
              data: { status: current.item },
            },
          },
        },
        include: { items: true },
      });

      await tx.sample.upsert({
        where: { sampleId },
        create: {
          sampleId,
          orderId: order.id,
          status: current.sample,
          ...(current.sample !== SampleStatus.PENDING
            ? { collectedById: technician.id, collectedAt: new Date() }
            : {}),
        },
        update: {
          orderId: order.id,
          status: current.sample,
          ...(current.sample !== SampleStatus.PENDING
            ? { collectedById: technician.id, collectedAt: new Date() }
            : { collectedById: null, collectedAt: null }),
        },
      });

      await tx.invoice.upsert({
        where: { orderId: order.id },
        create: {
          invoiceNumber,
          orderId: order.id,
          patientId: patientIds[index],
          subtotal: total.toFixed(2),
          totalAmount: total.toFixed(2),
          createdById: receptionist.id,
          items: {
            create: order.items.map((item) => ({
              orderItemId: item.id,
              testNameSnapshot: item.testNameSnapshot,
              priceSnapshot: item.priceSnapshot,
            })),
          },
        },
        update: {
          invoiceNumber,
          patientId: patientIds[index],
          subtotal: total.toFixed(2),
          totalAmount: total.toFixed(2),
          status: InvoiceStatus.UNPAID,
        },
      });
    });
  }
}

async function seedDemoResults(): Promise<void> {
  const [technician, pathologist] = await Promise.all([
    prisma.user.findUnique({
      where: { email: 'tech.one@pathlab.demo' },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { email: 'pathologist.one@pathlab.demo' },
      select: { id: true },
    }),
  ]);
  if (!technician || !pathologist) {
    throw new Error('Seed demo technicians and pathologists before creating demo results.');
  }

  const examples = [
    {
      orderNumber: 'DEMO-ORD-0003',
      status: ResultStatus.SUBMITTED,
      orderStatus: OrderStatus.RESULT_ENTERED,
      sampleStatus: SampleStatus.PROCESSING,
      values: {
        'Total Cholesterol': '180',
        'HDL Cholesterol': '35',
        'LDL Cholesterol': '110',
        Triglycerides: '140',
      },
    },
    {
      orderNumber: 'DEMO-ORD-0008',
      status: ResultStatus.APPROVED,
      orderStatus: OrderStatus.APPROVED,
      sampleStatus: SampleStatus.COMPLETED,
      values: {
        Hemoglobin: '18',
        'WBC Count': '7',
        'Platelet Count': '250',
        'RBC Count': '4.8',
        Hematocrit: '42',
        ESR: '12',
      },
    },
  ] as const;

  for (const example of examples) {
    const order = await prisma.labOrder.findUnique({
      where: { orderNumber: example.orderNumber },
      include: { items: { include: { labTest: { include: { parameters: true } } } } },
    });
    if (!order) throw new Error(`Missing demo order ${example.orderNumber}`);

    await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        const result = await tx.testResult.upsert({
          where: { orderItemId: item.id },
          create: {
            orderItemId: item.id,
            enteredById: technician.id,
            status: example.status,
            ...(example.status === ResultStatus.APPROVED
              ? { reviewedById: pathologist.id, reviewedAt: new Date() }
              : {}),
            notes: 'Fictional seeded example; not for clinical use.',
          },
          update: {
            enteredById: technician.id,
            status: example.status,
            reviewedById:
              example.status === ResultStatus.APPROVED ? pathologist.id : null,
            reviewedAt: example.status === ResultStatus.APPROVED ? new Date() : null,
            rejectionReason: null,
            notes: 'Fictional seeded example; not for clinical use.',
          },
        });
        await tx.resultParameter.deleteMany({ where: { testResultId: result.id } });
        const values = item.labTest.parameters.map((parameter) => {
          const value = example.values[parameter.name as keyof typeof example.values];
          if (value === undefined) {
            throw new Error(`Missing demo result value for ${parameter.name} in ${example.orderNumber}`);
          }
          const numericValue = new Decimal(value);
          const isAbnormal =
            (parameter.referenceRangeLow !== null &&
              numericValue.lessThan(parameter.referenceRangeLow.toString())) ||
            (parameter.referenceRangeHigh !== null &&
              numericValue.greaterThan(parameter.referenceRangeHigh.toString()));
          return {
            testResultId: result.id,
            testParameterId: parameter.id,
            value,
            unit: parameter.unit,
            isAbnormal,
          };
        });
        await tx.resultParameter.createMany({ data: values });
        await tx.labOrderItem.update({
          where: { id: item.id },
          data: {
            status: example.status === ResultStatus.APPROVED
              ? OrderItemStatus.APPROVED
              : OrderItemStatus.RESULT_ENTERED,
          },
        });
      }

      await tx.labOrder.update({
        where: { id: order.id },
        data: { status: example.orderStatus },
      });
      await tx.sample.updateMany({
        where: { orderId: order.id },
        data: { status: example.sampleStatus },
      });

      if (example.status === ResultStatus.APPROVED) {
        await tx.labReport.upsert({
          where: { orderId: order.id },
          create: {
            orderId: order.id,
            generatedAt: new Date(),
            status: ReportStatus.PENDING_APPROVAL,
          },
          update: {
            generatedAt: new Date(),
            approvedById: null,
            approvedAt: null,
            pdfPath: null,
            status: ReportStatus.PENDING_APPROVAL,
          },
        });
      }
    });
  }
}

async function seed(): Promise<void> {
  await seedDemoUsers();
  await seedCatalogueAndPatients();
}

seed()
  .catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : 'Unknown seed failure';
    console.error(`Demo seed failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
