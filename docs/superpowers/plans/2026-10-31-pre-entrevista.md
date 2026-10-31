# Pré-entrevista Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O gestor escolhe quais informações pedir (estado civil, filhos, resumo profissional, RG, CPF) a um candidato aprovado; o candidato é avisado por site + e-mail e responde num formulário; o gestor vê as respostas na ficha, com RG/CPF mascarados.

**Architecture:** Segue o padrão MVC do projeto (view → controller → service → repository → prisma; models com zod/regras puras). A lógica pura (campos, CPF, máscara, "o que falta", texto do WhatsApp) fica em um model novo e testado. O aviso reusa o caminho do "recado do gestor" (`notification.service` + `email.service` via `runInBackground`).

**Tech Stack:** Next.js (versão com breaking changes: ler `node_modules/next/dist/docs/` antes de mexer em rotas/server actions), Prisma/Postgres (Supabase), zod, vitest, Resend.

**Spec:** `docs/superpowers/specs/2026-10-31-pre-entrevista-design.md`

## Global Constraints

- Regra 1: `companyId` sempre da sessão do gestor; o candidato só acessa a própria candidatura (`findApplicationForCandidate(candidateId, applicationId)`).
- Regra 2/3: a IA de triagem não muda status por causa disto e não recebe estes dados; prompt da IA intocado.
- Sem novo valor em `AppStatus`. Candidato nunca é bloqueado por não responder.
- RG/CPF nunca aparecem em notificação, e-mail, lista, log ou `metadata` de auditoria; na ficha ficam mascarados até o gestor clicar em mostrar.
- Texto da interface em pt-BR; arquivos novos seguem o estilo do vizinho (comentários curtos em pt-BR, `"use server"`/`server-only` como nos pares).
- Migrations em SQL idempotente (`IF NOT EXISTS`) em `prisma/migrations/<timestamp>_<nome>/migration.sql`.
- Perguntas oferecidas ao gestor: exatamente `maritalStatus`, `children`, `professionalSummary`, `rg`, `cpf`.

## Review Focus

- CPF com 11 dígitos iguais (`111.11111-11`), com pontuação ou sem: deve ser recusado/aceito conforme dígitos verificadores, nunca quebrar.
- Candidato abre o formulário de uma candidatura que não é dele, ou sem login: não vê nada (404/redirect para entrar).
- Gestor pede campos e o candidato já tinha todos: nada é enviado (erro claro para o gestor).
- Candidatura sem telefone ou sem conta de candidato: sem botão de WhatsApp / só e-mail, sem erro.
- Candidato envia o formulário com campos que não foram pedidos: são ignorados (só os pedidos são gravados).

---

### Task 1: Regras puras da pré-entrevista

**Files:**
- Create: `src/server/models/pre-interview.model.ts`
- Test: `src/server/models/pre-interview.model.test.ts`

**Interfaces:**
- Produces:
  - `export const INFO_FIELDS = ["maritalStatus","children","professionalSummary","rg","cpf"] as const; export type InfoField = (typeof INFO_FIELDS)[number];`
  - `export const infoFieldLabels: Record<InfoField, string>` (Estado civil / Filhos / Resumo profissional / RG / CPF)
  - `export const MARITAL_STATUSES = ["Solteiro(a)","Casado(a)","União estável","Divorciado(a)","Viúvo(a)"] as const`
  - `export function isValidCpf(value: string): boolean`
  - `export function maskCpf(value: string): string` → `***.456.789-**` para `12345678901`... (mostra dígitos 4–9 e o hífen)
  - `export function maskRg(value: string): string` → mantém só os 2 últimos caracteres, resto `*`
  - `export type KnownInfo = { maritalStatus: string|null; hasChildren: boolean|null; professionalSummary: string|null; rg: string|null; cpf: string|null; hasResumeText: boolean }`
  - `export function missingInfoFields(known: KnownInfo): InfoField[]` (`children` falta se `hasChildren===null`; `professionalSummary` falta se vazio **e** `!hasResumeText`)
  - `export function buildInfoAnswerSchema(fields: InfoField[])` → zod object só com os campos pedidos (`maritalStatus` enum, `hasChildren` boolean + `childrenCount` int 0–20 opcional, `professionalSummary` 20–1500 chars, `rg` 5–20 chars, `cpf` refinado com `isValidCpf`)
  - `export function whatsappInfoLink(params: { phone: string; candidateName: string; companyName: string; jobTitle: string; url: string }): string` → `https://wa.me/55<dígitos>?text=<encoded>`; não duplica o prefixo `55`

