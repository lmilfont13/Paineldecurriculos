# Plano das duas personas — o dono da tarhget e o candidato

Este documento faz três coisas: explica o que é a tela de Configurações que
ficou pendente, estuda as duas personas do produto e propõe as funcionalidades
que atendem cada uma, com ordem de execução e o que precisa mudar no banco.

---

## 0. O que é "Configurações" (a pendência que ficou)

Hoje existem duas coisas fora do lugar na área do gestor:

**Primeiro:** o dono da tarhget **não consegue editar a própria página de
carreiras**. O título ("Trabalhe com a gente"), o subtítulo, o texto sobre a
empresa, o logo e as cores da marca vivem no modelo `Company`, mas as únicas
telas que os editam estão em `/admin/empresas/[id]` — o console da plataforma,
que é da operação do Triagem, não do cliente. Na prática: a vitrine da tarhget,
a primeira coisa que qualquer candidato vê, está fora do alcance de quem é dono
dela. Isso é uma inversão de propriedade, não um detalhe de menu.

**Segundo:** o construtor de formulário (`/formulario`) ocupa um dos quatro
itens da navegação principal. É uma tela de configuração, mexida uma vez a cada
vários meses, com o mesmo peso visual de telas usadas todos os dias. Ocupa 25%
da navegação para uma fração mínima do uso.

A proposta é criar `/configuracoes` com abas e mover as duas para lá:

| Aba | O que faz | De onde vem |
|---|---|---|
| Página de carreiras | Título, subtítulo, texto sobre a empresa, logo, cores | hoje só no admin |
| Formulário | Campos que o candidato preenche | hoje na navegação principal |
| Equipe | Convidar colegas para ajudar na triagem | não existe |
| Notificações | Quais e-mails a empresa dispara | não existe |

A navegação principal fica `Painel · Vagas · Candidatos · Configurações` — três
telas de trabalho e uma de ajuste, que é a proporção real do uso.

---

## 1. Quem são os stakeholders

O produto tem três, e só dois estão no escopo desta análise:

**O dono da tarhget** (também chamado de gestor). Não é um recrutador de
empresa grande com metas de funil: é quem toca o negócio e contrata de vez em
quando. Entra no sistema duas ou três vezes por semana, por poucos minutos,
geralmente porque chegou um e-mail avisando de alguém novo. Contratar não é o
trabalho dele — é uma interrupção do trabalho dele.

**O candidato.** Se candidata a várias empresas ao mesmo tempo, quase sempre
pelo celular, e vive num estado de incerteza: mandou, e agora? A dor dele não é
o formulário — o formulário dura três minutos. A dor dele são as três semanas
seguintes de silêncio.

**O operador da plataforma** (admin). Fora do escopo por decisão do dono do
produto, e mantido neutro por regra.

---

## 2. O que cada um quer

### O dono da tarhget

| O que ele quer | Como isso aparece hoje |
|---|---|
| Contratar rápido, sem perder gente boa para a demora | ✅ triagem com IA, fila por tempo de espera |
| Gastar o mínimo de tempo na ferramenta | ✅ painel virou fila de trabalho |
| Não deixar ninguém sem resposta | ✅ tempo de espera visível |
| **Marcar a entrevista** | ❌ não existe |
| **Falar com o candidato sem sair do sistema** | ❌ não existe |
| **Controlar a própria vitrine** | ❌ só o admin edita |
| **Saber se divulgar está valendo a pena** | ❌ sem dados de origem/visita |
| **Dividir a triagem com um colega** | ❌ schema suporta, falta tela |
| Reaproveitar uma vaga parecida | ❌ refaz o wizard |

O maior buraco é o agendamento. Hoje mover para "Entrevista" dispara um e-mail
que não marca nada, não propõe horário e não pede resposta: o gestor muda o
status e continua tendo que abrir o e-mail pessoal para fazer o trabalho de
verdade. Enquanto isso o status mente — diz "Entrevista" quando ninguém
combinou nada.

### O candidato

| O que ele quer | Como isso aparece hoje |
|---|---|
| Se candidatar rápido | ✅ perfil pré-preenche o formulário |
| **Saber se ainda está no processo** | 🟡 só vendo o status, se lembrar de entrar |
| **Ser avisado quando algo acontece** | 🟡 e-mail, e só |
| **Saber o que vem agora e quando** | ❌ nenhuma expectativa é dada |
| Não ser esquecido | 🟡 depende do gestor |
| Ver o que enviou | ✅ detalhe com respostas e currículo |
| Desistir do processo | ✅ retirar candidatura |
| Ver vagas novas da empresa | ❌ precisa voltar por conta própria |

A necessidade número um do candidato é **reduzir incerteza**, e é exatamente aí
que o produto é mais fraco. Existe uma linha do tempo, mas ela é passiva: só
mostra o que já aconteceu, para quem entrar e procurar. Nada avisa, nada diz o
que esperar, nada diz quanto tempo é normal esperar.

---

## 3. Onde as duas personas se encontram

Este é o ponto que organiza o plano. As duas personas não são independentes —
elas compartilham quatro momentos, e **toda funcionalidade construída num
momento compartilhado vale por duas**:

```
        GESTOR                MOMENTO                 CANDIDATO
  recebe e triou      ←  1. candidatura chega  →   enviou, quer confirmação
  move de etapa       ←  2. mudança de etapa   →   quer saber, na hora
  precisa marcar      ←  3. a entrevista       →   precisa combinar horário
  decide              ←  4. o resultado        →   quer ser respeitado no não
```

