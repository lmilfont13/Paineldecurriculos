# Auditoria do produto — Triagem

Data: 2026-10-06

## Diagnóstico executivo

O Triagem já tem uma base sólida de SaaS multi-tenant: isolamento por `companyId`, decisão manual do gestor, IA separada do `AppStatus`, histórico de status, notificações e pipeline visual.

O próximo salto não deve ser mais telas. Deve ser **reduzir o trabalho operacional do recrutador** e tornar o sistema mais rápido e proativo.

## 🔴 Crítico / agora

### 1. Comunicação de mudança de etapa
A mudança de status não deve esperar e-mail ou notificações. A decisão do gestor precisa terminar no menor caminho possível.

Implementado nesta branch:
- evento `application/status-changed`;
- agente Inngest com retry;
- novidade no portal + e-mail em background;
- fallback assíncrono quando Inngest ainda não estiver configurado;
- auditoria fora do caminho crítico.

### 2. Banco / consultas do pipeline
O pipeline filtra candidaturas por empresa, status e vaga e ordena por score/data. Foram adicionados índices para esses caminhos e para o histórico de status.

### 3. Inngest em produção
O código não deve assumir que ausência de `INNGEST_EVENT_KEY` significa Dev Server quando está em produção. A configuração agora diferencia explicitamente desenvolvimento de produção.

**Pendência operacional:** configurar `INNGEST_EVENT_KEY` e `INNGEST_SIGNING_KEY` no ambiente de produção e registrar a URL `/api/inngest` no Inngest.

## 🟠 Alto impacto / próxima sprint

### 4. Central de Inteligência
Uma página que diga ao gestor o que merece atenção agora:
- candidatos acima do corte aguardando triagem;
- entrevistas atrasadas;
- candidatos parados;
- vagas com gargalos;
- candidatos rejeitados compatíveis com outras vagas.

### 5. Agente de Triagem
Evoluir de score para parecer:
- pontos fortes;
- pontos de atenção;
- aderência aos critérios;
- perguntas sugeridas;
- recomendação de próxima etapa.

A IA continua sem permissão para alterar `AppStatus`.

### 6. Agente de Comunicação
Além de mudança de etapa:
- convite para entrevista;
- confirmação;
- lembrete;
- pedido de informação;
- follow-up;
- mensagens preparadas para aprovação do gestor.

### 7. Talent Pool inteligente
Detectar candidatos de outras vagas com alta aderência à vaga atual.

## 🟢 Diferencial / roadmap

### 8. Agente de Entrevista
Gerar roteiro por vaga e candidato e, depois da entrevista, organizar avaliação por critérios.

### 9. Agente de Decisão
Consolidar currículo + entrevista + critérios em um parecer objetivo para o gestor.

### 10. Agente de Saúde do Recrutamento
Monitorar tempo em cada etapa, gargalos e vagas que estão perdendo candidatos.

## Princípio de arquitetura dos agentes

```
Evento → Agente → evidência/recomendação → gestor → ação
```

A IA não deve ser autorizada a tomar decisões de contratação.

## Ordem recomendada

1. Performance e confiabilidade
2. Comunicação automática
3. Central de Inteligência
4. Triagem explicável
5. Talent Pool
6. Entrevista assistida
7. Decisão assistida

## Meta de produto

O Triagem deve deixar de ser percebido como um "painel de currículos" e passar a ser percebido como:

> **um sistema operacional de recrutamento que prepara o trabalho para o recrutador e deixa a decisão nas mãos dele.**
