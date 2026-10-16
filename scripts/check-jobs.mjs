import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function run() {
  const jobs = await prisma.job.findMany({
    select: { id: true, title: true, description: true, requirements: true, location: true }
  });
  console.log("Found jobs:", jobs.length);
  for (const j of jobs) {
    console.log(`\n--- [${j.id}] ${j.title} ---`);
    console.log("DESC:", j.description);
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
