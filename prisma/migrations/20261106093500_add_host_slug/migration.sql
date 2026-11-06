-- AlterTable
ALTER TABLE "Host" ADD COLUMN "slug" TEXT;

-- Generate slug for existing hosts based on name
UPDATE "Host" 
SET "slug" = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM("name"), '[^a-zA-Z0-9]+', '-', 'g'), '^-+|-+$', '', 'g'))
WHERE "slug" IS NULL;

-- Fallback for empty names
UPDATE "Host"
SET "slug" = 'host-' || SUBSTRING("id", 1, 8)
WHERE "slug" IS NULL OR "slug" = '';

-- Make slug NOT NULL
ALTER TABLE "Host" ALTER COLUMN "slug" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Host_slug_key" ON "Host"("slug");

