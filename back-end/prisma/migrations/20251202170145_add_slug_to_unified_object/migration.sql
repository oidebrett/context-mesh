/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `SyncedObject` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "SyncedObject" ADD COLUMN     "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SyncedObject_slug_key" ON "SyncedObject"("slug");
