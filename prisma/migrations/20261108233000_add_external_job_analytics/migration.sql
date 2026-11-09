-- Adiciona contadores de visualizações e cliques para as vagas do Mural de Oportunidades
ALTER TABLE "ExternalJob" ADD COLUMN IF NOT EXISTS "viewsCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ExternalJob" ADD COLUMN IF NOT EXISTS "clicksCount" INTEGER NOT NULL DEFAULT 0;
