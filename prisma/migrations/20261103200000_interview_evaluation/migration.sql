-- Ficha de avaliação da entrevista (interna: o candidato nunca vê).
CREATE TABLE IF NOT EXISTS "InterviewEvaluation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "evaluatorName" TEXT,
    "evaluatorEmail" TEXT NOT NULL,
    "criteria" JSONB NOT NULL DEFAULT '[]',
    "recommendation" TEXT,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InterviewEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InterviewEvaluation_companyId_applicationId_idx"
  ON "InterviewEvaluation"("companyId", "applicationId");
CREATE UNIQUE INDEX IF NOT EXISTS "InterviewEvaluation_applicationId_evaluatorId_key"
  ON "InterviewEvaluation"("applicationId", "evaluatorId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InterviewEvaluation_companyId_fkey') THEN
    ALTER TABLE "InterviewEvaluation" ADD CONSTRAINT "InterviewEvaluation_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InterviewEvaluation_applicationId_fkey') THEN
    ALTER TABLE "InterviewEvaluation" ADD CONSTRAINT "InterviewEvaluation_applicationId_fkey"
      FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Regra 1 (segunda camada): sem policies, a API pública do Supabase não lê esta tabela.
ALTER TABLE "InterviewEvaluation" ENABLE ROW LEVEL SECURITY;
