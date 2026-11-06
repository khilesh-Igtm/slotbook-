-- AlterTable
ALTER TABLE "Host" ADD COLUMN "passwordHash" TEXT;

-- Seed default password hash for existing demo host (password: SlotbookDev2026!)
UPDATE "Host"
SET "passwordHash" = '$2b$10$hx658itbCzXOhwNoNqLiE.wOiMUGSMb9TcoxSiTDI9AI7QKCv6I2e'
WHERE "email" = 'alex.slotbook@example.com' AND "passwordHash" IS NULL;

