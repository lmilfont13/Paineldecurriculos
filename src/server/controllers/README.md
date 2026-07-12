# Controllers

Server actions e handlers de rota (camada **Controller** do MVC).

Responsabilidades:
- Validar input com `zod`
- Resolver sessão e tenant (`companyId`)
- Chamar o service correspondente e mapear o resultado para a resposta

Proibido aqui: importar `lib/prisma` ou conter regra de negócio.
