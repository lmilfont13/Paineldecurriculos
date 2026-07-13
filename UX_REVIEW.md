# Análise crítica de UX/IHC — Triagem

Avaliação heurística (Nielsen) + conceitos de IHC, focada em **quanto o design
induz cada persona a completar suas user stories**. Baseada no uso real dos
fluxos (personas Pedro/candidato, Carlos/gestor, Admin) em 12/07/2026.
Severidade: 🔴 crítico · 🟡 relevante · 🟢 polimento.

---

## 1. Visibilidade do status do sistema (H1)

**Acertos:** steppers com progresso e rótulo "Passo X de Y"; chips de IA com
estados explícitos (Analisando…/Atende/Não atende/Não analisado); toasts nas
ações do gestor; "Copiado!" no link público.

- 🔴 **A análise da IA não se atualiza sozinha.** O gestor vê "Analisando…" e
  precisa dar refresh para ver o score. O coração do produto (triagem por IA)
  não tem feedback de conclusão — quebra o loop de feedback exatamente na
  promessa central. (Sugestão: polling/revalidação ou refresh automático
  enquanto houver `PROCESSING` na tela.)
- 🟡 **"Rascunho salvo" é estático** no header do wizard de vaga — afirma um
  autosave que não existe. Falsa visibilidade é pior que nenhuma: o gestor
  pode fechar a aba confiando nisso e perder tudo.
- 🟡 **Upload de currículo sem progresso.** Um PDF de 5 MB em conexão lenta
  fica em "Enviando…" indefinido — sem barra, o candidato não distingue
  lentidão de travamento (risco de abandono no último passo da story C4).
- 🟢 Toast no topo-direito enquanto a ação acontece no rodapé (barra em massa)
  — feedback distante da causa (proximidade de Gestalt).

## 2. Correspondência com o mundo real (H2)

