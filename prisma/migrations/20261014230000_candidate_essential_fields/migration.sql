-- Campos essenciais para busca e triagem rápida sem redundância com o currículo

-- AlterTable Candidate
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3);
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "neighborhood" TEXT;
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "desiredRole" TEXT;
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "salaryExpectation" TEXT;
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "workPreference" TEXT;
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "availability" TEXT;
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "hasCnh" TEXT;
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "isPcd" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "pcdDetails" TEXT;

-- AlterTable Application
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3);
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "neighborhood" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "desiredRole" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "salaryExpectation" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "workPreference" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "availability" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "hasCnh" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "isPcd" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "pcdDetails" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Application_companyId_neighborhood_idx" ON "Application"("companyId", "neighborhood");
CREATE INDEX IF NOT EXISTS "Application_companyId_desiredRole_idx" ON "Application"("companyId", "desiredRole");
