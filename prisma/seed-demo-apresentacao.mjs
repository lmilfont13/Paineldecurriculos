// Empresa de demonstração para apresentar o sistema a empresas em prospecção.
// Isolada por companyId (regra 1 do CONTEXT.md) — não toca na tarhget nem em
// nenhuma outra empresa. Pode rodar de novo antes de cada apresentação: limpa
// só os dados desta empresa e recria do zero (idempotente e reversível).
//
// Rodar com: node --env-file=.env prisma/seed-demo-apresentacao.mjs
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const SLUG = "demo";
const MANAGER_EMAIL = "demo@tarhget.com.br";
const DEMO_PASSWORD = "ApresenteDemo2026";

const day = 24 * 60 * 60 * 1000;
const ago = (d) => new Date(Date.now() - d * day);
const inFuture = (d) => new Date(Date.now() + d * day);

// Currículos PDF reais já existentes em /public/demo (mesmo truque usado na
// sala de simulação /agentes — ver prisma/.../simulation.model.ts). SEM barra
// inicial: é o formato que isDemoResumePath() reconhece (prefixo "demo/") —
// com barra, o sistema tenta baixar do Storage em vez do /public e falha ao
// abrir ou reanalisar o currículo.
const RESUMES = [
  "demo/curriculo-candidato-ficticio.pdf",
  "demo/curriculo-ficticio-bruno.pdf",
  "demo/curriculo-ficticio-juliana.pdf",
  "demo/curriculo-ficticio-rafael.pdf",
];
const resumeFor = (i) => RESUMES[i % RESUMES.length];

async function ensureAuthUser(email) {
  const { error } = await supabase.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });
  if (error && !/already|registered/i.test(error.message)) {
    throw new Error(`Supabase Auth (${email}): ${error.message}`);
  }
}

