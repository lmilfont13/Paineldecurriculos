# Relatório de investigação — Empresa e Candidato

Investigação profunda do estado atual (produção em mt-triagem.vercel.app +
código), focada nas linhas **empresa (gestor)** e **público/candidato**.
Admin fora do escopo por decisão do dono do produto.
Severidade: 🔴 bug/bloqueio real · 🟡 fricção relevante · 🟢 oportunidade.

---

## 1. Bugs e problemas confirmados

### 🔴 Candidato fica trancado fora do próprio histórico
Confirmado em produção: as rotas do candidato vivem sob o slug da empresa
(`/[slug]/minhas-candidaturas`, `/[slug]/perfil`). Quando a empresa é
desativada, essas rotas retornam **404** — o Pedro, que se candidatou à
Órbita, hoje não consegue ver suas candidaturas nem seu perfil, nem excluir
a própria conta (problema até de LGPD). A conta do candidato é global, mas
a UX dele é refém do tenant. **É o maior defeito estrutural da linha do
candidato.**

### 🔴 Candidato repete o wizard inteiro para descobrir que já se candidatou
`getApplyPageData` não verifica candidatura existente. O candidato preenche
os 4 passos e só no envio recebe "Você já se candidatou a esta vaga" — e o
banner P8 ainda anexa **"é só tentar de novo"**, que é falso para um erro
permanente (tentar de novo nunca vai funcionar). Dois defeitos em um:
detecção tardia + copy de recuperação errado para erros não-recuperáveis.

### 🟡 Aprovar/Reprovar individual não confirma (inconsistência com o bulk)
Na E4 e na comparação, um clique em "Reprovar" dispara e-mail ao candidato
sem confirmação — enquanto a ação em massa (corrigida) confirma e avisa do
e-mail. O mesmo risco que foi eliminado no bulk continua vivo no individual.

### 🟡 Feedback vivo da IA desiste após 2 minutos
O `LiveRefresh` para de atualizar após 120 s (`maxMs`). Análise que demorar
mais (fila do Inngest, retry) parece congelada em "Analisando…" até o gestor
dar refresh manual. E o estado `FAILED` segue sem botão de re-análise.

### 🟡 Reset de senha depende de configuração pendente no Supabase
O fluxo `/recuperar-senha` está no ar, mas o link do e-mail só funciona
depois de configurar a *Site URL* (`https://mt-triagem.vercel.app`) em
Authentication → URL Configuration no Supabase. Hoje o candidato/gestor que
pedir reset provavelmente recebe um link inválido. (Ação de painel, 1 min.)

### 🟢 Menores
- E-mail de "nova candidatura" ao gestor não tem link direto para a
  candidatura ("Abra o painel para ver os detalhes") — clique morto.
- Tela de confirmação pós-candidatura só oferece "Ver outras vagas" — não
  apresenta "Acompanhar em Minhas candidaturas", perdendo o momento ideal
  de ensinar que a área do candidato existe.
- Perfil do candidato não permite **ver/baixar o próprio currículo** — só
  diz "Currículo salvo no perfil" e deixa trocar às cegas.
- "Finalizado" (reprovado) na visão do candidato é ambíguo — pode ser lido
  como "processo encerrou e vão me chamar" (já sinalizado antes; decisão de
  produto pendente).

---

## 2. Linha do candidato — de "conta" para "área do candidato"

O que existe hoje é uma conta funcional (login, pré-preenchimento, lista de
candidaturas, perfil, exclusão). O que falta para virar uma **linha de
produto** é dar um lar global e vivo a essa conta:

**P0 — Área global do candidato** (`/minhas-candidaturas` e `/perfil` na
raiz, sem slug). Resolve o bug do lockout e muda o modelo mental: o
candidato tem UMA conta que atravessa empresas. As páginas por slug viram
atalhos com a marca; as globais são neutras (marca Triagem). Header público
passa a apontar para as globais.

**P1 — Acompanhamento que gera retorno:**
- Linha do tempo por candidatura (enviada → em análise → entrevista →
  resultado), com data de cada mudança — exige registrar histórico de
  status (tabela `StatusEvent`), que também serve ao gestor (auditoria).
- Detalhe da candidatura para o candidato: o que ele respondeu, qual
  currículo foi enviado (com download), status atual.
- Cancelar/retirar candidatura (recoloca controle na mão dele; hoje só
  excluindo a conta inteira).

**P2 — Retenção e recorrência:**
- "Vagas para você": na página de vagas de qualquer empresa, destacar vagas
  compatíveis com o perfil; num passo além, um feed global de vagas abertas
  de todas as empresas ativas (decisão de produto: o Triagem vira um mini
  job board? é a alavanca de rede do negócio).
- Alertas por e-mail: "a empresa X abriu uma vaga nova" para quem já se
  candidatou lá.
- Perfil mais rico: LinkedIn/GitHub no perfil global (hoje são respostas
  por empresa), resumo profissional — encurta ainda mais o wizard.

---

## 3. Linha da empresa — fricções e novas funcionalidades

### Fricções no fluxo atual
- 🟡 **A vaga não é um lugar.** O gestor pensa "minha vaga de Full Stack e
  o funil dela", mas o sistema oferece uma tabela global de candidaturas
  com filtro. Não existe página da vaga com seu funil (novas → análise →
  entrevista → decisão) — é a maior distância entre o modelo mental do
  empresário e o produto (já apontado na análise de fluxo).
