// Seed de desenvolvimento: empresa demo, vagas, formulário e usuários de teste.
// Rodar com: node --env-file=.env prisma/seed.mjs
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const DEMO_PASSWORD = "triagem123";

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
  // 1. Bucket de currículos (privado, só PDF, 5 MB)
  const { error: bucketError } = await supabase.storage.createBucket("resumes", {
    public: false,
    fileSizeLimit: "5MB",
    allowedMimeTypes: ["application/pdf"],
  });
  if (bucketError && !/already exists/i.test(bucketError.message)) {
    throw new Error(`Storage bucket: ${bucketError.message}`);
  }
  console.log("✔ bucket resumes");

  // 2. Empresa demo
  const company = await prisma.company.upsert({
    where: { slug: "technova" },
    update: {},
    create: {
      name: "TechNova Soluções",
      slug: "technova",
      email: "contato@technova.com",
      sector: "Tecnologia",
      primaryColor: "#1E4FBF",
      secondaryColor: "#0E7A6B",
      heroTitle: "Vagas abertas",
      heroSubtitle:
        "Candidate-se em minutos, sem criar conta. Só você e seu currículo.",
      aboutText:
        "A TechNova constrói o produto que conecta empresas e candidatos.",
    },
  });
  console.log("✔ empresa", company.slug);

  // 3. Vagas (as 3 do design P1)
  if ((await prisma.job.count({ where: { companyId: company.id } })) === 0) {
    await prisma.job.createMany({
      data: [
        {
          companyId: company.id,
          title: "Desenvolvedor(a) Full Stack Pleno",
          description:
            "Construa o produto que conecta empresas e candidatos.\n\nBuscamos um(a) desenvolvedor(a) full stack para atuar no time de produto, construindo e mantendo funcionalidades da plataforma, do back-end ao front-end. Autonomia real sobre o que entrega.",
          requirements:
            "3+ anos com React e Node.js\nBancos relacionais e modelagem\nInglês para leitura técnica\nComunicação clara em times remotos",
          location: null,
          contract: "CLT",
          workMode: "REMOTE",
          status: "OPEN",
          aiCriteria: ["React", "Node.js", "PostgreSQL"],
        },
        {
          companyId: company.id,
          title: "Analista de Marketing Digital",
          description:
            "Growth, conteúdo e performance para o mercado B2B.\n\nVocê vai cuidar dos canais de aquisição da TechNova, do planejamento à análise de resultados.",
          requirements:
            "2+ anos com marketing digital B2B\nGestão de tráfego pago\nSEO e produção de conteúdo",
          location: "Fortaleza, CE",
          contract: "CLT",
          workMode: "HYBRID",
          status: "OPEN",
          aiCriteria: ["Growth", "SEO", "Tráfego pago"],
        },
        {
          companyId: company.id,
          title: "Designer de Produto UX/UI",
          description:
            "Desenhe experiências que milhares de candidatos usam.\n\nVocê será responsável pelo design end-to-end das jornadas do produto, do discovery ao handoff.",
          requirements:
            "3+ anos com produto digital\nFigma avançado\nDesign systems e prototipação",
          location: null,
          contract: "PJ",
          workMode: "REMOTE",
          status: "OPEN",
          aiCriteria: ["UX", "UI", "Figma"],
        },
      ],
    });
    console.log("✔ 3 vagas");
  } else {
    console.log("• vagas já existem, pulando");
  }

  // 4. Formulário: core (passo Perfil) + custom (passo Extras)
  if (
    (await prisma.formField.count({ where: { companyId: company.id } })) === 0
  ) {
    await prisma.formField.createMany({
      data: [
        {
          companyId: company.id,
          label: "Link do LinkedIn",
          type: "SHORT_TEXT",
          required: true,
          order: 1,
          isCore: true,
        },
        {
          companyId: company.id,
          label: "Link do GitHub",
          type: "SHORT_TEXT",
          required: false,
          order: 2,
          isCore: true,
        },
        {
          companyId: company.id,
          label: "Pretensão salarial",
          type: "SHORT_TEXT",
          required: true,
          order: 3,
          isCore: false,
        },
        {
          companyId: company.id,
          label: "Nível de experiência",
          type: "DROPDOWN",
          required: true,
          options: ["Júnior", "Pleno", "Sênior"],
          order: 4,
          isCore: false,
        },
        {
          companyId: company.id,
          label: "Disponível para viagens?",
          type: "YES_NO",
          required: true,
          order: 5,
          isCore: false,
        },
      ],
    });
    console.log("✔ 5 form fields");
  } else {
    console.log("• form fields já existem, pulando");
  }

  // 5. Usuários (Supabase Auth + tabela User)
  await ensureAuthUser("admin@triagem.app");
  await prisma.user.upsert({
    where: { email: "admin@triagem.app" },
    update: {},
    create: { email: "admin@triagem.app", name: "Admin Triagem", role: "ADMIN" },
  });

  await ensureAuthUser("ana@technova.com");
  await prisma.user.upsert({
    where: { email: "ana@technova.com" },
    update: {},
    create: {
      email: "ana@technova.com",
      name: "Ana Lima",
      role: "MANAGER",
      companyId: company.id,
    },
  });
  console.log("✔ usuários admin@triagem.app e ana@technova.com (senha: triagem123)");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
