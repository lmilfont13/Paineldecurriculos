# Sistema de vagas da Tarhget: tudo o que você precisa saber

Este documento é para quem vai cuidar do sistema daqui para a frente: usar no
dia a dia, mexer no código com o Claude e colocar mudanças no ar. Foi escrito
em setembro de 2026, quando o Luckas passou o projeto adiante.

Se você está usando o Claude, peça logo no começo: **"Leia o CLAUDE.md, o
CONTEXT.md e o contexto.md antes de qualquer coisa."** O CONTEXT.md tem as
regras técnicas; este aqui tem o resto.

---

## 1. O que é o sistema

Um site de vagas da Tarhget com painel de recrutamento.

- **O candidato** entra na página de vagas, cria uma conta uma vez, se
  candidata pelo celular em uns 3 minutos e acompanha o andamento numa área só
  dele, com avisos a cada novidade.
- **A Tarhget** publica vagas, recebe as candidaturas num painel, vê uma
  leitura do currículo feita por IA, marca entrevista, manda recado e decide
  quem segue.
- **A IA só ajuda.** Ela lê o currículo e dá uma nota de 0 a 100 com duas
  frases de justificativa, sem olhar nome, gênero, idade, foto ou origem.
  Ela nunca aprova nem reprova ninguém: quem decide é sempre uma pessoa.

**Endereços:**

| O quê | Endereço |
|---|---|
| Página de vagas (candidatos) | https://mt-triagem.vercel.app/tarhget/vagas |
| Painel da Tarhget | https://mt-triagem.vercel.app/login |
| Console da plataforma (admin) | https://mt-triagem.vercel.app/login?empresa=plataforma |