Hoje esses quatro momentos são atendidos por um único mecanismo: e-mail
disparado de um lado, silêncio do outro. O e-mail é frágil (cai em spam, não
tem estado, não acumula) e é a única ponte entre as duas pontas do produto.

**A proposta central é transformar esses quatro momentos em eventos de
primeira classe do sistema**, que produzem ao mesmo tempo: um registro na
trilha (já existe, `StatusEvent`), uma notificação para o candidato dentro do
site (não existe) e um e-mail (já existe). Um evento, três destinos.

---

## 4. A casa do candidato

O que existe hoje é uma conta com três telas soltas: lista de candidaturas,
detalhe e perfil. O que falta é um **lugar** com estado, que o candidato tenha
motivo para revisitar.

### 4.1 Sino de notificações

Um sino no cabeçalho público, com contador de não lidas, visível em todas as
telas quando o candidato está logado. Abre uma lista curta das novidades; o
histórico completo fica em `/[slug]/notificacoes`. Cada notificação leva à
candidatura correspondente e é marcada como lida ao ser aberta.

O que gera notificação:

- candidatura recebida (confirmação imediata do envio)
- mudança de etapa ("você avançou para a entrevista")
- entrevista marcada, com data, hora e onde
- recado do gestor
- resultado final, aprovado ou encerrado
- vaga nova aberta na empresa onde ele já se candidatou

**Regra inviolável a manter aqui:** `aiScore`, `aiReasoning` e `managerNotes`
nunca atravessam para o lado do candidato. A notificação é gerada na camada de
service, que é onde o limite entre tenant e candidato já é aplicado, e o texto
dela é montado a partir do status, nunca da análise.

### 4.2 A home do candidato

A lista atual vira uma home de verdade, em três blocos:

1. **Novidades** — as notificações não lidas, no topo, com ação.
2. **Em andamento** — cada candidatura com a etapa atual e, principal, **o que
   acontece agora**: "A tarhget está avaliando as candidaturas. Você é avisado
   aqui e por e-mail assim que houver novidade." Uma frase por etapa, escrita
   uma vez, que responde a pergunta que traz o candidato de volta.
3. **Encerrados** — recolhido, sem drama, com a data.

Somada a isso, uma faixa de perfil incompleto ("adicione seu currículo e a
próxima candidatura leva um clique"), que serve às duas personas: reduz atrito
para o candidato e melhora a qualidade do dado que chega no gestor.

### 4.3 Expectativa de tempo (oportunidade)

Com a trilha de status já gravada, dá para calcular quanto a tarhget costuma
demorar entre a candidatura e a primeira resposta, e mostrar isso ao candidato
("a tarhget costuma responder em cerca de 6 dias"). É a informação que mais
reduz ansiedade, e ela também aparece para o gestor como espelho — quem vê o
próprio tempo médio tende a melhorá-lo.

---

## 5. O que muda no banco

Duas adições, nenhuma quebra do que existe.

```prisma
model Notification {
  id            String           @id @default(cuid())
  candidateId   String
  applicationId String?
  type          NotificationType
  title         String
  body          String?
  readAt        DateTime?
  createdAt     DateTime         @default(now())

  candidate   Candidate    @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  application Application? @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  @@index([candidateId, readAt])
}

enum NotificationType {
  APPLICATION_RECEIVED
  STAGE_CHANGED
  INTERVIEW_SCHEDULED
  MANAGER_MESSAGE
  RESULT
  NEW_JOB
}
```

Para a entrevista, três campos no `Application` em vez de um modelo próprio —
a tarhget faz uma rodada de conversa, não um processo de cinco etapas:

```prisma
interviewAt       DateTime?
interviewMode     String?   // "Videochamada" | "Presencial" | "Telefone"
interviewLocation String?   // link da chamada ou endereço
```

Se um dia houver mais de uma rodada, isso vira um modelo `Interview` e os
campos migram; enquanto for uma rodada, modelo separado é complexidade sem
retorno.

Para o recado do gestor, a primeira versão é **de mão única** (gestor →
candidato), reaproveitando `Notification` com `MANAGER_MESSAGE` + o e-mail. Um
canal de duas mãos traz moderação, spam e caixa de entrada para o gestor
gerenciar — não vale no primeiro passo.

---

## 6. Ordem de execução

**Leva A — a casa do candidato** *(o que você pediu)*
1. `Notification` no schema, repositório e service; geração automática nos
   pontos onde o `StatusEvent` já é gravado — um evento, três destinos.
2. Sino no cabeçalho com contador, lista de novidades e página de histórico;
   marcar como lida.
3. Home do candidato em três blocos, com o "o que acontece agora" por etapa.

**Leva B — os momentos compartilhados**
4. Agendamento de entrevista: o gestor marca data, hora e modo junto da
   mudança de etapa; vira notificação, e-mail e item da linha do tempo. Fecha o
   maior buraco funcional do gestor e a maior dúvida do candidato de uma vez.
5. Recado do gestor para o candidato, de mão única.

**Leva C — o dono no controle**
6. `/configuracoes` com Página de carreiras e Formulário.
7. Equipe: convidar colega para ajudar na triagem.

**Leva D — saber se está valendo**
8. Contador de visitas na página pública da vaga → conversão visita ↔
   candidatura, por vaga.
9. Tempo médio de resposta, mostrado ao gestor no hub da vaga e ao candidato
   como expectativa.

A leva A é o que transforma a conta do candidato em produto. A leva B é a de
maior retorno por esforço, porque cada item serve às duas personas ao mesmo
tempo. A C devolve ao dono uma propriedade que hoje é da plataforma. A D é a
que responde "valeu a pena?", e depende das outras três estarem gerando dado.
