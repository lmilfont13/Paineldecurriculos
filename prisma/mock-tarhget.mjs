// Mock de demonstração: deixa só a tarhget ativa e popula 1 vaga com 10 candidatos.
// Rodar com: node --env-file=.env prisma/mock-tarhget.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SLUG = "tarhget";

const day = 24 * 60 * 60 * 1000;
const ago = (d) => new Date(Date.now() - d * day);

/** 10 candidatos com scores e estados variados para um painel realista. */
const CANDIDATOS = [
  { name: "Marcos Vinícius Souza", email: "marcos.souza@email.com", phone: "(11) 98765-4321", linkedin: "linkedin.com/in/marcossouza", pretensao: "R$ 8.000", nivel: "Pleno", score: 92, status: "PENDING", state: "DONE", reasoning: "Experiência sólida com React e Node.js e 4 anos na área. Inglês técnico confirmado no histórico.", dias: 1 },
  { name: "Larissa Nogueira Melo", email: "larissa.melo@email.com", phone: "(21) 99123-4567", linkedin: "linkedin.com/in/larissamelo", pretensao: "R$ 7.500", nivel: "Pleno", score: 88, status: "INTERVIEW", state: "DONE", reasoning: "Forte em back-end com Node.js e PostgreSQL. Inglês avançado e boa comunicação em times remotos.", dias: 2 },
  { name: "Camila Ferreira Dias", email: "camila.dias@email.com", phone: "(31) 98888-1122", linkedin: "linkedin.com/in/camiladias", pretensao: "R$ 9.000", nivel: "Sênior", score: 81, status: "PENDING", state: "DONE", reasoning: "Perfil sênior acima do exigido, com domínio de React. Pretensão salarial um pouco acima da faixa.", dias: 3 },
  { name: "Diego Fernandes Rocha", email: "diego.rocha@email.com", phone: "(41) 99777-3344", linkedin: "linkedin.com/in/diegorocha", pretensao: "R$ 8.200", nivel: "Pleno", score: 84, status: "APPROVED", state: "DONE", reasoning: "Aderência alta aos critérios técnicos e experiência com bancos relacionais. Inglês para leitura técnica ok.", dias: 5 },
  { name: "Beatriz Wanderley Lima", email: "beatriz.lima@email.com", phone: "(85) 98123-9988", linkedin: "linkedin.com/in/beatrizlima", pretensao: "R$ 7.000", nivel: "Pleno", score: 76, status: "PENDING", state: "DONE", reasoning: "Cobre React e Node.js, mas experiência com PostgreSQL é limitada. Vale confirmar em entrevista.", dias: 4 },
  { name: "Tiago Mendes Cruz", email: "tiago.cruz@email.com", phone: "(51) 99456-7788", linkedin: "linkedin.com/in/tiagocruz", pretensao: "R$ 6.800", nivel: "Pleno", score: 71, status: "PENDING", state: "DONE", reasoning: "Atende o mínimo com experiência full stack. Inglês não é mencionado no currículo.", dias: 6 },
  { name: "Renata Alves Pinto", email: "renata.pinto@email.com", phone: "(61) 98765-1010", linkedin: "linkedin.com/in/renatapinto", pretensao: "R$ 6.500", nivel: "Júnior", score: 68, status: "PENDING", state: "DONE", reasoning: "Boa base em React, porém pouca experiência com Node.js e back-end. Perfil mais júnior que o pedido.", dias: 7 },
  { name: "Rafael Costa Andrade", email: "rafael.andrade@email.com", phone: "(11) 97654-2211", linkedin: "linkedin.com/in/rafaelandrade", pretensao: "R$ 6.000", nivel: "Júnior", score: 63, status: "PENDING", state: "DONE", reasoning: "Experiência majoritariamente com front-end. Não demonstra domínio de bancos relacionais.", dias: 7 },
  { name: "Bruno Salles Martins", email: "bruno.martins@email.com", phone: "(19) 99333-4455", linkedin: "linkedin.com/in/brunomartins", pretensao: "R$ 7.800", nivel: "Pleno", score: 79, status: "PENDING", state: "DONE", reasoning: "Boa experiência full stack e domínio de bancos relacionais. Inglês em nível intermediário.", dias: 0 },
  { name: "Patrícia Gomes Silva", email: "patricia.silva@email.com", phone: "(27) 98222-3311", linkedin: "linkedin.com/in/patriciasilva", pretensao: "R$ 10.000", nivel: "Sênior", score: 45, status: "REJECTED", state: "DONE", reasoning: "Trajetória voltada a gestão, com pouca prática recente de desenvolvimento. Pretensão acima da faixa.", dias: 9 },
];

