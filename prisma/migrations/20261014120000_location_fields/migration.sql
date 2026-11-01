-- Localização do candidato: preenchida pelo próprio no formulário de candidatura.
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "city"         TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "neighborhood" TEXT;
