# Repositories

Acesso a dados (camada **Model — persistência** do MVC).

- Único lugar do projeto que importa `lib/prisma`
- Uma função exportada por consulta/mutação, sempre tipada
- Consultas de gestor recebem `companyId` como parâmetro obrigatório

Proibido aqui: regra de negócio, validação de input, envio de e-mail/IA.