- [ ] **Step 1: Write the failing tests** em `pre-interview.model.test.ts`: `isValidCpf("529.982.247-25")` true; `isValidCpf("111.111.111-11")` false; `isValidCpf("123")` false; `maskCpf("52998224725")` é `"***.982.247-**"`; `maskRg("1234567")` é `"*****67"`; `missingInfoFields` com tudo nulo e `hasResumeText:true` retorna `["maritalStatus","children","rg","cpf"]`; com `hasResumeText:false` inclui `professionalSummary`; schema de `["cpf"]` recusa CPF inválido e ignora campo não pedido (`rg`); `whatsappInfoLink` com telefone `(85) 99999-1234` começa com `https://wa.me/5585999991234?text=` e, com telefone já `5585…`, não vira `555585…`.
- [ ] **Step 2: Run** `npx vitest run src/server/models/pre-interview.model.test.ts` — Expected: FAIL (módulo não existe).
- [ ] **Step 3: Implement** o model conforme as assinaturas acima (CPF: dígitos verificadores clássicos; rejeita sequências repetidas).
- [ ] **Step 4: Run** o mesmo comando — Expected: PASS.
- [ ] **Step 5: Commit** `git add src/server/models/pre-interview.model*.ts && git commit -m "feat: regras puras da pré-entrevista (campos, CPF, máscara, WhatsApp)"`

### Task 2: Colunas no banco e tipo de notificação

**Files:**
- Modify: `prisma/schema.prisma` (model `Application`, enum `NotificationType`)
- Create: `prisma/migrations/20261031180000_pre_interview/migration.sql`

**Interfaces:**
- Produces: colunas opcionais em `Application`: `maritalStatus String?`, `hasChildren Boolean?`, `childrenCount Int?`, `professionalSummary String?`, `rg String?`, `cpf String?`, `infoRequestedFields String[] @default([])`, `infoRequestedAt DateTime?`, `infoAnsweredAt DateTime?`; valor `INFO_REQUESTED` em `NotificationType`.

- [ ] **Step 1: Editar** `schema.prisma` com os campos acima (comentário `///` explicando cada grupo, no estilo do arquivo).
- [ ] **Step 2: Escrever a migration** com `ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS ...` para cada coluna e `ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'INFO_REQUESTED';`.
- [ ] **Step 3: Run** `npx prisma generate && npx tsc --noEmit -p .` — Expected: sem erros.
- [ ] **Step 4: Commit** `git add prisma && git commit -m "feat: colunas e notificação de pré-entrevista"`
- [ ] **Step 5 (só no deploy, com confirmação do usuário):** aplicar a migration no Supabase (`xbjvwotigqkemjhdyqol`) **antes** do merge no `master`, como foi feito com `job_code`.

### Task 3: Serviço de pedido e resposta

**Files:**
- Modify: `src/server/models/notification.model.ts`, `src/server/services/notification.service.ts`, `src/server/services/email.service.ts`, `src/server/repositories/application.repository.ts`, `src/server/services/application.service.ts`, `src/server/repositories/audit.repository.ts`
- Test: `src/server/models/notification.model.test.ts` (ou o arquivo de teste do model de notificação existente)

