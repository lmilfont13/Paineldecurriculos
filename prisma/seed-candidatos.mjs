// Adiciona 3 candidatos à vaga de teste para testar a avaliação da IA.
// Rodar com: node --env-file=.env prisma/seed-candidatos.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const JOB_ID = "cmukgq0iw0001ujdwlejs2w99"; // Assistente Administrativo — TESTE

const CANDIDATOS = [
  {
    name: "Mariana Souza",
    email: "mariana.souza.teste@example.com",
    phone: "(85) 98801-2233",
    aiScore: 88,
    aiReasoning:
      "Excelente domínio do Pacote Office e histórico sólido em funções administrativas. Disponibilidade imediata e ótima aderência aos critérios da vaga.",
  },
  {
    name: "Rafael Oliveira",
    email: "rafael.oliveira.teste@example.com",
    phone: "(85) 97702-3344",
    aiScore: 55,
    aiReasoning:
      "Candidato em início de carreira, com conhecimento básico de Excel. Não atende plenamente ao critério de organização e atenção a detalhes descrito na vaga.",
  },
  {
    name: "Patrícia Lima",
    email: "patricia.lima.teste@example.com",
    phone: "(85) 96603-4455",
    aiScore: 71,
    aiReasoning:
      "Perfil razoavelmente alinhado. Tem experiência com atendimento interno e Word, mas Excel é intermediário. Pode precisar de treinamento inicial.",
  },
];

async function main() {
  const job = await prisma.job.findUnique({ where: { id: JOB_ID }, select: { id: true, companyId: true, title: true } });
  if (!job) throw new Error(`Vaga ${JOB_ID} não encontrada.`);
  console.log(`Adicionando candidatos à vaga: "${job.title}"`);

  for (const c of CANDIDATOS) {
    const candidate = await prisma.candidate.upsert({
      where: { email: c.email },
      update: { name: c.name, phone: c.phone },
      create: { email: c.email, name: c.name, phone: c.phone },
    });

    const existing = await prisma.application.findFirst({
      where: { candidateId: candidate.id, jobId: job.id },
    });
    if (existing) {
      console.log(`• ${c.name} já tem candidatura, pulando`);
      continue;
    }

    const app = await prisma.application.create({
      data: {
        jobId: job.id,
        companyId: job.companyId,
        candidateId: candidate.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        status: "PENDING",
        aiScore: c.aiScore,
        aiState: "DONE",
        aiReasoning: c.aiReasoning,
      },
    });

    await prisma.statusEvent.create({
      data: { applicationId: app.id, from: null, to: "PENDING", actor: "candidato" },
    });

    const atendeMinimo = c.aiScore >= 60 ? "✅ atende o mínimo" : "❌ abaixo do mínimo";
    console.log(`✔ ${c.name} — score IA: ${c.aiScore} (${atendeMinimo})`);
  }

  console.log("\n✅ Pronto! 3 candidatos adicionados em Triagem.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
