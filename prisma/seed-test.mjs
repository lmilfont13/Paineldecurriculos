// Script de dados de teste: 1 vaga + 3 candidatos simulados.
// Rodar com: node --env-file=.env prisma/seed-test.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Pega a empresa existente
  const company = await prisma.company.findFirst({ where: { slug: "technova" } });
  if (!company) throw new Error("Empresa 'technova' não encontrada. Rode o seed principal primeiro.");

  // 1. Vaga de teste
  const job = await prisma.job.create({
    data: {
      companyId: company.id,
      title: "Assistente Administrativo — TESTE",
      description:
        "Vaga criada para testar as funcionalidades do painel.\n\nResponsabilidades: organização de documentos, atendimento interno e suporte às áreas de RH e Financeiro.",
      requirements:
        "Ensino médio completo\nPacote Office (Excel e Word)\nOrganização e atenção a detalhes\nDisponibilidade imediata",
      location: "Fortaleza, CE",
      contract: "CLT",
      workMode: "ONSITE",
      status: "OPEN",
      publishedAt: new Date(),
      aiCriteria: ["Excel", "Organização", "Atendimento"],
      aiMinScore: 60,
    },
  });
  console.log("✔ Vaga criada:", job.title, `(id: ${job.id})`);

  // 2. Três candidatos com etapas diferentes
  const candidates = [
    {
      name: "Carlos Mendes",
      email: "carlos.mendes.teste@example.com",
      phone: "(85) 99801-1234",
      status: "PENDING",
      aiScore: 82,
      aiState: "DONE",
      aiReasoning:
        "Candidato com experiência relevante em Excel e organização. Atende bem aos critérios definidos para a vaga.",
    },
    {
      name: "Fernanda Costa",
      email: "fernanda.costa.teste@example.com",
      phone: "(85) 99702-5678",
      status: "INTERVIEW",
      aiScore: 74,
      aiState: "DONE",
      aiReasoning:
        "Perfil adequado ao cargo. Boa comunicação e histórico de atendimento interno. Pontuação dentro do mínimo exigido.",
      interviewAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // daqui 2 dias
      interviewMode: "Videochamada",
      interviewLocation: "https://meet.google.com/teste-link",
    },
    {
      name: "João Alves",
      email: "joao.alves.teste@example.com",
      phone: "(85) 99603-9012",
      status: "APPROVED",
      aiScore: 91,
      aiState: "DONE",
      aiReasoning:
        "Excelente aderência aos critérios. Experiência comprovada com ferramentas administrativas e disponibilidade imediata.",
    },
  ];

  for (const c of candidates) {
    // Cria ou reutiliza o candidato
    const candidate = await prisma.candidate.upsert({
      where: { email: c.email },
      update: { name: c.name, phone: c.phone },
      create: {
        email: c.email,
        name: c.name,
        phone: c.phone,
      },
    });

    // Verifica se candidatura já existe
    const existing = await prisma.application.findFirst({
      where: { candidateId: candidate.id, jobId: job.id },
    });
    if (existing) {
      console.log("• candidatura de", c.name, "já existe, pulando");
      continue;
    }

    const app = await prisma.application.create({
      data: {
        jobId: job.id,
        companyId: company.id,
        candidateId: candidate.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        status: c.status,
        aiScore: c.aiScore,
        aiState: c.aiState,
        aiReasoning: c.aiReasoning,
        ...(c.interviewAt
          ? {
              interviewAt: c.interviewAt,
              interviewMode: c.interviewMode,
              interviewLocation: c.interviewLocation,
            }
          : {}),
      },
    });

    // Histórico de status (StatusEvent)
    const events = [{ from: null, to: "PENDING", actor: "candidato" }];
    if (c.status === "INTERVIEW" || c.status === "APPROVED" || c.status === "REJECTED") {
      events.push({ from: "PENDING", to: "INTERVIEW", actor: "gestor" });
    }
    if (c.status === "APPROVED") {
      events.push({ from: "INTERVIEW", to: "APPROVED", actor: "gestor" });
    }
    if (c.status === "REJECTED") {
      events.push({ from: "INTERVIEW", to: "REJECTED", actor: "gestor" });
    }

    await prisma.statusEvent.createMany({
      data: events.map((e) => ({
        applicationId: app.id,
        from: e.from,
        to: e.to,
        actor: e.actor,
      })),
    });

    console.log(`✔ ${c.name} — etapa: ${c.status}, score IA: ${c.aiScore}`);
  }

  console.log("\n✅ Pronto! Vaga de teste e 3 candidatos criados.");
  console.log(`   Veja a vaga em: /vagas/${job.id}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
