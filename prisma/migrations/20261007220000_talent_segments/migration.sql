-- Segmentação do currículo (área e nível) e vaga criada a partir da pasta.
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "aiArea" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "aiLevel" TEXT;
ALTER TABLE "TalentFolder" ADD COLUMN IF NOT EXISTS "area" TEXT;
ALTER TABLE "TalentFolder" ADD COLUMN IF NOT EXISTS "jobId" TEXT;

DO $$ BEGIN
  ALTER TABLE "TalentFolder" ADD CONSTRAINT "TalentFolder_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
