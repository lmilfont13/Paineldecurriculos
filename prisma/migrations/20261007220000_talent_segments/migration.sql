-- Segmentação do currículo (área e nível), área da pasta e stand-by
-- (candidato do banco de talentos analisado contra outras vagas).
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "aiArea" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "aiLevel" TEXT;
ALTER TABLE "TalentFolder" ADD COLUMN IF NOT EXISTS "area" TEXT;

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
