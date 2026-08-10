# Revisão crítica de UX — o painel do dono da tarhget

Escopo: toda a experiência autenticada do gestor (`/painel`, `/vagas`,
`/candidaturas`, `/candidaturas/[id]`, `/formulario`, shell e navegação).
Admin fora do escopo. Referências: heurísticas de Nielsen, Gestalt, custo de
interação e *information scent* (Nielsen Norman Group), além do consenso atual
de produto em ATS — o padrão de mercado é oferecer **kanban para triar e lista
para varrer/agir em massa**, porque o board perde legibilidade em volume e a
lista perde a noção de progresso ([JobAffinity](https://www.jobaffinity.com/en/blog/vue-kanban-ats/),
[Treegarden](https://treegarden.io/blog/kanban-recruitment-pipeline/)) e de que
o painel do gestor deve mostrar **o que precisa de atenção**, não um resumo de
volume ([SmartRecruiters](https://www.smartrecruiters.com/resources/article/how-applicant-tracking-system-usability-improves-hiring-outcomes/)).

---

## Diagnóstico central

**O produto está organizado em torno do banco de dados, não do trabalho.**

A navegação é `Painel · Vagas · Candidaturas · Formulário` — quatro listas de
entidades. Mas o trabalho do dono da tarhget não é "administrar candidaturas";
é **fechar uma vaga com a pessoa certa, rápido**. E a vaga, que é a unidade
real do trabalho, não é um lugar no sistema: clicar nela leva para
`/candidaturas?vaga=X`, uma tabela global pré-filtrada. Não existe nenhuma tela
que responda "como está indo a vaga de Full Stack?".

Tudo que pertence a um processo de contratação — link público, funil, critérios
da IA, candidatos por etapa, tempo de resposta — está espalhado por três telas
diferentes, e nenhuma delas é sobre a vaga. Esse é o defeito estrutural do
qual quase todos os outros derivam.

---

## 1. Arquitetura da informação

### 1.1 A vaga não tem casa 🔴

`/vagas` é uma lista onde cada linha tem quatro alvos de clique (título,
"Editar", "Candidatos", e a linha inteira) que levam a **dois** destinos.
Redundância sem hierarquia: o usuário precisa decidir qual link usa para uma
diferença que não existe. Pior, o destino principal é uma tabela de outra
seção — a vaga "empresta" a tela das candidaturas em vez de ter a sua.

**Proposta:** `/vagas/[id]` vira o centro operacional do produto. Cabeçalho com
título, status, link público e critérios; funil com contagem por etapa;
candidatos dentro de cada etapa; sinais vitais da vaga (há quanto tempo o
candidato mais antigo espera, quantos foram respondidos). A lista global de
candidaturas continua existindo, mas como ferramenta de varredura e ação em
massa — não como destino padrão.

### 1.2 "Formulário" ocupa lugar de trabalho diário 🟡

É configuração tocada uma vez a cada vários meses, no mesmo nível hierárquico
de telas usadas todo dia. Ocupa 25% da navegação primária para ~1% do uso.
Deve descer para um agrupamento de configurações — junto com o que hoje o
gestor **não pode fazer e deveria**: editar a própria página de carreiras
(hero, cores, logo hoje só existem no console admin).

### 1.3 Falta o eixo do tempo 🟡

Nenhuma tela responde "o que mudou desde a última vez que entrei?". Para um
dono que abre o sistema duas ou três vezes por semana, essa é a pergunta mais
valiosa que existe, e o produto inteiro é atemporal — mostra estados, nunca
mudanças. A trilha de `StatusEvent` recém-criada já tem o dado necessário.

---

## 2. O painel

### 2.1 As métricas medem o sistema, não o negócio 🔴

Os quatro cartões são *vanity metrics*: vagas abertas, candidaturas em 7 dias,
quantos atendem o mínimo, quantos estão em entrevista. Todos respondem
"quanto?", nenhum responde **"o que eu faço agora?"** — que é a única pergunta
que um painel operacional precisa responder.

O que falta é justamente o que dói: **quanta gente está esperando resposta e há
quanto tempo**. Não existe nenhuma noção de candidato parado. Um candidato
pode ficar 30 dias em "Em análise" sem que nada na interface fique diferente
de um candidato que chegou hoje. Isso é o oposto de visibilidade do estado do
sistema (H1) e é, na prática, o maior risco reputacional da tarhget: candidato
esquecido é candidato que fala mal.

**Proposta:** trocar os quatro contadores por uma fila de trabalho.
Um número grande que importa ("7 candidatos esperando sua resposta"), o mais
antigo em destaque com o tempo de espera, e uma linha por vaga aberta com a
distribuição do funil. Cada elemento leva a uma ação.

### 2.2 "Precisam da sua atenção" não é priorizado por atenção 🟡

O bloco promete priorização pela IA, mas o critério é: pega os `PENDING`,
ordena por score e corta os quatro primeiros. Um candidato sem currículo
(`aiScore = null`) some do topo; um candidato de 92 pontos que chegou hoje
aparece antes de um de 71 que espera há duas semanas. A promessa da label não
bate com a regra, e a regra não é explicada em lugar nenhum.

**Proposta:** ou a prioridade combina aderência **e** tempo de espera e diz o
motivo em cada linha ("92 pontos · esperando há 9 dias"), ou o título muda para
o que a lista realmente é. Promessa e conteúdo precisam bater.

---

## 3. A tela da candidatura (E4)

### 3.1 O score grande é uma âncora perigosa 🔴

O elemento mais saliente da tela é `79/100` em fonte 5xl, com um selo
"Atende"/"Não atende" ao lado. O texto que realmente informa — as duas frases
de raciocínio — está abaixo, em 12px. E o aviso "Apoio à decisão. A decisão
final é sua." está no rodapé do bloco, na posição de menor peso visual.

A hierarquia está exatamente invertida em relação à intenção. Um número em
destaque máximo funciona como âncora: a decisão passa a ser tomada em torno
dele, e o raciocínio vira justificativa a posteriori. Somado a "Não atende" em
vermelho ao lado do nome de uma pessoa, o sistema entrega um veredito que ele
mesmo diz não estar dando.

Isso também tensiona a regra 2 do produto no espírito, ainda que não na letra:
a IA não muda o status, mas a interface faz o número decidir.

**Proposta:** raciocínio primeiro, em corpo de texto legível; score como chip
de apoio ao lado, não como manchete; critérios avaliados visíveis junto; a
ressalva sobe para o topo do bloco. E trocar "Não atende" por uma formulação
sobre o critério, não sobre a pessoa ("abaixo do mínimo definido: 70").

### 3.2 Duas interfaces para a mesma decisão 🔴

A tela tem um controle segmentado de status no meio **e** botões
Aprovar/Reprovar no rodapé. Fazem a mesma coisa, com pesos visuais diferentes,
em lugares diferentes. Um deles confirma antes de reprovar, o outro também —
mas o usuário não tem como saber que são o mesmo controle. Isso viola
consistência (H4) e gera a dúvida "se eu clicar nos dois, acontece duas vezes?".

**Proposta:** um único bloco de decisão. Avanço no funil como ação primária,
reprovar como ação destrutiva separada e visualmente distinta.

### 3.3 O controle segmentado sugere um modelo mental errado 🟡

Quatro botões lado a lado, com aparência de abas, comunicam "escolha livre
entre quatro opções equivalentes". Mas isso é um funil direcional: voltar de
"Aprovado" para "Em análise" é uma correção de erro, não uma escolha comum. A
forma não comunica a direção.

Além disso o `role="radiogroup"` não implementa navegação por setas, então a
semântica anunciada ao leitor de tela não corresponde ao comportamento.

### 3.4 Colisão de vocabulário 🔴

"Em análise" é o status do processo. "Analisando o currículo…" é o estado da
IA. Duas coisas diferentes, a mesma palavra, na mesma tela, às vezes ao mesmo
tempo. O gestor não tem como saber se "em análise" significa "a IA está
processando" ou "eu ainda não decidi". Falha direta de consistência (H4).

**Proposta:** o status do processo passa a ser **"Novo"** ou **"Triagem"**; a
palavra "análise" fica reservada para a IA. E "Candidaturas" (o objeto) e
"Candidatos" (a pessoa) precisam parar de se alternar entre a navegação, a
lista de vagas e os títulos.

### 3.5 A mudança de status é um beco sem saída 🟡

Mover para "Entrevista" dispara um e-mail que não marca nada, não propõe
horário, não pede resposta. O passo de maior atrito de um processo real —
combinar a conversa — simplesmente não existe no produto. O gestor muda o
status e continua tendo que abrir o e-mail pessoal para fazer o trabalho de
verdade. Enquanto isso, o status "Entrevista" mente: ninguém agendou nada.

---

## 4. A lista de candidaturas

### 4.1 Sofisticada no lugar errado 🟡

Busca, filtro por vaga, filtro por status, corte por score, seleção em massa,
exportação CSV e comparação — tudo sobre uma tabela que, na tarhget, mostra
majoritariamente candidatos de uma vaga só. É maquinário de escala montado
antes da escala, enquanto a tela que falta (o funil da vaga) não existe.

### 4.2 Problemas concretos da tabela 🟡

- Sem ordenação clicável: a ordem é fixa (score desc, depois data). O gestor
  não consegue perguntar "quem chegou primeiro?".
- Sem paginação: tudo em memória no cliente; degrada em algumas centenas.
- Larguras fixas (`w-28`, `w-20`) em linhas flex: nome longo empurra o layout.
- Filtros ativos viram chips, mas os controles não indicam quantos resultados
  cada opção traria — sem *information scent*, o usuário filtra às cegas.

---

## 5. O shell

### 5.1 Dados falsos no cromo do produto 🔴

A sidebar exibe **"Plano Pro"** e **"Gestor(a) de RH"** — ambos fixos no
código, nenhum dos dois verdadeiro. Texto inventado na moldura do produto é a
pior categoria de dívida de confiança: se o rótulo ao lado do nome da empresa é
decorativo, o usuário passa a duvidar dos números também.

### 5.2 Ícones que não são ícones 🟡

Os itens de navegação usam quadrados coloridos como ícone. Não comunicam nada,
não ajudam no reconhecimento (H6) e ainda ocupam o espaço onde um ícone real
reduziria o custo de varredura.

### 5.3 A barra superior repete o que já está à esquerda 🟢

`tarhget / Candidaturas` ao lado de uma sidebar que já mostra "tarhget" e já
destaca "Candidaturas". Uma faixa de 56px de altura que não acrescenta
informação — em uma navegação de um nível, breadcrumb é ornamento.

---

## 6. O que o dono da tarhget não consegue fazer hoje

Funções ausentes que a persona precisa, em ordem de dor:

1. **Agendar a entrevista** (data/hora junto da mudança de status, no e-mail).
2. **Editar a própria página de carreiras** — hero, cores e logo são só do
   admin. É a vitrine da empresa dele.
3. **Ver o tempo de resposta** — nem por vaga, nem no geral.
4. **Saber de onde vêm os candidatos** — sem contagem de visitas na página
   pública, não dá para saber se divulgar no LinkedIn valeu a pena.
5. **Chamar alguém para ajudar na triagem** — o schema suporta vários usuários
   por empresa, não existe tela para convidar.
6. **Reabrir/duplicar uma vaga** parecida sem refazer o wizard inteiro.

---

## 7. Plano de repaginação

Em três levas, da mais estrutural para o acabamento.

**Leva 1 — a vaga vira o produto**
- `/vagas/[id]`: hub com funil por etapa, candidatos dentro das etapas, link
  público, critérios e sinais vitais (espera mais antiga, tempo de resposta).
- `/vagas` passa a ser lista de processos com progresso, não de registros.
- Painel vira fila de trabalho: quem espera, há quanto tempo, o que fazer.
- Navegação: `Painel · Vagas · Candidatos · Configurações` (Formulário e marca
  descem para Configurações).

**Leva 2 — a decisão**
- Bloco único de decisão na tela do candidato, com avanço e reprovação
  separados por peso.
- IA reescrita: raciocínio primeiro, score como apoio, ressalva no topo.
- Vocabulário unificado ("Novo/Triagem" para status, "análise" só para IA).
- Agendamento de entrevista junto da mudança de status, com o horário no
  e-mail.

**Leva 3 — verdade e acabamento**
- Remover "Plano Pro" e o cargo fixo; ícones reais na navegação; topbar
  enxuta.
- Ordenação e paginação na lista; larguras fluidas.
- Métricas por vaga (visitas → candidaturas → decisão) e convite de colegas.

---

## 8. Correções aplicadas de imediato

Itens que não dependem de decisão de produto e já entraram nesta leva:

- Remoção de "Plano Pro" e do cargo fixo "Gestor(a) de RH" da sidebar.
- Ícones reais na navegação, no lugar dos quadrados de cor.
- Bloco de IA reordenado: ressalva no topo, raciocínio como texto principal,
  score como apoio, e o selo passa a falar do critério, não da pessoa.
- Fim da duplicação de controles de decisão na tela do candidato.
- Vocabulário: "Em análise" vira "Triagem" no status do processo; "análise"
  fica reservada para a IA.
- Espera visível: cada candidatura mostra há quantos dias aguarda resposta.
