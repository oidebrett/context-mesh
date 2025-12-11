-- CreateTable
CREATE TABLE "SchemaMapping" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "mapping" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchemaMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SchemaMapping_userId_provider_model_key" ON "SchemaMapping"("userId", "provider", "model");
