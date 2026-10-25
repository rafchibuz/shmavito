ALTER TABLE "Listing" ADD COLUMN "nextCheckAt" TIMESTAMP(3);

CREATE INDEX "Listing_state_deletedAt_nextCheckAt_idx"
ON "Listing"("state", "deletedAt", "nextCheckAt");
