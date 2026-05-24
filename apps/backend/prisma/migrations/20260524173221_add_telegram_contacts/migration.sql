-- AlterTable
ALTER TABLE "AIModelConfig" ALTER COLUMN "isActive" SET DEFAULT false;

-- CreateTable
CREATE TABLE "TelegramContact" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT,
    "type" TEXT NOT NULL DEFAULT 'private',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramContact_chatId_key" ON "TelegramContact"("chatId");
