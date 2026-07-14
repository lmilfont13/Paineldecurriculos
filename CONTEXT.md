# CONTEXT.md — Triagem

SaaS multi-tenant de recrutamento white-label. Design completo no Figma: https://www.figma.com/design/GrcF3tr4NmqFq7Kxc4CouS/ Leia o Figma antes de qualquer tela ou componente.

## Stack

```
Next.js 14+ App Router + TypeScript
Supabase          → Postgres + Auth + Storage (currículos e logos)
Prisma            → ORM
Tailwind + shadcn/ui
Gemini API        → gemini-flash-lite (análise de currículos)
Inngest           → jobs em background (análise de IA)
Resend            → e-mails transacionais
Vercel            → deploy
```

## Variáveis de ambiente

```env
DATABASE_URL=""
DIRECT_URL=""                    # Supabase direct connection (para migrations)
NEXT_PUBLIC_SUPABASE_URL=""
NEXT_PUBLIC_SUPABASE_ANON_KEY=""
SUPABASE_SERVICE_ROLE_KEY=""
GEMINI_API_KEY=""
INNGEST_EVENT_KEY=""
INNGEST_SIGNING_KEY=""
RESEND_API_KEY=""
NEXT_PUBLIC_APP_URL=""
```

## Estrutura de rotas

```
/[slug]/vagas                    → lista pública de vagas da empresa
/[slug]/vagas/[jobId]            → detalhe público da vaga
/[slug]/vagas/[jobId]/candidatar → formulário multi-step (4 passos)
/login                           → login unificado (gestor + admin)
/admin/empresas                  → console admin
/admin/empresas/nova             → wizard 5 passos
/admin/empresas/[id]             → editar empresa (abas)
/(gestor)/painel                 → dashboard do gestor
/(gestor)/vagas                  → lista de vagas
/(gestor)/vagas/nova             → criar vaga multi-step (4 passos)
/(gestor)/candidaturas           → lista com filtros e ações em massa
/(gestor)/candidaturas/[id]      → detalhe com bloco de IA
/(gestor)/formulario             → construtor de formulário
```

## Schema Prisma

Ver `prisma/schema.prisma` (fonte da verdade).

## Regras que não podem ser quebradas

### 1. Isolamento multi-tenant

Todo query de gestor filtra por `companyId` da sessão — nunca do request.

```typescript
// SEMPRE assim:
const session = await auth()
const jobs = await prisma.job.findMany({
  where: { companyId: session.user.companyId }
})
```

Ativar Row Level Security no Supabase como segunda camada de proteção.

### 2. Fluxo da IA — nunca bloquear o candidato

```
candidatura salva → responde 200 → dispara Inngest → IA analisa em background
```

A IA só atualiza `aiScore`, `aiReasoning` e `aiState`. Jamais muda `AppStatus` — isso é sempre decisão manual do gestor.

### 3. Prompt da IA (não alterar)

```
Ignore nome, gênero, idade, foto e origem. Avalie só habilidades e experiência.
Retorne JSON: { "score": 0-100, "reasoning": "máximo 2 frases" }
```

### 4. Marca do cliente

- Cores e logo → fluxo público, login do gestor e **acentos do painel do gestor**
  (botões primários, item ativo da sidebar, badges, stepper, links de ação),
  sempre via CSS vars `--brand-primary` / `--brand-secondary` /
  `--brand-foreground` (contraste calculado em `brandForeground()`).
- Base do painel do gestor → neutra (fundos, textos, bordas); a marca entra só
  como acento.
- Console admin → sempre neutro (é a plataforma, não um tenant).

### 5. Upload de currículo

- Apenas PDF, máx 5 MB, salvar no Supabase Storage
- Extrair texto com `pdf-parse` antes de mandar para a IA

### 6. Arquitetura em camadas (MVC)

Todo código segue separação em camadas — nenhuma camada pula a de baixo. Tudo vive em `src/`:

```
src/app/                  → ROUTES + VIEW: rotas file-based do App Router
                            (páginas, layouts). Só renderiza e chama controllers.

src/components/           → VIEW: componentes de UI (shadcn em components/ui/).
                            Sem regra de negócio, sem acesso a dados.

src/proxy.ts              → borda HTTP (Next 16; substitui middleware.ts):
                            refresh de sessão e proteção de rotas por prefixo.

src/server/controllers/   → CONTROLLER: server actions e handlers de route.
                            Valida input (schemas dos models), resolve
                            sessão/tenant e chama services. Não acessa Prisma.

src/server/models/        → MODEL (domínio): tipos de domínio, DTOs e schemas
                            zod. Sem I/O — só tipos e funções puras.

src/server/services/      → MODEL (regra de negócio): isolamento multi-tenant,
                            fluxo de IA, regras de status. Única camada que
                            orquestra repositories e integrações.

src/server/repositories/  → MODEL (acesso a dados): único lugar que importa
                            `lib/prisma`. Uma função por consulta/mutação.

src/lib/                  → INFRA: clients (prisma, supabase, inngest, resend,
                            gemini) e utilitários puros.
```

Fluxo: `Route/View → Controller → Service → Repository → Prisma`, com os
`models` compartilhados por controllers/services/repositories como contrato.
O filtro por `companyId` da sessão (regra 1) é aplicado na camada de
service/repository — nunca deixado a cargo da view.

## O que já existe

- [x] Design completo no Figma (35 telas — leia antes de codar qualquer tela)
- [x] Schema do banco (`prisma/schema.prisma`)
- [x] Decisões de arquitetura (acima)

## O que falta construir

- [x] npx create-next-app + configurar Supabase + Prisma
- [x] Middleware de tenant (resolve empresa pelo slug — `src/proxy.ts` + layout `[slug]`)
- [x] Auth com Supabase Auth (gestor + admin, login unificado `/login`)
- [x] Fluxo público: vagas, detalhe, formulário multi-step, confirmação
- [x] Fluxo gestor: painel, vagas, candidaturas, detalhe, formulário builder
- [x] Fluxo admin: empresas, wizard 5 passos, editar em abas
- [x] Análise de IA com Inngest (dev: `npx inngest-cli dev`; deploy precisa das chaves)
- [x] E-mails com Resend (no-op até configurar RESEND_API_KEY)
- [x] Row Level Security no Supabase (`prisma/rls.sql` aplicado)