O endereço raiz (https://mt-triagem.vercel.app) já abre a página de vagas.

---

## 2. Usando no dia a dia (sem mexer em código)

1. **Publicar uma vaga:** no painel, *Vagas → + Nova vaga*. São 4 passos. No
   passo da IA você escreve o que ela deve avaliar (por exemplo, "experiência
   com merchandising") e a nota mínima. Salve como rascunho ou publique.
2. **Divulgar:** cada vaga tem um link próprio na tela dela (*Vagas → abrir a
   vaga → Link desta vaga*). Mande no WhatsApp e poste no Instagram.
3. **Triagem:** o *Painel* mostra quantas pessoas estão esperando resposta e
   há quanto tempo. *Candidatos → aba Triagem* lista essas pessoas, começando
   por quem espera há mais tempo.
4. **Chamar para entrevista:** na tela do candidato, *Chamar para entrevista*
   abre a marcação de data, hora e local. O candidato recebe o convite e vê a
   data na área dele.
5. **Recado:** na mesma tela, *Enviar recado* manda uma mensagem ao candidato.
   Se ele responder o e-mail, a resposta chega no e-mail do gestor.
6. **Decidir:** *Aprovar* ou *Reprovar*. O candidato é avisado. Para ele,
   "reprovado" aparece como "processo finalizado".
7. **Configurações:** textos da página de vagas, logo, cor e as perguntas do
   formulário de candidatura.

**Hoje existe uma vaga em rascunho, "Promotor(a) de Merchandising".** O texto
foi escrito como ponto de partida. Revise principalmente o tipo de contrato
(está como CLT) e os requisitos antes de publicar.

---

## 3. Onde cada peça mora

O sistema é montado com serviços prontos. **Hoje todas as contas estão no nome
do Luckas.**

| Serviço | Para que serve | Onde administrar |
|---|---|---|
| **GitHub** | Guarda o código. Repositório privado `milfontz/mt_triagem`. | github.com |
| **Vercel** | Hospeda o site. Projeto `mt-triagem`, publica sozinho a cada push. Região: São Paulo (`gru1`). | vercel.com |
| **Supabase** | Banco de dados, logins (gestor e candidatos) e arquivos: currículos no bucket privado `resumes` e logos no público `logos`. Projeto `hfdtitpcgauupvuifkut`, região São Paulo. | supabase.com |
| **Google AI Studio (Gemini)** | A IA que lê os currículos. Modelo `gemini-flash-lite-latest`. | aistudio.google.com |
| **Inngest** | Roda a leitura da IA em segundo plano, para o candidato nunca ficar esperando. App `triagem`, endereço `https://mt-triagem.vercel.app/api/inngest`. | inngest.com |
| **Resend** | Envia os e-mails (confirmação, entrevista, recados, resultado). | resend.com |

---

## 4. Passando as contas para a Tarhget

Existem dois caminhos.

**Caminho simples (dá para fazer hoje):** o Luckas continua dono e convida
você em cada serviço.

- **GitHub:** repositório → *Settings → Collaborators → Add people* → seu
  usuário do GitHub. Você recebe um convite por e-mail.
- **Vercel:** *Team Settings → Members → Invite*.
- **Supabase:** *Organization → Team → Invite*.
- **Resend, Inngest, Google AI Studio:** cada um tem *Team* ou *Members* nas
  configurações.

**Caminho definitivo (recomendado para uma empresa):** criar as contas com um
e-mail da Tarhget e transferir.

- **GitHub:** crie uma organização (por exemplo, `tarhget`) e, no
  repositório, faça *Settings → Danger Zone → Transfer* para ela.
- **Vercel:** depois de transferir o repositório, reconecte o projeto ao novo
  endereço em *Project → Settings → Git*. As variáveis de ambiente continuam
  no projeto.
- **Chaves de API:** quando a conta muda de dono, gere chaves novas no nome da
  Tarhget e atualize a Vercel (seção 5).

### Troque o login de gestor para o seu e-mail

Hoje o acesso de gestor da Tarhget usa o e-mail pessoal do Luckas, e **é para
esse e-mail que vão os avisos de candidatura nova**. O sistema reconhece o
gestor pelo e-mail, então a troca precisa ser feita em dois lugares ao mesmo
tempo:

1. No Supabase: *Authentication → Users* → editar o e-mail do usuário.
2. No banco: tabela `User`, mesmo e-mail novo.

Peça ao Claude: *"Troque o e-mail do gestor da Tarhget para [seu e-mail] no
Supabase Auth e na tabela User, e me ajude a definir uma senha forte."* A senha
atual é provisória e fraca, então troque logo.

---

## 5. As chaves (variáveis de ambiente)

**Os valores das chaves não estão neste arquivo, de propósito.** Eles ficam em
dois lugares:

- no arquivo `.env`, no computador de quem desenvolve (peça ao Luckas por um
  canal privado, nunca pelo GitHub);
- na Vercel: *Project → Settings → Environment Variables*.

Qualquer chave que vazar pode ser trocada: gere uma nova no painel do serviço e
atualize os dois lugares.

| Variável | O que é | Onde pegar |
|---|---|---|
| `DATABASE_URL` | Conexão com o banco | Supabase → *Connect* → *Session pooler* |
| `DIRECT_URL` | Conexão usada nas migrations | Mesma do pooler (veja a seção 9) |
| `NEXT_PUBLIC_SUPABASE_URL` | Endereço do projeto Supabase | Supabase → *Project Settings → API* |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública do Supabase | Supabase → *Project Settings → API* |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de administrador do Supabase. **Secreta.** | Supabase → *Project Settings → API* |
| `GEMINI_API_KEY` | Chave da IA | aistudio.google.com → *Get API key* |
| `INNGEST_EVENT_KEY` | Envio de tarefas para o Inngest | Inngest → *Manage → Event Keys* |
| `INNGEST_SIGNING_KEY` | Assinatura das tarefas do Inngest | Inngest → *Manage → Signing Key* |
| `RESEND_API_KEY` | Envio de e-mails | Resend → *API Keys* |
| `EMAIL_FROM_ADDRESS` | Remetente dos e-mails (opcional até verificar o domínio) | Um endereço do domínio verificado no Resend |
| `NEXT_PUBLIC_APP_URL` | Endereço do site | `https://mt-triagem.vercel.app` em produção, `http://localhost:3000` no computador |

O `.env` antigo pode ter uma `PRISMA_DATABASE_URL`. Ela não é usada; pode
ignorar.

Mudou uma chave na Vercel? As que começam com `NEXT_PUBLIC_` só valem depois
de uma nova publicação (*Deployments → ⋯ → Redeploy*).

---

## 6. Rodando no seu computador com o Claude

**Instale antes:**

- **Node.js 24** (nodejs.org). É a versão que a Vercel usa.
- **Git** (git-scm.com).
- **Claude Code**, no app do Claude para desktop (aba *Code*).

**Passo a passo:**

1. Aceite o convite do GitHub (seção 4).
2. Baixe o código numa pasta **fora do OneDrive**, porque o OneDrive trava os
   arquivos que o sistema gera (seção 9):
   ```bash
   git clone https://github.com/milfontz/mt_triagem.git
   ```
3. Coloque o arquivo `.env` (recebido do Luckas) dentro da pasta
   `mt_triagem`, na raiz.
4. Instale as dependências:
   ```bash
   npm install
   ```
5. Rode o site no seu computador:
   ```bash
   npm run dev
   ```
   e abra http://localhost:3000.
6. No Claude, abra a pasta do projeto e comece com: *"Leia o CLAUDE.md, o
   CONTEXT.md e o contexto.md."*

> ⚠️ **O banco de dados do seu computador é o mesmo do site no ar.** Criar,
> editar ou apagar vaga ou candidato rodando localmente muda a produção na
> hora. Para testar à vontade, peça ao Claude um projeto Supabase separado
> para testes.

---

## 7. Como uma mudança vai para o ar

1. Peça a mudança ao Claude.
2. Confira no seu computador (`npm run dev`) e rode as verificações:
   ```bash
   npm test
   ```
   ```bash
   npm run build
   ```
3. Grave e envie para o GitHub (o Claude faz isso se você pedir):
   ```bash
   git push origin master
   ```
4. **A Vercel publica sozinha** em cerca de 2 minutos. Para acompanhar:
   vercel.com → projeto `mt-triagem` → *Deployments*. Se aparecer *Error*,
   abra o log e mostre para o Claude.

**Mudança na estrutura do banco** (tabela ou campo novo): peça ao Claude para
seguir o padrão de migrations do projeto. O `prisma migrate dev` não funciona
nesse ambiente. O jeito usado aqui é gerar o SQL com `prisma migrate diff` e
aplicar com `prisma migrate deploy`. Os exemplos ficam em `prisma/migrations/`.

---

## 8. Regras que não podem ser quebradas

Estão detalhadas no `CONTEXT.md`. Em resumo:

1. Cada empresa só vê os próprios dados.
2. A IA nunca bloqueia o candidato e nunca muda o status de ninguém.
3. O texto que instrui a IA não muda (é o que garante que ela ignore nome,
   gênero, idade, foto e origem).
4. As cores e o logo da empresa aparecem no site público, no login e nos
   destaques do painel; o console da plataforma fica neutro.
5. Currículo só em PDF, até 5 MB.
6. O código é organizado em camadas, e nenhuma pula a de baixo. O Claude
   conhece a estrutura pelo CONTEXT.md.

Além delas: **nota, justificativa da IA e notas internas nunca aparecem para o
candidato.** Existem testes automáticos que conferem isso nos avisos.

---

## 9. Problemas conhecidos e a solução

| Sintoma | Causa | Solução |
|---|---|---|
| `EPERM: operation not permitted` ao rodar `npm run build` | O OneDrive trava a pasta `.next` | Pare o `npm run dev`, apague a pasta `.next` e rode de novo. Melhor ainda: deixe o projeto fora do OneDrive. |
| `Can't reach database server at db.hfdtitpcgauupvuifkut...` | O endereço direto do Supabase só funciona em redes com IPv6 | Use o endereço do *Session pooler* (`aws-1-sa-east-1.pooler.supabase.com`) no `DATABASE_URL` e no `DIRECT_URL`. |
| Erro de tipo no build da Vercel falando de campo que existe | Cliente do Prisma desatualizado | Já resolvido: o build roda `prisma generate`. Se voltar, confira o script `build` no `package.json`. |
| Pedido para atualizar o Prisma para a versão 7 | A versão 7 é incompatível com este projeto | Mantenha na 6. |
| IA com erro de cota | Os modelos Gemini 2.x estão bloqueados para a chave atual | Use `gemini-flash-lite-latest` (já configurado em `src/lib/gemini.ts`). |
| A IA não roda, o candidato fica em "Analisando…" | Inngest sem chave ou app não sincronizado | Confira as duas chaves do Inngest na Vercel e, no Inngest, sincronize o app com `https://mt-triagem.vercel.app/api/inngest`. |
| Código do Next.js que o Claude sugere não funciona | Este projeto usa o Next.js 16, diferente do que muita documentação mostra | Peça ao Claude para ler a documentação em `node_modules/next/dist/docs/` (o AGENTS.md já pede isso). |

---

## 10. Custos e limites

Tudo roda hoje em planos gratuitos. Para uma empresa, três pontos merecem
atenção (confira os termos atuais em cada site):

- **Vercel:** o plano gratuito (Hobby) é para uso pessoal e não comercial. Um
  site de vagas de empresa é uso comercial; o adequado é o plano Pro.
- **Supabase:** o plano gratuito pode pausar o projeto depois de uma semana sem
  uso. Se isso acontecer, o site para até alguém reativar o projeto no painel
  do Supabase.
- **Resend:** o plano gratuito tem limite diário e mensal de e-mails. Para o
  volume de uma vaga de promotor costuma bastar.

O Gemini e o Inngest também têm cotas gratuitas, suficientes para o volume
atual.

---

## 11. O que falta fazer

Por ordem de importância:

1. **E-mails para candidatos.** Enquanto não houver domínio verificado no
   Resend, os e-mails saem de `onboarding@resend.dev`, que **só entrega para o
   dono da conta Resend**. Ou seja: hoje os candidatos não recebem e-mail
   nenhum. Os avisos dentro do site funcionam normalmente. Para resolver:
   Resend → *Domains → Add domain* → adicionar os registros DNS no provedor do
   domínio da Tarhget → depois colocar `EMAIL_FROM_ADDRESS` (por exemplo,
   `vagas@seudominio.com.br`) na Vercel e publicar de novo.
2. **"Esqueci minha senha".** No Supabase: *Authentication → URL
   Configuration* → *Site URL* = `https://mt-triagem.vercel.app` e, em
   *Redirect URLs*, adicionar `https://mt-triagem.vercel.app/redefinir-senha`.
   Sem isso, o link de recuperação não funciona.
3. **Login do gestor no seu e-mail**, com senha forte (seção 4).
4. **Revisar e publicar a vaga de promotor** (seção 2).
5. **Revisar as telas do painel com calma.** Elas foram reformuladas e testadas
   automaticamente, mas ainda não passaram por uma revisão visual de quem vai
   usar.
6. **Domínio próprio** (opcional), por exemplo `vagas.tarhget.com.br`: Vercel
   → *Project → Settings → Domains*. Depois, atualize `NEXT_PUBLIC_APP_URL` na
   Vercel, a *Site URL* do Supabase e o endereço do app no Inngest.

**Ideias para depois:** números por vaga (quantas pessoas viram a vaga e
quantas se candidataram), convidar colegas para ajudar na triagem e textos de
e-mail personalizados.

---

## 12. O que já foi feito (histórico)

- **Base do sistema:** página de vagas, candidatura em 4 passos, painel da
  empresa, console da plataforma, leitura de currículo pela IA em segundo
  plano, e-mails e proteção dos dados por empresa no banco.
- **Conta do candidato:** o candidato cria a conta uma vez e os dados vêm
  preenchidos nas próximas vagas. Ele pode retirar uma candidatura ou excluir
  a conta.
- **Publicação:** site no ar na Vercel, com servidor em São Paulo para ficar
  rápido, e IA trocada para o Gemini.
- **Foco na Tarhget:** as outras empresas de teste foram removidas.
- **Histórico e notas:** cada mudança de etapa fica registrada; o gestor tem
  notas internas; a IA pode ser chamada de novo quando falha.
- **Reforma do painel:** candidatos organizados por etapa (triagem,
  entrevista, aprovados, reprovados), tela própria para cada vaga com o funil,
  e painel inicial mostrando quem espera resposta e há quanto tempo.
- **Área do candidato:** avisos dentro do site, com um sino no topo, e em cada
  candidatura a informação do que acontece agora.
- **Entrevista e recado:** marcar data, hora e local da conversa; mandar
  mensagem ao candidato.
- **Marca da Tarhget:** bordô do logo (`#811201`), logo recortado do original,
  página de vagas e login com a identidade da empresa, painel usável no
  celular, e-mails com nome e cor da Tarhget, e tela de Configurações para a
  própria empresa editar a página de vagas.

Relatórios com o raciocínio por trás das decisões, na raiz do projeto:
`RELATORIO_MELHORIAS.md`, `RELATORIO_UX_GESTOR.md` e `PLANO_PERSONAS.md`.
