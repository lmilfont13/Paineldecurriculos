import { PrismaClient } from "@prisma/client";

import { normalizeDatabaseUrl } from "@/lib/database-url";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Singleton: uma instância de PrismaClient por processo. Guardado no
 * globalThis também em produção — se o módulo for avaliado mais de uma vez no
 * mesmo processo (chunks diferentes), reaproveita a mesma conexão.
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: normalizeDatabaseUrl(process.env.DATABASE_URL?.trim()),
      },
    },
  });

globalForPrisma.prisma = prisma;
