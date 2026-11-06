-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "cancellationKey" TEXT NOT NULL,
ADD COLUMN     "reservedEndAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "reservedStartAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "IdempotencyKey" ADD COLUMN     "requestHash" TEXT,
ADD COLUMN     "responseBody" TEXT,
ADD COLUMN     "statusCode" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Booking_cancellationKey_key" ON "Booking"("cancellationKey");

-- CreateIndex
CREATE INDEX "Booking_hostId_reservedStartAt_reservedEndAt_idx" ON "Booking"("hostId", "reservedStartAt", "reservedEndAt");

-- CreateIndex
CREATE INDEX "Booking_cancellationKey_idx" ON "Booking"("cancellationKey");

-- 1. Enable btree_gist extension for PostgreSQL exclusion constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Add GiST exclusion constraint on active bookings for host buffer-adjusted intervals
-- This prevents any overlapping reserved intervals for the same host at the database level.
-- Cancelled bookings ("status" = 'CANCELLED') are excluded from the constraint so released slots can be re-booked.
ALTER TABLE "Booking" ADD CONSTRAINT "no_overlapping_reserved_bookings"
  EXCLUDE USING gist (
    "hostId" WITH =,
    tstzrange("reservedStartAt", "reservedEndAt") WITH &&
  )
  WHERE ("status" != 'CANCELLED');

-- 3. Add CHECK constraint ensuring reserved bounds properly encompass the booking interval
ALTER TABLE "Booking" ADD CONSTRAINT "check_booking_reserved_bounds"
  CHECK ("reservedStartAt" <= "startAt" AND "reservedEndAt" >= "endAt" AND "reservedEndAt" > "reservedStartAt");

