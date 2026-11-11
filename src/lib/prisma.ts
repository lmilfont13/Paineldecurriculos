import { PrismaClient } from "@prisma/client";

import { normalizeDatabaseUrl } from "@/lib/database-url";
import { decryptSensitiveDeep, encryptSensitiveWrites, fieldKey } from "@/lib/field-crypto";

/**
 * RG e CPF ficam cifrados no banco (ver lib/field-crypto). A cifra acontece
 * aqui, em toda gravação e leitura, para nenhuma consulta escapar: o resto do
 * código continua enxergando o valor normal.
 */
function createPrisma(options?: ConstructorParameters<typeof PrismaClient>[0]) {
  return new PrismaClient(options).$extends({
    name: "cifra-rg-cpf",
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const key = fieldKey();
          const result = await query(encryptSensitiveWrites(args, key));
          return decryptSensitiveDeep(result, key);
        },
      },
    },
  });
}

type AppPrisma = ReturnType<typeof createPrisma>;

const globalForPrisma = globalThis as unknown as { prisma?: AppPrisma };

/**
 * Singleton: uma instância de PrismaClient por processo. Guardado no
 * globalThis também em produção — se o módulo for avaliado mais de uma vez no
 * mesmo processo (chunks diferentes), reaproveita a mesma conexão.
 */
const dbUrl = normalizeDatabaseUrl(process.env.DATABASE_URL?.trim());

export const prisma =
  globalForPrisma.prisma ??
  createPrisma(
    dbUrl
      ? {
          datasources: {
            db: {
              url: dbUrl,
            },
          },
        }
      : undefined
  );

globalForPrisma.prisma = prisma;
