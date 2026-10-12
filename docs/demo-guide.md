# Demo Guide — Pathology Lab Management System

> **IMPORTANT DISCLAIMER**
> This is a demonstration system using entirely fictional data.
> All patient names, test results, invoices, and transactions are fabricated for demo purposes.
> This system is NOT certified, NOT production-ready for clinical use, and NOT suitable for actual diagnosis.
> All prices are illustrative demo values and do not represent current market prices.

---

## Quick start

```bash
# Prerequisites: Node.js ≥ 20, pnpm ≥ 9, Docker Desktop

# 1. Start PostgreSQL
docker compose up -d

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# 4. Configure a local demo password in `apps/api/.env`
# Set DEMO_USER_PASSWORD to a local value of at least 12 characters.

# 5. Run migrations and seed fictional staff, patients, catalogue, and orders
pnpm db:migrate
pnpm db:seed

# 6. Start the application
pnpm dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Swagger docs: http://localhost:3001/api/docs

---

## Demo accounts

All accounts use the local `DEMO_USER_PASSWORD` value configured before seeding.
The password is deliberately not committed to the repository. Do not reuse a
production password for this demo.

### Owner and administrator accounts

| Employee code | Email                    | Role  |
|---------------|--------------------------|-------|
| EMP-001       | owner@pathlab.demo       | OWNER |
| EMP-002       | admin.one@pathlab.demo   | ADMIN |
| EMP-003       | admin.two@pathlab.demo   | ADMIN |

### Staff accounts

| Employee codes | Email pattern                          | Role         | Count |
|----------------|----------------------------------------|--------------|-------|
| EMP-004–007    | reception.one–four@pathlab.demo        | RECEPTIONIST | 4     |
| EMP-008–012    | tech.one–five@pathlab.demo             | TECHNICIAN   | 5     |
| EMP-013–015    | pathologist.one–three@pathlab.demo     | PATHOLOGIST  | 3     |

---

## Available in this milestone

- Sign in and out using the fictional staff accounts above.
- View the application and database readiness status on the dashboard.
- Owners and administrators can search the staff directory, create staff
  accounts, and deactivate eligible accounts.
- New and reset staff passwords are temporary and must be changed on first
  sign-in.
- Administrators cannot create or promote accounts to OWNER or ADMIN; those
  role assignments are restricted to an OWNER and enforced by the API.

Patient registration and history, the illustrative test catalogue and packages,
order/invoice creation, and sample tracking are available in this milestone.
Billing/payment actions, result entry/review, final reports, and operational
KPIs remain planned. All records are fictional and must not be used clinically.

---

## Seeded demo data summary

- **3 fictional administrative accounts**: 1 OWNER and 2 ADMIN accounts.
- **12 fictional staff accounts** across RECEPTIONIST, TECHNICIAN, and
  PATHOLOGIST roles.
- **15 fictional patients**, 8 catalogue categories, 15 illustrative tests, and
  4 illustrative packages.
- **15 fictional sample orders and invoices**, distributed across new,
  collected, and processing sample states.
- No result values or reports are seeded.

---

## Future enhancements (not in demo)

The following features are planned for future development phases:

- Barcode label printing for samples
- Appointment scheduling and home sample collection
- WhatsApp/SMS/email notifications for report delivery
- Real payment gateway integration (Razorpay, PayU)
- Lab analyzer / machine integration (HL7/ASTM)
- Reagent and consumable inventory management
- Multi-branch management
- Advanced analytics and trend reporting
- Patient portal (self-service report access)
- Doctor referral management

---

## Known demo limitations

1. Billing/payment actions, result/report workflows, and monitoring KPIs are
   not implemented yet.
2. Database migrations and API startup require an available PostgreSQL
   instance; local Docker verification is pending.
3. The shared demo password is configured locally and is not committed.
4. The system is a single-branch demonstration with no backup or disaster
   recovery configuration.

---

## Support and next steps

To proceed with full development, contact the development team to discuss:
- Production infrastructure requirements
- Clinical data validation and compliance requirements
- Integration with existing lab equipment
- Branding and customization
- Training and onboarding plan
