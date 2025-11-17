-- CreateTable
CREATE TABLE "ConnectionSyncConfig" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "syncConfig" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectionSyncConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConnectionSyncConfig_connectionId_idx" ON "ConnectionSyncConfig"("connectionId");

-- CreateIndex
CREATE INDEX "ConnectionSyncConfig_provider_idx" ON "ConnectionSyncConfig"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectionSyncConfig_connectionId_provider_key" ON "ConnectionSyncConfig"("connectionId", "provider");