async function main() {
  const company = await prisma.company.findUnique({ where: { slug: SLUG } });
  if (!company) throw new Error(`Empresa "${SLUG}" não encontrada.`);

  // 1. Só a tarhget ativa
  await prisma.company.updateMany({ where: { slug: { not: SLUG } }, data: { isActive: false } });
  await prisma.company.update({ where: { id: company.id }, data: { isActive: true } });
  console.log("✔ apenas a tarhget está ativa");

  // 2. Limpa dados anteriores da tarhget (idempotente)
  await prisma.application.deleteMany({ where: { companyId: company.id } });
  await prisma.job.deleteMany({ where: { companyId: company.id } });
  await prisma.formField.deleteMany({ where: { companyId: company.id } });

  // 3. Campos do formulário
  const linkedinField = await prisma.formField.create({
    data: { companyId: company.id, label: "Link do LinkedIn", type: "SHORT_TEXT", required: true, order: 1, isCore: true },
  });
  const pretensaoField = await prisma.formField.create({
    data: { companyId: company.id, label: "Pretensão salarial", type: "SHORT_TEXT", required: true, order: 2, isCore: false },
  });
  const nivelField = await prisma.formField.create({
    data: { companyId: company.id, label: "Nível de experiência", type: "DROPDOWN", required: true, options: ["Júnior", "Pleno", "Sênior"], order: 3, isCore: false },
  });
  console.log("✔ 3 campos de formulário");

  // 4. A vaga
  const job = await prisma.job.create({
    data: {
      companyId: company.id,
      title: "Desenvolvedor(a) Full Stack Pleno",
      description:
        "Construa e mantenha as aplicações da tarhget, do back-end ao front-end.\n\nVocê vai trabalhar próximo ao time de produto, com autonomia real sobre o que entrega e espaço para propor melhorias técnicas.",
      requirements: "3+ anos com React e Node.js\nBancos relacionais e modelagem\nInglês para leitura técnica\nComunicação clara em times remotos",
      location: null,
      contract: "CLT",
      workMode: "REMOTE",
      status: "OPEN",
      aiCriteria: ["Experiência com React e Node.js", "Bancos relacionais (PostgreSQL)", "Inglês técnico"],
      aiMinScore: 70,
    },
  });
  console.log("✔ vaga:", job.title);

  // 5. 10 candidaturas com respostas e scores
  for (const c of CANDIDATOS) {
    await prisma.application.create({
      data: {
        jobId: job.id,
        companyId: company.id,
        candidateId: null,
        name: c.name,
        email: c.email,
        phone: c.phone,
        resumeUrl: null,
        status: c.status,
        aiState: c.state,
        aiScore: c.score,
        aiReasoning: c.reasoning,
        createdAt: ago(c.dias),
        answers: {
          create: [
            { fieldId: linkedinField.id, value: c.linkedin },
            { fieldId: pretensaoField.id, value: c.pretensao },
            { fieldId: nivelField.id, value: c.nivel },
          ],
        },
      },
    });
  }
  console.log(`✔ ${CANDIDATOS.length} candidaturas criadas`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
