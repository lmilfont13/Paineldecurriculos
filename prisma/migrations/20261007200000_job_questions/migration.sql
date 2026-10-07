-- Perguntas do formulário por vaga (jobId null = pergunta da empresa).
ALTER TABLE "FormField" ADD COLUMN IF NOT EXISTS "jobId" TEXT;

CREATE INDEX IF NOT EXISTS "FormField_jobId_idx" ON "FormField"("jobId");

DO $$ BEGIN
  ALTER TABLE "FormField" ADD CONSTRAINT "FormField_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