- 🟡 Tabela de candidaturas sem ordenação clicável (só score fixo), sem
  paginação (client-side, degrada com centenas), e o painel não deep-linka:
  o card "Atendem o mínimo" leva a /candidaturas sem aplicar o filtro.
- 🟡 Wizard de vaga perde tudo ao sair no meio — o status DRAFT existe no
  schema, mas não há "salvar rascunho" no meio do wizard.
- 🟢 Lista de vagas sem busca; rascunho sem ação rápida "Publicar" na lista.

### Novas funcionalidades com maior retorno para o empresário
1. **Página da vaga com funil (kanban ou colunas com contagem)** — reúne
   link público, métricas da vaga e candidatos por etapa. Vira o coração do
   uso diário. (Estimativa: a maior peça, mas reaproveita tudo que existe.)
2. **Anotações e histórico na candidatura** — campo de notas do gestor +
   trilha de mudanças de status (quem, quando). Multiplica o valor da E4 e
   habilita a linha do tempo do candidato (mesma tabela `StatusEvent`).
3. **Agendamento simples de entrevista** — data/hora na mudança para
   "Entrevista", incluída no e-mail ao candidato. Sem calendário externo,
   já elimina o vaivém de e-mails.
4. **Métricas da vaga** — visitas da página pública, conversão
   visita→candidatura, tempo médio até decisão. Dá ao empresário o "está
   valendo a pena?" que hoje ele não tem. (Visitas exigem contador simples
   na page view pública.)
5. **Re-análise manual da IA** — botão em `FAILED`/`NO_RESUME` (quando o
   candidato adiciona currículo ao perfil depois) e quando o gestor edita
   os critérios da vaga ("re-analisar todos").
6. **Múltiplos gestores por empresa** — o schema já suporta (User n:1
   Company); falta UI para convidar colegas. Para empresa média, triagem é
   trabalho de equipe.
7. **Templates de e-mail personalizáveis** por empresa (tom da marca nas
   mensagens de status).

---

## 4. Priorização sugerida

| # | Item | Linha | Esforço | Impacto |
|---|------|-------|---------|---------|
| 1 | Área global do candidato (corrige lockout 404) | Candidato | M | 🔴 corrige defeito estrutural |
| 2 | Detecção precoce de "já se candidatou" + copy do P8 | Candidato | P | alto |
| 3 | Confirmação no Aprovar/Reprovar individual | Empresa | P | alto (paridade com bulk) |
| 4 | Site URL no Supabase (reset de senha) | Ambas | config 1min | alto |
| 5 | Página da vaga com funil | Empresa | G | transforma o uso diário |
| 6 | StatusEvent: histórico p/ gestor + timeline p/ candidato | Ambas | M | alto, habilita 2 features |
| 7 | Notas do gestor na candidatura | Empresa | P | alto |
| 8 | Download do próprio CV + link no e-mail do gestor + CTA pós-envio | Ambas | P | médio |
| 9 | Ordenação/paginação na tabela + deep-link dos cards do painel | Empresa | P/M | médio |
| 10 | Cancelar candidatura, re-análise manual, agendamento, métricas | Ambas | M/G | médio-alto |

P = pequeno (horas) · M = médio (1 leva) · G = grande (algumas levas).

Os itens 1–4 são a leva "conserta o que está errado"; 5–7 são a leva que
muda o patamar do produto para o empresário; o resto compõe o roadmap.

---

## 5. Estado após a leva "tarhget em primeiro lugar" (29/07/2026)

Decisão de produto: o foco deixou de ser o produto multi-tenant genérico e
passou a ser a qualidade da experiência da **tarhget e dos candidatos dela**.
A arquitetura multi-tenant continua intacta por baixo (regra 1 — `companyId`
sempre da sessão), mas as decisões de UX são tomadas para um tenant.

**Entregue nesta leva**

- Raiz do site (`/`) abre a página de carreiras da tarhget; o lockout 404 do
  item 1 deixa de existir na prática, já que a tarhget é a empresa ativa.
  A área global sem slug fica no roadmap, não na entrega.
- Detecção precoce de "já se candidatou": a página de candidatura mostra o
  aviso antes do wizard, com link para acompanhar a candidatura existente.
- Confirmação no Aprovar/Reprovar individual (E4 e comparação), com o nome
  do candidato e o aviso de que o e-mail será enviado.
- `StatusEvent`: trilha de status gravada no envio e em toda mudança feita
  pelo gestor. Alimenta o histórico da E4 e a linha do tempo do candidato.
  Eventos históricos das candidaturas existentes foram preenchidos.
- Linha do candidato: página de detalhe da candidatura com linha do tempo,
  respostas enviadas, download do currículo e retirada da candidatura.
- Notas internas do gestor na candidatura (invisíveis ao candidato).
- Re-análise manual da IA quando a análise falha.
- Download do próprio currículo no perfil; link direto para a candidatura no
  e-mail que avisa o gestor; CTA "Acompanhar minha candidatura" na
  confirmação de envio.
- Cards do painel com deep-link para a lista já filtrada (pendentes, em
  entrevista, atendem o mínimo).
- `LiveRefresh` acompanha a análise por 10 minutos em vez de 2.

**Continua em aberto**

- Página da vaga com funil (item 5) — a maior peça do roadmap do gestor.
- Agendamento de entrevista, métricas por vaga, múltiplos gestores e
  templates de e-mail.
- Ordenação e paginação na tabela de candidaturas.
- Configuração fora do código: *Site URL* no Supabase Auth (link de reset de
  senha) e verificação de domínio no Resend.
