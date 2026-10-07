import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getDatabaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return raw;

  try {
    const url = new URL(raw);

    // Vercel serverless functions can create multiple Prisma instances.
    // Supabase's session pooler (5432) is not a good fit for that model.
    // When the configured URL is the Supabase pooler, use transaction mode
    // and keep Prisma's per-instance connection footprint small.
    if (url.hostname.endsWith(".pooler.supabase.com")) {
      if (url.port === "5432") url.port = "6543";
      url.searchParams.set("pgbouncer", "true");
      url.searchParams.set("connection_limit", "3");
    }

    return url.toString();
  } catch {
    return raw;
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
