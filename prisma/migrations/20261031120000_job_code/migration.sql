-- Código da vaga, exibido ao candidato para diferenciar vagas com o mesmo cargo.
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "code" TEXT;