**Acertos:** microcopy humano e direto ("Vamos começar por você", "Só o básico
pra gente te identificar"); status com vocabulário de RH; e-mails com tom certo
por evento.

- 🟡 **"Slug (página pública)"** no wizard do admin é jargão de dev. O admin é
  interno, mas o conceito importa para o cliente — "endereço da página" com
  preview `triagem.app/orbita-marketing` comunicaria melhor.
- 🟡 **"Score mínimo para Atende"** presume que o gestor entende o modelo
  mental da IA (0–100, corte binário). Sem exemplo ancorado ("70 = exige
  aderência alta aos critérios"), o número é abstrato — afeta a qualidade da
  configuração da G5.
- 🟡 **"Finalizado" para o candidato reprovado** (decisão minha, sinalizada):
  evita a dureza de "Reprovado", mas é ambíguo — pode ser lido como "processo
  encerrou, vão me chamar". Decisão de produto a validar.

## 3. Controle e liberdade do usuário (H3)

**Acertos:** Voltar em todos os wizards preservando dados; chips de filtro
removíveis + "Limpar filtros"; ✕ na barra de seleção; sair da conta em 1 clique
em qualquer contexto.

- 🔴 **Ações em massa irreversíveis sem confirmação nem undo.** "Reprovar" 15
  candidaturas é 1 clique — e **dispara e-mail automático a cada candidato**.
  Não há desfazer, não há diálogo de confirmação, e o efeito é externo
  (e-mails não se cancelam). É o maior risco de erro catastrófico do sistema.
  O mesmo vale para Aprovar. (Mínimo: confirmação com contagem "Reprovar 15
  candidaturas? Cada uma receberá um e-mail." Ideal: undo com janela de envio.)
- 🟡 **Candidatura não persiste rascunho.** Se o candidato fecha a aba no
  passo 3, recomeça do zero (o P8 só cobre falha de envio). Com conta, o
  rascunho poderia sobreviver — a promessa "seus dados ficam salvos" cria essa
  expectativa.
- 🟢 Exclusão de conta: confirmação em 2 cliques existe, mas para uma ação
  que apaga dados definitivamente a fricção é baixa (padrão: digitar o e-mail).

## 4. Consistência e padrões (H4)

**Acertos:** design system rigoroso (mesmos inputs, cards, pills, steppers nos
3 fluxos); separação disciplinada marca × neutro; padrão "eyebrow + título +
subtítulo" em todas as telas.

- 🟡 **Cor do CTA primário varia por área sem regra aparente para o usuário:**
  brand no fluxo público e nas ações do gestor, preto no wizard de vaga
  (stepper) e em todo o admin. O gestor transita entre painel (brand) e wizard
  de vaga (stepper preto) — a "voz" do sistema muda no meio da mesma jornada.
- 🟢 **Três formatos de data** convivem: "há 5 dias", "12 de jul.", "9 jul,
  14:32". Cada um tem razão local, mas na E3→E4 o usuário vê dois formatos
  para o mesmo dado.
- 🟢 "Candidaturas" é o nome do menu do gestor e também da página do candidato
  ("Minhas candidaturas") — ok, mas o breadcrumb do gestor e o título do
  candidato usam a mesma palavra para objetos diferentes.

## 5. Prevenção de erros (H5)

**Acertos:** validação por passo (não deixa avançar com erro); dedupe de
candidatura no banco E na UI; e-mail travado ao da conta; PDF/5MB validado nos
dois lados; slug com regex e verificação de unicidade; senha mínima de 8.

- 🔴 **Mudar o slug de empresa com vagas no ar quebra todos os links
  divulgados** (QR codes, posts de LinkedIn) — o campo aceita a mudança sem
  nenhum aviso de consequência. Para um produto white-label, é perda direta de
  candidatos do cliente.
- 🟡 Score mínimo aceita extremos sem alerta (100 = ninguém "Atende"; 0 = todos)
  — um erro de configuração silencioso que corrói a confiança na IA (G5).
- 🟡 Reprovar em massa (ver H3) também é um problema de prevenção: nenhuma
  fricção proporcional ao dano.

## 6. Reconhecimento em vez de memorização (H6)

**Acertos:** **o pré-preenchimento do candidato (CA3) é o melhor exemplo do
produto** — o sistema lembra para que o usuário não precise; filtros ativos
visíveis como chips; breadcrumbs; badge numérico de pendências na sidebar.

- 🟡 **Os critérios de IA da vaga não aparecem na E4** (detalhe da
  candidatura). Para julgar "92 · Atende", o gestor precisa lembrar o que
  configurou na vaga. O reasoning ajuda, mas mostrar os critérios ao lado do
  score fecharia o ciclo de avaliação sem memória.
- 🟡 **A senha temporária do gestor só existe no momento da criação.** Se o
  admin não copiou, não há como reexibir (a A7 permite redefinir, o que
  mitiga) — mas nada na tela final induz "copie e envie agora" (ver também
  jornada do admin, abaixo).

## 7. Flexibilidade e eficiência de uso (H7)

**Acertos:** ações em massa + CSV + comparação lado a lado atendem o usuário
avançado; filtros combináveis; slug automático editável; "Candidatos" direto
por vaga.

- 🟡 Sem ordenação clicável nas colunas da tabela (só a ordenação fixa por
  score); sem atalhos de teclado; Enter não avança os wizards.
- 🟢 Busca/filtragem de candidaturas é client-side — perfeito até algumas
  centenas de registros; sinalizo o limite arquitetural para volume alto.

## 8. Estética e design minimalista (H8)

**Acertos:** base neutra com acento de marca é elegante e reforça o
white-label; densidade de informação bem calibrada nas tabelas; nenhuma tela
com ruído visual.

- 🟡 **Painel vazio (primeiro uso) não induz nada** — 4 zeros com peso igual e
  nenhum CTA. É exatamente o momento em que o design deveria empurrar a
  primeira story do gestor (G4: criar vaga / copiar link). Hierarquia visual
  plana = paralisia.
- 🟡 **Stat cards parecem clicáveis mas não são** (falsa affordance) — cards
  com borda e hover implícito criam gulf of execution: o usuário tenta "abrir"
  Candidaturas novas e nada acontece.
- 🟢 Passo "Extras" vazio quando a empresa não tem perguntas: um passo inteiro
  para dizer "pode continuar" (custo de interação sem valor; pular
  automaticamente mudaria o stepper de 4 passos do design — decisão de design).

## 9. Reconhecimento e recuperação de erros (H9)

**Acertos:** banner P8 com caminho de recuperação explícito ("dados salvos —
tente de novo") e botão que muda para "Tentar enviar de novo"; mensagens de
validação específicas por campo; "link expirado" no reset com atalho para pedir
outro.

- 🔴 **Os dois mundos de login não se socorrem.** Candidato que cai no `/login`
  (staff) recebe "Este usuário não tem acesso à plataforma" — verdadeiro e
  inútil; não diz "candidatos entram pela página de vagas da empresa".
  Gestor que cai no `/login` neutro lê "Acesso admin · Restrito à equipe da
  plataforma" e conclui que errou de porta. **É a maior falha de wayfinding do
  sistema**, e afeta a primeira sessão das duas personas pagantes.
- 🟡 `aiState: FAILED` mostra "será tentada novamente" mas, esgotados os
  retries do Inngest, não há botão de re-análise manual — beco sem saída.

## 10. Ajuda e documentação (H10)

**Acertos:** microcopy pedagógico nos pontos sensíveis ("Nada disso aparece
para o candidato", "Apoio à decisão. A decisão final é sua." — excelente para
a confiança e o compliance da G8).

- 🟡 Zero onboarding para conceitos-proprietários: "aderência", "critérios da
  IA", "campos core vs. extras", "Mostrar no passo Perfil" — o gestor de
  primeira viagem deduz por tentativa. Um tooltip por conceito resolveria.

---

## Indução às user stories, por jornada

**Candidato (C1→C7 + CA):** o funil é forte — hero com promessa clara, CTA
único e destacado na P2 ("Candidatar-se agora" em brand, card com sombra),
gate de conta que **vende o benefício antes de pedir o custo** ("nas próximas
vagas, tudo já vem preenchido"), wizard curto com progresso visível e
confirmação com prova (e-mail exibido). A conta obrigatória é a maior fricção
nova do funil — **recomendo instrumentar a taxa de abandono no gate** para
validar a mudança de posicionamento.

**Gestor (G1→G14):** o painel prioriza pela IA ("Precisam da sua atenção")
— induz diretamente a G8 (decidir), que é a story de maior valor. O fluxo
vaga→candidatos→detalhe→decisão tem no máximo 2 cliques entre etapas. Falhas
de indução: painel vazio não induz G4 (primeira vaga), e a ausência de
atualização ao vivo da IA enfraquece o hábito de "voltar para ver o score".

**Admin (A1→A7):** o wizard de 5 passos é linear e sem becos. A falha está no
**pós-criação**: a tela volta à lista sem instruir o handoff — o momento ideal
para "Envie ao gestor: link `/login?empresa=X` + senha temporária" se perde, e
a senha nunca mais é visível. A story A3 termina tecnicamente completa, mas o
objetivo real (gestor ativado) fica por conta da memória do admin.

## Top 5 por prioridade

1. 🔴 Confirmação/undo nas ações em massa (dispara e-mails irreversíveis).
2. 🔴 Wayfinding entre os logins (staff × candidato) com mensagens que
   redirecionam, e copy neutro no `/login` sem `?empresa`.
3. 🔴 Feedback vivo da análise de IA para o gestor (auto-refresh de
   `PROCESSING`).
4. 🟡 Empty state do painel com CTA (criar vaga / copiar link) + affordance
   honesta nos stat cards.
5. 🟡 Aviso de consequência ao mudar slug + critérios da IA visíveis na E4.
