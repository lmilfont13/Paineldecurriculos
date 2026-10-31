# Pré-entrevista: coleta de dados do candidato aprovado

## Por quê
Depois que currículo e perfil de um candidato são aprovados, o gestor precisa
confirmar dados antes de marcar a entrevista (estado civil, filhos, resumo
profissional quando o currículo não traz, RG, CPF). Hoje isso é feito por fora,
na mão. A ideia é o gestor escolher o que pedir, o candidato responder num
formulário curto, e o sistema avisar sozinho.

## Objetivos
- Gestor escolhe, por candidato, quais informações pedir.
- O sistema só oferece pedir o que ainda não tem.
- Aviso automático ao candidato: notificação no site + e-mail, com link do formulário.
- Atalho de WhatsApp: botão que abre a conversa com mensagem e link prontos (o gestor só clica em enviar).
- Respostas ficam na ficha do candidato, visíveis só para gestores da empresa.

## Fora do escopo
- WhatsApp 100% automático (exige API oficial do WhatsApp Business, paga e com modelos aprovados).
- Ler o currículo para preencher esses campos.
- Qualquer uso desses dados pela IA de triagem (regras 2 e 3 do projeto: a IA não muda status e o prompt é imutável; estes dados não entram na nota).
- Novo status no funil (AppStatus fica como está).

## O que seria falha
- Candidato ser bloqueado ou rejeitado por não responder.
- RG/CPF aparecerem em listas, notificações, e-mails ou logs.
- Um candidato ver ou responder a pré-entrevista de outro; um gestor de uma empresa ver dados de outra (regra 1, multi-tenant).

## Decisões do gestor (conversa de 2026-10-31)
- Momento: após currículo e perfil aprovados, quando faltarem informações.
- Gestor escolhe as perguntas: estado civil, tem filhos, resumo da vida profissional, RG, CPF.
- Canal: WhatsApp ou o próprio sistema. Aprovado: notificação automática no sistema + botão de WhatsApp com um clique do gestor.

## Chamadas minhas (revisar)
1. **Sem novo status.** Na ficha do candidato entra a ação "Pedir informações" (escolher campos e enviar). Não mexe no funil.
2. **Guardar na candidatura** (`Application`), não no perfil do candidato, para funcionar também em candidatura sem conta. Colunas novas, todas opcionais: `maritalStatus`, `hasChildren` + `childrenCount`, `professionalSummary`, `rg`, `cpf`, e o controle `infoRequestedFields String[]`, `infoRequestedAt`, `infoAnsweredAt`.
3. **"Já tem" =** coluna preenchida; para o resumo profissional, também conta ter currículo com texto extraído (`resumeText`). Campos já preenchidos vêm desmarcados.
4. **Formulário** em `/[slug]/minhas-candidaturas/[id]/pre-entrevista`, exige login do candidato dono da candidatura; mostra só os campos pedidos, com aviso de uso dos dados (LGPD). CPF validado pelos dígitos verificadores.
5. **Notificação** reusa o `notification.service` e `email.service` (novo tipo `INFO_REQUESTED`). Texto sem nenhum dado sensível.
6. **RG/CPF** ficam mascarados na ficha (ex.: `***.456.789-**`) com "mostrar" por clique, e a abertura é registrada na auditoria. Criptografia em nível de aplicação fica fora deste trabalho (o banco já criptografa em repouso).
7. **WhatsApp:** link `wa.me` com o telefone da candidatura e texto pronto; usa o telefone já cadastrado. Se não houver telefone, o botão não aparece.
8. **Reenvio:** pedir de novo atualiza `infoRequestedFields/At` e reenvia o aviso; respostas já dadas só são sobrescritas se o candidato responder de novo.

## Fica para quem constrói
Nomes de componentes e textos finais, ordem dos campos no formulário, detalhes de layout seguindo o padrão atual do painel do gestor e da área do candidato.
