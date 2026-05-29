-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "emailVerifyToken" TEXT,
ADD COLUMN "emailVerifyExpires" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_emailVerifyToken_key" ON "User"("emailVerifyToken");

-- Existing users are considered verified (they registered before this feature was added)
UPDATE "User" SET "emailVerified" = true WHERE "emailVerifyToken" IS NULL;
