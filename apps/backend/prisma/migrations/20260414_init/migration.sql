-- Enums
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'MEMBER');
CREATE TYPE "MeetingStatus" AS ENUM ('CREATED', 'PROCESSING', 'READY', 'FAILED');
CREATE TYPE "RunStatus" AS ENUM ('queued', 'running', 'success', 'failed');
CREATE TYPE "StepStatus" AS ENUM ('started', 'success', 'failed');
CREATE TYPE "ExportTarget" AS ENUM ('TELEGRAM', 'EMAIL');
CREATE TYPE "ModelPurpose" AS ENUM ('transcription', 'postprocessing');
CREATE TYPE "WorkspaceKind" AS ENUM ('PERSONAL', 'TEAM');
CREATE TYPE "ExportStatus" AS ENUM ('queued', 'success', 'failed');
CREATE TYPE "SubscriptionStatus" AS ENUM ('trial', 'active', 'canceled', 'expired');
CREATE TYPE "ProcessingStepName" AS ENUM (
  'file_received',
  'transcription_requested',
  'transcription_completed',
  'source_deleted',
  'speakers_identified',
  'summary_completed',
  'tasks_extracted',
  'meeting_qa_prepared',
  'results_saved',
  'processing_completed'
);

-- Tables
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Workspace" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" "WorkspaceKind" NOT NULL DEFAULT 'PERSONAL',
  "personalOwnerUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Membership" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "role" "MembershipRole" NOT NULL DEFAULT 'MEMBER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Meeting" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" "MeetingStatus" NOT NULL DEFAULT 'CREATED',
  "sourceFilename" TEXT,
  "sourceMimeType" TEXT,
  "sourceDurationSec" INTEGER,
  "sourceTempPath" TEXT,
  "processingError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Transcript" (
  "id" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "language" TEXT,
  "rawText" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Transcript_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TranscriptSegment" (
  "id" TEXT NOT NULL,
  "transcriptId" TEXT NOT NULL,
  "speakerId" TEXT,
  "startSec" DOUBLE PRECISION NOT NULL,
  "endSec" DOUBLE PRECISION NOT NULL,
  "text" TEXT NOT NULL,
  "segmentOrder" INTEGER NOT NULL,
  CONSTRAINT "TranscriptSegment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Speaker" (
  "id" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "speakerKey" TEXT NOT NULL,
  "autoLabel" TEXT NOT NULL,
  "suggestedName" TEXT,
  "confirmedName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Speaker_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Summary" (
  "id" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Summary_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskItem" (
  "id" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "autoText" TEXT NOT NULL,
  "finalText" TEXT NOT NULL,
  "autoAssignee" TEXT,
  "finalAssignee" TEXT,
  "autoDueDate" TEXT,
  "finalDueDate" TEXT,
  "done" BOOLEAN NOT NULL DEFAULT false,
  "taskOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingQuestion" (
  "id" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MeetingQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExportLog" (
  "id" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "target" "ExportTarget" NOT NULL,
  "destination" TEXT NOT NULL,
  "status" "ExportStatus" NOT NULL,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExportLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Subscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "planCode" TEXT NOT NULL,
  "status" "SubscriptionStatus" NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AIModelConfig" (
  "id" TEXT NOT NULL,
  "purpose" "ModelPurpose" NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "configJson" JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AIModelConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingProcessingRun" (
  "id" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "RunStatus" NOT NULL DEFAULT 'queued',
  "provider" TEXT,
  "model" TEXT,
  "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MeetingProcessingRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProcessingStepLog" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "stepName" "ProcessingStepName" NOT NULL,
  "status" "StepStatus" NOT NULL,
  "provider" TEXT,
  "model" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  CONSTRAINT "ProcessingStepLog_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Workspace_personalOwnerUserId_key" ON "Workspace"("personalOwnerUserId");
CREATE UNIQUE INDEX "Membership_userId_workspaceId_key" ON "Membership"("userId", "workspaceId");
CREATE UNIQUE INDEX "Transcript_meetingId_key" ON "Transcript"("meetingId");
CREATE UNIQUE INDEX "Speaker_meetingId_speakerKey_key" ON "Speaker"("meetingId", "speakerKey");
CREATE UNIQUE INDEX "Summary_meetingId_key" ON "Summary"("meetingId");
CREATE UNIQUE INDEX "AIModelConfig_purpose_key" ON "AIModelConfig"("purpose");

-- Indexes
CREATE INDEX "Workspace_kind_idx" ON "Workspace"("kind");
CREATE INDEX "Membership_workspaceId_idx" ON "Membership"("workspaceId");
CREATE INDEX "Meeting_workspaceId_createdAt_idx" ON "Meeting"("workspaceId", "createdAt");
CREATE INDEX "TranscriptSegment_transcriptId_segmentOrder_idx" ON "TranscriptSegment"("transcriptId", "segmentOrder");
CREATE INDEX "TranscriptSegment_speakerId_idx" ON "TranscriptSegment"("speakerId");
CREATE INDEX "Speaker_meetingId_idx" ON "Speaker"("meetingId");
CREATE INDEX "TaskItem_meetingId_taskOrder_idx" ON "TaskItem"("meetingId", "taskOrder");
CREATE INDEX "MeetingQuestion_meetingId_createdAt_idx" ON "MeetingQuestion"("meetingId", "createdAt");
CREATE INDEX "ExportLog_meetingId_createdAt_idx" ON "ExportLog"("meetingId", "createdAt");
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");
CREATE INDEX "MeetingProcessingRun_meetingId_createdAt_idx" ON "MeetingProcessingRun"("meetingId", "createdAt");
CREATE INDEX "ProcessingStepLog_runId_stepName_idx" ON "ProcessingStepLog"("runId", "stepName");
CREATE INDEX "ProcessingStepLog_userId_startedAt_idx" ON "ProcessingStepLog"("userId", "startedAt");

-- Foreign keys
ALTER TABLE "Workspace"
ADD CONSTRAINT "Workspace_personalOwnerUserId_fkey"
FOREIGN KEY ("personalOwnerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Membership"
ADD CONSTRAINT "Membership_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Membership"
ADD CONSTRAINT "Membership_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Meeting"
ADD CONSTRAINT "Meeting_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Transcript"
ADD CONSTRAINT "Transcript_meetingId_fkey"
FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TranscriptSegment"
ADD CONSTRAINT "TranscriptSegment_transcriptId_fkey"
FOREIGN KEY ("transcriptId") REFERENCES "Transcript"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TranscriptSegment"
ADD CONSTRAINT "TranscriptSegment_speakerId_fkey"
FOREIGN KEY ("speakerId") REFERENCES "Speaker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Speaker"
ADD CONSTRAINT "Speaker_meetingId_fkey"
FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Summary"
ADD CONSTRAINT "Summary_meetingId_fkey"
FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskItem"
ADD CONSTRAINT "TaskItem_meetingId_fkey"
FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MeetingQuestion"
ADD CONSTRAINT "MeetingQuestion_meetingId_fkey"
FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MeetingQuestion"
ADD CONSTRAINT "MeetingQuestion_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExportLog"
ADD CONSTRAINT "ExportLog_meetingId_fkey"
FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExportLog"
ADD CONSTRAINT "ExportLog_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Subscription"
ADD CONSTRAINT "Subscription_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MeetingProcessingRun"
ADD CONSTRAINT "MeetingProcessingRun_meetingId_fkey"
FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MeetingProcessingRun"
ADD CONSTRAINT "MeetingProcessingRun_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProcessingStepLog"
ADD CONSTRAINT "ProcessingStepLog_runId_fkey"
FOREIGN KEY ("runId") REFERENCES "MeetingProcessingRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProcessingStepLog"
ADD CONSTRAINT "ProcessingStepLog_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
