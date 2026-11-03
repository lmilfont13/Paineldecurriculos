-- LGPD: registro do consentimento dado na candidatura (data e versão do texto).
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "consentAt" TIMESTAMP(3);
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "consentVersion" TEXT;
