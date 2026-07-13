# Triagem

SaaS multi-tenant de recrutamento white-label com triagem por IA.
Contexto completo do produto e regras invioláveis: [CONTEXT.md](CONTEXT.md) · Backlog: [BACKLOG.md](BACKLOG.md).

## Rodando local

```bash
npm install
npx prisma migrate deploy              # aplica migrations no banco do .env
node --env-file=.env prisma/seed.mjs   # dados demo (empresa technova, logins de teste)
npm run dev
```

Em outro terminal, para a análise de IA em background:

```bash
npx inngest-cli@latest dev
```

Logins demo (senha `triagem123`): `admin@triagem.app` (console) e
`ana@technova.com` (gestora). Página pública demo: `/technova/vagas`.

Testes: `npm test` (vitest — models e schemas).

## Deploy (Vercel) — checklist

1. **Variáveis de ambiente** (copie de `.env.example`):
   - `DATABASE_URL` → use o **Session Pooler** do Supabase (IPv4):
     `postgresql://postgres.<ref>:<senha>@aws-0-<região>.pooler.supabase.com:5432/postgres`
   - `DIRECT_URL` → conexão direta (migrations)
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY` → ativa a análise de currículos (claude-3-haiku)
   - `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` → do app criado em app.inngest.com
     (sem elas o client roda em modo dev e os jobs não processam em produção)
   - `RESEND_API_KEY` → e-mails transacionais
   - `NEXT_PUBLIC_APP_URL` → URL pública (usada no link de reset de senha)
2. **Resend**: verifique um domínio em *Domains* e troque o remetente `FROM` em
   `src/server/services/email.service.ts` — com `onboarding@resend.dev`
   os e-mails só chegam ao dono da conta Resend.
3. **Inngest**: após o primeiro deploy, registre o app em app.inngest.com
   apontando para `https://<seu-domínio>/api/inngest`.
4. **Supabase Auth**: em *Authentication → URL Configuration*, defina a Site URL
   como `https://<seu-domínio>` (necessário para o reset de senha por e-mail).
5. **Banco**: `npx prisma migrate deploy` (usa `DIRECT_URL`) e, uma única vez,
   execute `prisma/rls.sql` no SQL Editor do Supabase.

## Arquitetura

`Routes/View (src/app, src/components) → Controller (src/server/controllers) →
Service (src/server/services) → Repository (src/server/repositories) → Prisma`,
com `src/server/models` (tipos + zod) como contrato entre camadas e
`src/proxy.ts` na borda HTTP. Só repositories importam o Prisma.
