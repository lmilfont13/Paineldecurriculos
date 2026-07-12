# Services

Regra de negócio (camada **Model — domínio** do MVC).

Responsabilidades:
- Isolamento multi-tenant: todo método de gestor recebe o `companyId` da sessão e o repassa aos repositories
- Fluxo de IA: dispara Inngest após salvar candidatura; IA só escreve `aiScore`/`aiReasoning`/`aiState`, nunca `AppStatus`
- Orquestrar repositories e integrações (Storage, Resend, Anthropic)

Proibido aqui: importar `next/*` (request/response) ou componentes de UI.