**Interfaces:**
- Consumes: Task 1 (`InfoField`, `missingInfoFields`, `buildInfoAnswerSchema`), Task 2 (colunas).
- Produces:
  - `infoRequestedNotification(companyName: string, jobTitle: string): { type: "INFO_REQUESTED"; title: string; body: string }` — texto sem dados sensíveis, diz que falta preencher um formulário rápido.
  - `notifyInfoRequested(params: { candidateId: string|null; applicationId: string; companyName: string; jobTitle: string }): Promise<void>`
  - `sendInfoRequestEmail(params: { brand: EmailBrand; to: string; candidateName: string; jobTitle: string; applicationId: string }): Promise<void>` (CTA para `candidateLink(brand, applicationId)` + `/pre-entrevista`)
  - `updateInfoRequest(id: string, data: { infoRequestedFields: InfoField[]; infoRequestedAt: Date }): Promise<Application>` e `updateInfoAnswers(id: string, data: Partial<{ maritalStatus: string; hasChildren: boolean; childrenCount: number|null; professionalSummary: string; rg: string; cpf: string }> & { infoAnsweredAt: Date })`
  - `requestApplicationInfo(companyId: string, id: string, fields: InfoField[]): Promise<{ ok: true } | { ok: false; error: string }>` — erro se candidatura não é da empresa, se `fields` vazio, ou se todos os campos pedidos já estão preenchidos; grava `infoRequestedFields/At`, dispara site + e-mail em `runInBackground` (padrão de `sendManagerMessage`).
  - `saveInfoAnswers(candidateId: string, applicationId: string, input: unknown): Promise<{ ok: true } | { ok: false; error: string }>` — valida posse com `findApplicationForCandidate`, valida com `buildInfoAnswerSchema(app.infoRequestedFields)`, grava só os pedidos e `infoAnsweredAt`.
  - `AuditAction` ganha `"INFO_SOLICITADA"` e `"DADOS_SENSIVEIS_VISTOS"`.

