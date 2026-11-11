-- Fecha o acesso direto às tabelas pela Data API do Supabase (PostgREST).
--
-- O app acessa o banco só pelo servidor, via Prisma, com o role dono das
-- tabelas (não é afetado por RLS). Já os roles `anon` e `authenticated` são os
-- usados pela chave pública que vai no navegador: sem RLS, qualquer visitante
-- conseguia ler e alterar candidaturas, candidatos e usuários direto pela API.
-- O `prisma/rls.sql` previa isso, mas nunca foi aplicado neste banco, e cada
-- tabela nova criada pelo Prisma nascia exposta.
--
-- 1) RLS ligado em TODAS as tabelas do schema public (sem policies = nega tudo
--    para anon/authenticated).
-- 2) Privilégios revogados de anon/authenticated (defesa em profundidade).
-- 3) Privilégios padrão revogados, para tabelas futuras não nascerem expostas.
-- Idempotente: pode rodar mais de uma vez.

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated;
  END IF;
END $$;
