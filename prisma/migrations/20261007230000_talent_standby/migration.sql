-- Stand-by do banco de talentos: candidato guardado analisado contra outras
-- vagas. Substitui a "vaga gerada pela pasta" (coluna TalentFolder.jobId),
-- que foi descartada antes de ter qualquer dado.
ALTER TABLE "TalentFolder" DROP CONSTRAINT IF EXISTS "TalentFolder_jobId_fkey";
ALTER TABLE "TalentFolder" DROP COLUMN IF EXISTS "jobId";

CREATE TABLE IF NOT EXISTS "TalentMatch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "score" INTEGER,
    "reasoning" TEXT,
    "state" "AIState" NOT NULL DEFAULT 'WAITING',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TalentMatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TalentMatch_applicationId_jobId_key" ON "TalentMatch"("applicationId", "jobId");
CREATE INDEX IF NOT EXISTS "TalentMatch_companyId_jobId_idx" ON "TalentMatch"("companyId", "jobId");

DO $$ BEGIN
  ALTER TABLE "TalentMatch" ADD CONSTRAINT "TalentMatch_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TalentMatch" ADD CONSTRAINT "TalentMatch_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "TalentMatch" ENABLE ROW LEVEL SECURITY;
