-- Transparência da IA (modelo + checklist por critério) e isolamento da simulação.
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "aiModel" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "aiChecklist" JSONB;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- Candidatos fictícios da simulação usam o domínio reservado .invalid.
UPDATE "Application" SET "isDemo" = true WHERE "email" LIKE '%@example.invalid';

CREATE INDEX IF NOT EXISTS "Application_companyId_isDemo_idx" ON "Application"("companyId", "isDemo");