- [ ] **Step 1: Write the failing test** para `infoRequestedNotification`: `type` é `"INFO_REQUESTED"`, `body` contém o nome da vaga e **não** contém "CPF" nem "RG".
- [ ] **Step 2: Run** o teste — Expected: FAIL.
- [ ] **Step 3: Implement** model + service + repository + e-mail seguindo `sendManagerMessage`/`managerMessageNotification` linha a linha.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit -p .` — Expected: tudo passa.
- [ ] **Step 5: Commit** `git commit -am "feat: serviço de pedido e resposta da pré-entrevista"`

### Task 4: Server actions

**Files:**
- Modify: `src/server/controllers/application.controller.ts`

**Interfaces:**
- Consumes: Task 3.
- Produces:
  - `requestInfoAction(applicationId: string, fields: string[]): Promise<{ ok: true } | { error: string }>` — `requireManager()`, filtra `fields` por `INFO_FIELDS`, chama `requestApplicationInfo`, registra auditoria `INFO_SOLICITADA` com `metadata: { fields }` (só chaves, nunca valores), `revalidatePath(/candidaturas/<id>)`.
  - `submitInfoAnswersAction(slug: string, applicationId: string, _prev: InterviewState, formData: FormData): Promise<InterviewState>` — pega o candidato da sessão (`getSessionCandidate`), chama `saveInfoAnswers`, devolve `{ ok: true }` ou `{ error }`.
  - `revealSensitiveInfoAction(applicationId: string): Promise<{ rg: string|null; cpf: string|null } | null>` — `requireManager()`, confere posse por `getCompanyApplication`, registra auditoria `DADOS_SENSIVEIS_VISTOS` (sem valores no metadata).

- [ ] **Step 1: Implement** as três actions seguindo o estilo de `sendMessageAction` (incluindo `try/catch` da auditoria que nunca bloqueia).
- [ ] **Step 2: Run** `npx tsc --noEmit -p .` — Expected: sem erros.
- [ ] **Step 3: Commit** `git commit -am "feat: actions de pedido, resposta e revelação de dados da pré-entrevista"`

### Task 5: Formulário do candidato

**Files:**
- Create: `src/app/[slug]/minhas-candidaturas/[id]/pre-entrevista/page.tsx`, `src/components/public/pre-interview-form.tsx`
- Modify: `src/app/[slug]/minhas-candidaturas/[id]/page.tsx` (aviso com link quando há pedido em aberto)

**Interfaces:**
- Consumes: Task 3 (`findApplicationForCandidate` já inclui os campos novos), Task 4 (`submitInfoAnswersAction`).
- Produces: rota `/<slug>/minhas-candidaturas/<id>/pre-entrevista`.

- [ ] **Step 1: Ler** `node_modules/next/dist/docs/` sobre páginas dinâmicas e server actions desta versão do Next.
- [ ] **Step 2: Implement** a página: sem sessão → `redirect` para `/<slug>/entrar?next=…` (igual à página irmã); candidatura que não é do candidato → `notFound()`; sem pedido em aberto (`infoRequestedFields` vazio) ou já respondido → mensagem "Nada pendente"; senão renderiza só os campos pedidos, com aviso de uso dos dados (LGPD) e marca da empresa via `--brand-*`.
- [ ] **Step 3: Implement** `pre-interview-form.tsx` (client, `useActionState` com `submitInfoAnswersAction.bind(...)`) no padrão visual do `apply-wizard`; CPF com máscara de digitação.
- [ ] **Step 4: Em** `minhas-candidaturas/[id]/page.tsx`, quando `infoRequestedAt` existe e `infoAnsweredAt` é nulo, mostrar cartão "Falta responder algumas informações" com link para a rota nova.
- [ ] **Step 5: Run** `npx tsc --noEmit -p .` e abrir a página com `npm run dev` (candidato demo) — Expected: formulário só com os campos pedidos; envio inválido mostra erro; envio válido mostra confirmação.
- [ ] **Step 6: Commit** `git add -A src && git commit -m "feat: formulário de pré-entrevista na área do candidato"`

### Task 6: Painel do gestor

**Files:**
- Create: `src/components/gestor/info-request-box.tsx`
- Modify: `src/app/(gestor)/candidaturas/[id]/page.tsx` (nova seção ao lado do "Recado para o candidato"), `src/app/(gestor)/auditoria/page.tsx` (rótulos das duas ações novas)

**Interfaces:**
- Consumes: Task 1 (`missingInfoFields`, `infoFieldLabels`, `maskCpf`, `maskRg`, `whatsappInfoLink`), Task 4 (`requestInfoAction`, `revealSensitiveInfoAction`).

- [ ] **Step 1: Implement** `InfoRequestBox` (client): checkboxes das 5 perguntas, já preenchidas aparecem desabilitadas com "já informado", as que faltam vêm marcadas; botão "Enviar pedido" chama `requestInfoAction`; após enviar, mostra "Aviso enviado ao candidato (site + e-mail)" e, se houver telefone, botão "Abrir no WhatsApp" com `whatsappInfoLink(...)` (a URL do formulário usa `appUrl()`/slug da empresa passados por props).
- [ ] **Step 2: Mostrar na ficha** as respostas recebidas: estado civil, filhos (e quantos), resumo; RG/CPF mascarados com botão "Mostrar" que chama `revealSensitiveInfoAction` e troca pelo valor.
- [ ] **Step 3: Rótulos** `INFO_SOLICITADA` ("Informações solicitadas") e `DADOS_SENSIVEIS_VISTOS` ("Dados sensíveis vistos") na página de auditoria.
- [ ] **Step 4: Run** `npx tsc --noEmit -p . && npx vitest run` e testar com `npm run dev`: pedir só CPF → candidato vê só CPF; responder → gestor vê mascarado; clicar em mostrar → aparece e entra na auditoria.
- [ ] **Step 5: Commit** `git add -A src && git commit -m "feat: pedido de informações e respostas no painel do gestor"`

### Task 7: Fechamento

- [ ] **Step 1: Run** `npx vitest run && npx tsc --noEmit -p . && npm run lint` — Expected: tudo limpo.
- [ ] **Step 2:** Atualizar `CONTEXT.md` (seção de rotas/regras) com a rota nova e a regra "RG/CPF só mascarados na UI e nunca em e-mail/notificação".
- [ ] **Step 3:** Com confirmação do usuário: aplicar a migration no Supabase, push da branch e merge no `master`.
