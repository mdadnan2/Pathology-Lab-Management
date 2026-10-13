ALTER TYPE "AuditAction" ADD VALUE 'PERMISSION_GRANTED';
ALTER TYPE "AuditAction" ADD VALUE 'PERMISSION_REVOKED';

CREATE TYPE "PermissionEventType" AS ENUM ('GRANTED', 'REVOKED');

ALTER TABLE "lab_reports"
ADD COLUMN "generatedById" TEXT;

CREATE TABLE "user_permission_events" (
    "id" TEXT NOT NULL,
    "sequence" BIGSERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "eventType" "PermissionEventType" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permission_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_permission_events_userId_permission_createdAt_idx"
ON "user_permission_events"("userId", "permission", "createdAt");

CREATE UNIQUE INDEX "user_permission_events_sequence_key"
ON "user_permission_events"("sequence");

CREATE INDEX "user_permission_events_actorId_createdAt_idx"
ON "user_permission_events"("actorId", "createdAt");

ALTER TABLE "user_permission_events"
ADD CONSTRAINT "user_permission_events_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_permission_events"
ADD CONSTRAINT "user_permission_events_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "lab_reports"
ADD CONSTRAINT "lab_reports_generatedById_fkey"
FOREIGN KEY ("generatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