async function main() {
  // 1. Empresa de demonstração
  const company = await prisma.company.upsert({
    where: { slug: SLUG },
    update: {},
    create: {
      name: "Empresa Demonstração",
      slug: SLUG,
      email: "contato@empresademonstracao.com.br",
      sector: "Varejo",
      primaryColor: "#1E4FBF",
      secondaryColor: "#0E7A6B",
      heroTitle: "Trabalhe com a gente",
      heroSubtitle: "Crie sua conta uma vez e candidate-se em um clique.",
      aboutText:
        "Ambiente de demonstração do sistema de recrutamento, com vagas e candidatos fictícios para teste.",
    },
  });
  console.log("✔ empresa demo:", company.slug);

  // 2. Limpa dados anteriores SÓ desta empresa (idempotente — pode rodar de
  // novo antes de cada apresentação para resetar o estado)
  await prisma.application.deleteMany({ where: { companyId: company.id } });
  await prisma.job.deleteMany({ where: { companyId: company.id } });
  await prisma.formField.deleteMany({ where: { companyId: company.id } });
  console.log("✔ dados anteriores da demo limpos");

  // 3. Formulário (mesmo padrão do fluxo público, para quem quiser testar
  // uma candidatura nova de verdade)
  await prisma.formField.createMany({
    data: [
      { companyId: company.id, label: "Link do LinkedIn", type: "SHORT_TEXT", required: true, order: 1, isCore: true },
      { companyId: company.id, label: "Pretensão salarial", type: "SHORT_TEXT", required: true, order: 2, isCore: false },
      {
        companyId: company.id,
        label: "Nível de experiência",
        type: "DROPDOWN",
        required: true,
        options: ["Júnior", "Pleno", "Sênior"],
        order: 3,
        isCore: false,
      },
    ],
  });
  console.log("✔ formulário de candidatura");

  // 4. Vagas
  const jobVendas = await prisma.job.create({
    data: {
      companyId: company.id,
      title: "Consultor(a) de Vendas",
      description:
        "Atendimento e vendas na loja, com foco em relacionamento e metas.\n\nVocê vai atender clientes, conduzir o processo de venda do início ao fim e ajudar a bater as metas da equipe.",
      requirements:
        "Experiência prévia com vendas ou atendimento\nBoa comunicação\nDisponibilidade de horário, incluindo finais de semana",
      location: "Fortaleza, CE",
      contract: "CLT",
      workMode: "ONSITE",
      status: "OPEN",
      publishedAt: ago(14),
      aiCriteria: ["Vendas", "Atendimento ao cliente", "Trabalho em equipe"],
      aiMinScore: 60,
    },
  });
  const jobAnalista = await prisma.job.create({
    data: {
      companyId: company.id,
      title: "Analista Administrativo(a)",
      description:
        "Suporte administrativo e financeiro ao time.\n\nOrganização de documentos, apoio em rotinas financeiras e atendimento interno.",
      requirements: "Ensino médio completo\nPacote Office (Excel e Word)\nOrganização e atenção a detalhes",
      location: "Fortaleza, CE",
      contract: "CLT",
      workMode: "HYBRID",
      status: "OPEN",
      publishedAt: ago(9),
      aiCriteria: ["Excel", "Organização", "Rotinas financeiras"],
      aiMinScore: 60,
    },
  });
  console.log("✔ 2 vagas:", jobVendas.title, "/", jobAnalista.title);

  // 5. Candidatos — variados por etapa, nota e tempo de espera, para um
  // painel e um funil realistas desde o primeiro login.
  const CANDIDATOS = [
    // --- Consultor(a) de Vendas ---
    { job: jobVendas, name: "Marcos Vinícius Souza", email: "marcos.souza.demo@example.invalid", phone: "(85) 98765-4321", status: "PENDING", score: 88, reasoning: "Boa experiência prévia com vendas e atendimento. Comunicação clara, segundo o currículo.", dias: 1 },
    { job: jobVendas, name: "Larissa Nogueira Melo", email: "larissa.melo.demo@example.invalid", phone: "(85) 99123-4567", status: "PENDING", score: 74, reasoning: "Atende os critérios mínimos de atendimento ao cliente. Experiência com vendas é mais limitada.", dias: 3 },
    { job: jobVendas, name: "Diego Fernandes Rocha", email: "diego.rocha.demo@example.invalid", phone: "(85) 99777-3344", status: "SHORTLISTED", score: 91, reasoning: "Perfil forte em vendas, com histórico de metas batidas. Boa aderência aos critérios da vaga.", dias: 4 },
    {
      job: jobVendas,
      name: "Beatriz Wanderley Lima",
      email: "beatriz.lima.demo@example.invalid",
      phone: "(85) 98123-9988",
      status: "INTERVIEW",
      score: 85,
      reasoning: "Experiência consolidada em atendimento e vendas. Disponibilidade compatível com a vaga.",
      dias: 6,
      interviewAt: inFuture(2),
      interviewMode: "Presencial",
      interviewLocation: "Loja — Av. Santos Dumont, 1500, Fortaleza",
    },
    { job: jobVendas, name: "Patrícia Gomes Silva", email: "patricia.silva.demo@example.invalid", phone: "(85) 98222-3311", status: "REJECTED", score: 42, reasoning: "Pouca experiência com vendas ou atendimento direto ao cliente, abaixo do mínimo pedido.", dias: 10 },
    // --- Analista Administrativo(a) ---
    { job: jobAnalista, name: "Carlos Mendes", email: "carlos.mendes.demo@example.invalid", phone: "(85) 99801-1234", status: "PENDING", score: 82, reasoning: "Domínio de Excel e Word, com histórico de rotinas administrativas. Boa aderência à vaga.", dias: 2 },
    { job: jobAnalista, name: "Fernanda Costa", email: "fernanda.costa.demo@example.invalid", phone: "(85) 99702-5678", status: "SHORTLISTED", score: 77, reasoning: "Experiência administrativa compatível. Excel em nível intermediário.", dias: 3 },
    {
      job: jobAnalista,
      name: "Tiago Mendes Cruz",
      email: "tiago.cruz.demo@example.invalid",
      phone: "(85) 99456-7788",
      status: "INTERVIEW",
      score: 79,
      reasoning: "Boa organização e experiência prévia em rotinas financeiras simples.",
      dias: 5,
      interviewAt: inFuture(1),
      interviewMode: "Videochamada",
      interviewLocation: "https://meet.google.com/demo-entrevista",
    },
    { job: jobAnalista, name: "João Alves", email: "joao.alves.demo@example.invalid", phone: "(85) 99603-9012", status: "APPROVED", score: 91, reasoning: "Excelente aderência: Excel avançado, organização e disponibilidade imediata.", dias: 8 },
    { job: jobAnalista, name: "Renata Alves Pinto", email: "renata.pinto.demo@example.invalid", phone: "(85) 98765-1010", status: "REJECTED", score: 48, reasoning: "Pouca familiaridade com Excel e sem experiência prévia em rotinas administrativas.", dias: 12 },
  ];

  let i = 0;
  for (const c of CANDIDATOS) {
    const candidate = await prisma.candidate.upsert({
      where: { email: c.email },
      update: { name: c.name, phone: c.phone },
      create: { email: c.email, name: c.name, phone: c.phone },
    });

    const app = await prisma.application.create({
      data: {
        jobId: c.job.id,
        companyId: company.id,
        candidateId: candidate.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        resumeUrl: resumeFor(i++),
        status: c.status,
        aiState: "DONE",
        aiScore: c.score,
        aiReasoning: c.reasoning,
        createdAt: ago(c.dias),
        updatedAt: ago(Math.max(c.dias - 1, 0)),
        ...(c.interviewAt
          ? { interviewAt: c.interviewAt, interviewMode: c.interviewMode, interviewLocation: c.interviewLocation }
          : {}),
      },
    });

    await prisma.statusEvent.create({
      data: { applicationId: app.id, from: null, to: "PENDING", actor: "candidato", createdAt: ago(c.dias) },
    });
    if (c.status !== "PENDING") {
      await prisma.statusEvent.create({
        data: { applicationId: app.id, from: "PENDING", to: c.status, actor: "gestor", createdAt: ago(Math.max(c.dias - 1, 0)) },
      });
    }
  }
  console.log(`✔ ${CANDIDATOS.length} candidatos distribuídos nas etapas do funil`);

  // 6. Usuário gestor da demo
  await ensureAuthUser(MANAGER_EMAIL);
  await prisma.user.upsert({
    where: { email: MANAGER_EMAIL },
    update: { companyId: company.id, role: "MANAGER" },
    create: { email: MANAGER_EMAIL, name: "Gestor Demonstração", role: "MANAGER", companyId: company.id },
  });

  console.log("\n✅ Empresa de demonstração pronta.");
  console.log("—".repeat(50));
  console.log("Painel do gestor:", `${process.env.NEXT_PUBLIC_APP_URL || "https://mt-triagem.vercel.app"}/login`);
  console.log("E-mail:   ", MANAGER_EMAIL);
  console.log("Senha:    ", DEMO_PASSWORD);
  console.log("Vagas públicas:", `${process.env.NEXT_PUBLIC_APP_URL || "https://mt-triagem.vercel.app"}/${SLUG}/vagas`);
  console.log("—".repeat(50));
  console.log("Dica: rode este script de novo a qualquer momento para resetar a demo ao estado inicial.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
