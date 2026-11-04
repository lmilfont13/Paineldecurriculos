-- Instagram do candidato (opcional): no perfil e em cada candidatura.
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "instagram" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "instagram" TEXT;
