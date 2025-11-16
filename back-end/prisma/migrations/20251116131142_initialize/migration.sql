-- AlterTable
ALTER TABLE "UserConnections" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "SyncedObject" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "summary" TEXT,
    "url" TEXT,
    "mimeType" TEXT,
    "json" JSONB NOT NULL,
    "hash" TEXT,
    "embedding" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncedObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enableSummaries" BOOLEAN NOT NULL DEFAULT false,
    "llmMode" TEXT NOT NULL DEFAULT 'local',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncedObject_provider_idx" ON "SyncedObject"("provider");

-- CreateIndex
CREATE INDEX "SyncedObject_connectionId_idx" ON "SyncedObject"("connectionId");

-- CreateIndex
CREATE INDEX "SyncedObject_objectType_idx" ON "SyncedObject"("objectType");

-- CreateIndex
CREATE UNIQUE INDEX "SyncedObject_provider_externalId_key" ON "SyncedObject"("provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantSettings_userId_key" ON "TenantSettings"("userId");
