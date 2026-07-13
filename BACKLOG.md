# Backlog — Triagem

Backlog vivo do produto. Estados: `todo` · `parcial` · `bloqueado`.
As user stories já entregues estão documentadas no histórico (MVP completo,
commit `a9b8566`).

---

## Épico 1 — Contas de candidato 🆕 (prioridade alta)

> Mudança de posicionamento: sai o "candidate-se sem criar conta", entra
> "crie sua conta uma vez, candidate-se em 1 clique nas próximas".

| ID | User story | Status | Notas |
|----|-----------|--------|-------|
| CA1 | Como candidato, ao clicar em "Candidatar-se agora" sem estar logado, quero criar minha conta (ou entrar) na hora, com a marca da empresa, para continuar a candidatura de onde parei. | ✅ feito | `/[slug]/entrar?next=…` |
| CA2 | Como candidato, quero que meus dados básicos (nome, telefone, currículo) fiquem salvos no meu perfil ao enviar uma candidatura, para nunca digitá-los de novo. | ✅ feito | Perfil atualizado a cada envio |
| CA3 | Como candidato, ao me candidatar a outra vaga, quero o formulário pré-preenchido com meu perfil, para enviar em segundos. | ✅ feito | Extras pré-preenchem na mesma empresa; núcleo em qualquer uma |
| CA4 | Como candidato, quero uma página "Minhas candidaturas" com o status de cada processo, para acompanhar sem depender de e-mail. | ✅ feito | "Reprovado" aparece como "Finalizado" para o candidato |
| CA5 | Como candidato, quero editar meu perfil e trocar meu currículo, para manter meus dados atuais. | ✅ feito | `/[slug]/perfil` (nome, telefone, currículo) |
| CA6 | Como sistema, não devo permitir duas candidaturas do mesmo candidato à mesma vaga, para evitar duplicidade na triagem. | ✅ feito | Unique (candidateId, jobId) + validação no service |
| CA7 | Como candidato, quero recuperar minha senha por e-mail, para não perder acesso ao meu histórico. | ✅ feito | `/recuperar-senha` + `/redefinir-senha` (unificado com G13; e-mail enviado pelo Supabase) |
| CA8 | Como candidato, quero excluir minha conta e meus dados, para exercer meus direitos (LGPD). | ✅ feito | Currículos apagados do Storage; candidaturas anonimizadas (empresa mantém registro sem dados pessoais); auth removido |

**Tarefas técnicas do épico:**
- [ ] Desenhar no Figma: cadastro/login candidato, "Minhas candidaturas", perfil (regra: ler Figma antes de codar tela)
- [ ] Migration: model `Candidate` (authId, name, email unique, phone, resumeUrl, linkedin/github) + `Application.candidateId` + unique (candidateId, jobId)
- [ ] Auth: 3ª classe de sessão no `auth.service`/guards (staff vs candidato); `proxy.ts` protege `/candidatar` e `/minhas-candidaturas`
- [ ] Reescrever `ApplyWizard`: pré-preenchimento do perfil, currículo do perfil com opção de trocar
- [ ] Atualizar copy "sem criar conta" (default do schema `heroSubtitle`, seed, card da P2)
- [ ] RLS nas tabelas novas
- [ ] E-mail de boas-vindas/verificação do candidato (Resend)

## Épico 2 — Pendências do painel do gestor

| ID | User story | Status | Notas |
|----|-----------|--------|-------|
| G11 | Como gestora, quero selecionar várias candidaturas e mudar status em massa, para processar volume (frame E9). | ✅ feito | Filtros completos (busca/vaga/status/score), chips, barra em massa, exportar CSV |
| G12 | Como gestora, quero comparar candidatos lado a lado, para desempatar finalistas (frame E10). | ✅ feito | `/candidaturas/comparar` (via barra em massa, 2–3 selecionados) |
| G13 | Como gestora, quero recuperar minha senha, para não depender do admin. | ✅ feito | Fluxo unificado com CA7 (`/recuperar-senha`) |
| G14 | Como gestora, quero receber notificação de candidaturas novas, para não precisar checar o painel. | ✅ feito | E-mail imediato via Resend a cada candidatura |

## Épico 3 — Console admin

| ID | User story | Status | Notas |
|----|-----------|--------|-------|
| A5 | Como admin, quero ver faturamento e atividade dos clientes, para acompanhar o negócio. | todo | Único item pendente (decisão do dono do produto) |
| A6 | Como admin, quero fazer upload do logo do cliente (arquivo), em vez de colar URL, para agilizar o onboarding. | ✅ feito | Wizard + aba Marca; bucket `logos` público |
| A7 | Como admin, quero reenviar/redefinir a senha do gestor de um cliente, para dar suporte. | ✅ feito | Aba "Gestor" na edição da empresa |

## Épico 4 — Qualidade, estados e produção

| ID | Item | Status | Notas |
|----|------|--------|-------|
| Q1 | Estados de erro do envio de candidatura conforme frame P8 (106:142) e confirmações/toasts do E12 (104:332). | ✅ feito | Banner P8 no wizard + toasts nas ações do gestor |
| Q2 | Candidato: e-mails transacionais de mudança de status (entrevista/aprovado), disparados pela ação do gestor. | ✅ feito | Reprovação enviada como "processo finalizado" (neutro) — revisar copy se quiser |
| Q3 | Deploy na Vercel: chaves Inngest, `DATABASE_URL` → pooler do Supabase (IPv4), domínio verificado no Resend, `ANTHROPIC_API_KEY`. | todo | Código pronto; checklist no README |
| Q4 | Testes automatizados (models, schemas, contraste da marca). | ✅ feito | `npm test` — 18 testes; services com I/O ficam para integração |
| Q5 | Telas mobile M1–M5 conferidas com o Figma. | ✅ feito | M1 em cards no mobile; títulos responsivos |

---

### Ordem sugerida da próxima sprint

1. **CA1–CA3 + CA6** (núcleo das contas de candidato — desbloqueia o resto do épico)
2. **G13/CA7** (reset de senha unificado — pequeno e destrava suporte)
3. **G11** (ações em massa — alto valor para o gestor)
4. **Q3** (deploy) quando as chaves estiverem em mãos
