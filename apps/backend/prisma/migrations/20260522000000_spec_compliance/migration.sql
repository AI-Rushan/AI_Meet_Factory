-- ============================================================
-- Spec compliance migration: align codebase with PROJECT_SPEC
-- ============================================================

-- 1. User: add name and isAdmin
ALTER TABLE "User" ADD COLUMN "name" TEXT;
ALTER TABLE "User" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- 2. Meeting: add createdByUserId
ALTER TABLE "Meeting" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Meeting_createdByUserId_idx" ON "Meeting"("createdByUserId");

-- 3. Summary: add version
ALTER TABLE "Summary" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- 4. Subscription: add billingPeriod enum and workspaceId
CREATE TYPE "BillingPeriod" AS ENUM ('monthly', 'yearly');
ALTER TABLE "Subscription" ADD COLUMN "billingPeriod" "BillingPeriod";
ALTER TABLE "Subscription" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Subscription_workspaceId_idx" ON "Subscription"("workspaceId");

-- 5. AIModelConfig: remove unique constraint on purpose to allow multiple configs per type
DROP INDEX "AIModelConfig_purpose_key";
CREATE INDEX "AIModelConfig_purpose_isActive_idx" ON "AIModelConfig"("purpose", "isActive");

-- 6. RunStatus enum: rename queued->pending, success->completed, add partial_failed
ALTER TYPE "RunStatus" RENAME VALUE 'queued' TO 'pending';
ALTER TYPE "RunStatus" RENAME VALUE 'success' TO 'completed';
ALTER TYPE "RunStatus" ADD VALUE 'partial_failed';

-- 7. MeetingProcessingRun: replace provider/model with separate transcription/postprocessing fields, add workspaceId
ALTER TABLE "MeetingProcessingRun" ADD COLUMN "transcriptionProvider"  TEXT;
ALTER TABLE "MeetingProcessingRun" ADD COLUMN "transcriptionModel"     TEXT;
ALTER TABLE "MeetingProcessingRun" ADD COLUMN "postprocessingProvider" TEXT;
ALTER TABLE "MeetingProcessingRun" ADD COLUMN "postprocessingModel"    TEXT;
ALTER TABLE "MeetingProcessingRun" ADD COLUMN "workspaceId"            TEXT;
ALTER TABLE "MeetingProcessingRun" ADD CONSTRAINT "MeetingProcessingRun_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "MeetingProcessingRun_workspaceId_idx" ON "MeetingProcessingRun"("workspaceId");

-- Copy existing provider/model data into transcription fields for historical records
UPDATE "MeetingProcessingRun"
SET "transcriptionProvider" = "provider",
    "transcriptionModel"    = "model";

-- Drop old single provider/model columns
ALTER TABLE "MeetingProcessingRun" DROP COLUMN "provider";
ALTER TABLE "MeetingProcessingRun" DROP COLUMN "model";
