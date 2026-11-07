-- AlterTable
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "hasImpediment" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "impedimentReason" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "impedimentAt" TIMESTAMP(3);

