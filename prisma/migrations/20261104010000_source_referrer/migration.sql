-- Origem da candidatura e indicação por funcionários.
-- Application.source: de onde o candidato veio (instagram, whatsapp, google, indicacao, direto…)
-- Application.referrerCode: código do indicador (liga com Referrer)
-- Referrer: funcionário ou colaborador que indica candidatos via link próprio.

-- 1. Novos campos na Application
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "referrerCode" TEXT;

-- Índice para relatórios de origem por empresa e por vaga
CREATE INDEX IF NOT EXISTS "Application_companyId_source_idx"
  ON "Application" ("companyId", "source");

CREATE INDEX IF NOT EXISTS "Application_jobId_source_idx"
  ON "Application" ("jobId", "source");

-- 2. Tabela de indicadores (funcionários que compartilham link)
CREATE TABLE IF NOT EXISTS "Referrer" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Referrer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Referrer_companyId_fkey" FOREIGN KEY ("companyId")
    REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Um código por empresa (o mesmo funcionário não repete)
CREATE UNIQUE INDEX IF NOT EXISTS "Referrer_companyId_code_key"
  ON "Referrer" ("companyId", "code");

-- Índice de busca por empresa
CREATE INDEX IF NOT EXISTS "Referrer_companyId_idx"
  ON "Referrer" ("companyId");

-- RLS: bloquear acesso via PostgREST (mesmo padrão do resto)
ALTER TABLE "Referrer" ENABLE ROW LEVEL SECURITY;
