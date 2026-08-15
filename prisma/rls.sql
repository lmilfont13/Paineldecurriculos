-- Row Level Security (regra 1 — segunda camada de proteção multi-tenant).
-- O app acessa o banco via Prisma com o role `postgres` (dono das tabelas),
-- que não é afetado pelo RLS. Habilitar RLS sem policies bloqueia qualquer
-- acesso via API PostgREST do Supabase (roles anon/authenticated), impedindo
-- vazamento entre tenants por esse caminho.

ALTER TABLE "Company"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Job"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FormField"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Application" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Answer"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Candidate"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StatusEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
