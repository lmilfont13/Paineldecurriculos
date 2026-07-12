# Models

Camada **Model (domínio)** do MVC — a "linguagem" do sistema.

- Tipos de domínio e DTOs usados entre as camadas (ex.: `SessionUser`, `PublicCompany`)
- Schemas `zod` de validação de input (consumidos pelos controllers)
- Os modelos de persistência vivem em `prisma/schema.prisma`; aqui ficam as projeções/derivações deles usadas pela aplicação

Proibido aqui: lógica com efeito colateral (I/O, banco, rede) — só tipos, schemas e funções puras.
