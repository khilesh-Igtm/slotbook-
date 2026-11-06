-- AlterEnum
ALTER TYPE "NotificationStatus" ADD VALUE 'PROCESSING';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "recipientEmail" TEXT,
ADD COLUMN "recipientType" TEXT NOT NULL DEFAULT 'GUEST',
ADD COLUMN "subject" TEXT,
ADD COLUMN "payload" JSONB,
ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastError" TEXT,
ADD COLUMN "nextAttemptAt" TIMESTAMPTZ,
ADD COLUMN "lockedAt" TIMESTAMPTZ,
ADD COLUMN "providerMessageId" TEXT;

-- Backfill recipientEmail for any existing notifications from associated Booking
UPDATE "Notification" n
SET "recipientEmail" = b."guestEmail"
FROM "Booking" b
WHERE n."bookingId" = b."id" AND n."recipientEmail" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Notification_bookingId_type_recipientType_key" ON "Notification"("bookingId", "type", "recipientType");

-- CreateIndex
CREATE INDEX "Notification_status_nextAttemptAt_idx" ON "Notification"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "Notification_lockedAt_idx" ON "Notification"("lockedAt");

