-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('INDIVIDUAL', 'CORPORATE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('success', 'failed', 'refunded');

-- AlterEnum
ALTER TYPE "SubscriptionStatus" ADD VALUE 'free';
ALTER TYPE "SubscriptionStatus" ADD VALUE 'grace';

-- AlterTable: User
ALTER TABLE "User" ADD COLUMN "accountType" "AccountType" NOT NULL DEFAULT 'INDIVIDUAL';

-- AlterTable: Subscription
ALTER TABLE "Subscription"
  ADD COLUMN "planId" TEXT,
  ADD COLUMN "gracePeriodEndsAt" TIMESTAMP(3),
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelReason" TEXT,
  ADD COLUMN "note" TEXT;

-- CreateTable: Plan
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceMonthly" DOUBLE PRECISION NOT NULL,
    "priceYearly" DOUBLE PRECISION NOT NULL,
    "minutesPerMonth" INTEGER NOT NULL DEFAULT 0,
    "meetingsPerMonth" INTEGER NOT NULL DEFAULT 0,
    "storageDays" INTEGER NOT NULL DEFAULT 365,
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 14,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

-- CreateTable: Payment
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateTable: UsageRecord
CREATE TABLE "UsageRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "audioMinutes" INTEGER NOT NULL DEFAULT 0,
    "meetingsCount" INTEGER NOT NULL DEFAULT 0,
    "transcriptionCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "summaryCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qaCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UsageRecord_userId_period_key" ON "UsageRecord"("userId", "period");
CREATE INDEX "UsageRecord_userId_idx" ON "UsageRecord"("userId");

-- AddForeignKeys
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed initial plans
INSERT INTO "Plan" ("id", "code", "name", "priceMonthly", "priceYearly", "minutesPerMonth", "meetingsPerMonth", "storageDays", "gracePeriodDays", "isActive", "createdAt") VALUES
  (gen_random_uuid()::text, 'free',    'Бесплатный', 0,    0,     60,  5,  90,  0,  true, NOW()),
  (gen_random_uuid()::text, 'starter', 'Стартер',    490,  4900,  300, 20, 180, 14, true, NOW()),
  (gen_random_uuid()::text, 'pro',     'Про',        990,  9900,  0,   0,  365, 14, true, NOW());
