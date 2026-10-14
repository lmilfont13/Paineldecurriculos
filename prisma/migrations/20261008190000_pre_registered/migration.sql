-- Cadastro rápido pelo gestor (só e-mail); o candidato completa depois.
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "preRegistered" BOOLEAN NOT NULL DEFAULT false;
