/*
  Warnings:

  - You are about to drop the column `hash` on the `SyncedObject` table. All the data in the column will be lost.
  - You are about to drop the column `json` on the `SyncedObject` table. All the data in the column will be lost.
  - You are about to drop the column `objectType` on the `SyncedObject` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `SyncedObject` table. All the data in the column will be lost.
  - Added the required column `canonicalUrl` to the `SyncedObject` table without a default value. This is not possible if the table is not empty.
  - Added the required column `contentHash` to the `SyncedObject` table without a default value. This is not possible if the table is not empty.
  - Added the required column `metadataRaw` to the `SyncedObject` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `SyncedObject` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "SyncedObject_objectType_idx";

-- Step 1: Add new columns with temporary defaults
ALTER TABLE "SyncedObject"
ADD COLUMN     "canonicalUrl" TEXT,
ADD COLUMN     "contentHash" TEXT,
ADD COLUMN     "metadataNormalized" JSONB,
ADD COLUMN     "metadataRaw" JSONB,
ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "state" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "type" TEXT;

-- Step 2: Migrate existing data
UPDATE "SyncedObject"
SET
  "type" = "objectType",
  "metadataRaw" = "json",
  "contentHash" = COALESCE("hash", ''),
  "sourceUrl" = "url",
  "canonicalUrl" = '/item/' || "id"
WHERE "type" IS NULL;

-- Step 3: Make required columns NOT NULL
ALTER TABLE "SyncedObject"
ALTER COLUMN "canonicalUrl" SET NOT NULL,
ALTER COLUMN "contentHash" SET NOT NULL,
ALTER COLUMN "metadataRaw" SET NOT NULL,
ALTER COLUMN "type" SET NOT NULL;

-- Step 4: Drop old columns
ALTER TABLE "SyncedObject"
DROP COLUMN "hash",
DROP COLUMN "json",
DROP COLUMN "objectType",
DROP COLUMN "url";

-- CreateIndex
CREATE INDEX "SyncedObject_type_idx" ON "SyncedObject"("type");

-- CreateIndex
CREATE INDEX "SyncedObject_state_idx" ON "SyncedObject"("state");
