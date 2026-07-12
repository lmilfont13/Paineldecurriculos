<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Projeto Triagem

Leia @CONTEXT.md antes de qualquer alteração — contém o contexto do produto, o schema, as rotas e as **regras que não podem ser quebradas**, incluindo:

1. Isolamento multi-tenant (`companyId` sempre da sessão)
2. IA nunca bloqueia o candidato nem muda `AppStatus`
3. Prompt da IA imutável
4. Marca do cliente no fluxo público, login e acentos do painel do gestor (via CSS vars `--brand-*`); admin sempre neutro
5. Currículo: só PDF ≤ 5 MB
6. **Arquitetura em camadas (MVC)**, tudo em `src/`: `Routes/View (app/, components/) → Controller (server/controllers/) → Service (server/services/) → Repository (server/repositories/) → lib/prisma`, com `server/models/` (tipos + schemas zod) como contrato entre camadas e `src/proxy.ts` na borda HTTP. Nenhuma camada pula a de baixo; só repositories importam o Prisma.

Design no Figma (35 telas) — ler antes de codar qualquer tela: https://www.figma.com/design/GrcF3tr4NmqFq7Kxc4CouS/
