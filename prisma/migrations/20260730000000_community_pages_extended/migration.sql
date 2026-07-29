-- AlterTable: CommunityPage extended fields
ALTER TABLE "community_pages"
  ADD COLUMN IF NOT EXISTS "subscriptionStartDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "orgType" TEXT,
  ADD COLUMN IF NOT EXISTS "establishedYear" INTEGER,
  ADD COLUMN IF NOT EXISTS "operatesFrom" TEXT,
  ADD COLUMN IF NOT EXISTS "officeAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "googleMapsUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "googleFormName" TEXT,
  ADD COLUMN IF NOT EXISTS "googleFormLink" TEXT,
  ADD COLUMN IF NOT EXISTS "gallery" JSONB,
  ADD COLUMN IF NOT EXISTS "communityVisibility" TEXT DEFAULT 'PUBLIC',
  ADD COLUMN IF NOT EXISTS "geoVisibility" TEXT DEFAULT 'Global',
  ADD COLUMN IF NOT EXISTS "geoCountry" TEXT,
  ADD COLUMN IF NOT EXISTS "geoState" TEXT,
  ADD COLUMN IF NOT EXISTS "geoCity" TEXT;
