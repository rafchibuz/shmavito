-- Keep the author's editorial title separate from the original Avito title.
ALTER TABLE "Listing"
ADD COLUMN "originalTitle" TEXT,
ADD COLUMN "submitterComment" TEXT;

-- Existing listings used the Avito title as their only title.
UPDATE "Listing"
SET "originalTitle" = "title"
WHERE "originalTitle" IS NULL;
