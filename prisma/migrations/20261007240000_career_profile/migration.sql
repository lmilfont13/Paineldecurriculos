-- Análise de perfil sob demanda (áreas, nota estimada por área, resumo).
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "aiCareer" JSONB;
