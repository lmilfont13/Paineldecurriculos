import "server-only";

import { prisma } from "@/lib/prisma";
import type { LiveDoubt } from "@/server/models/live-doubt.model";

export const LIVE_DOUBTS_KEY = "__live_doubts__";

/** Busca todas as dúvidas salvas da empresa. */
export async function findLiveDoubtsRaw(companyId: string): Promise<string | null> {
  const row = await prisma.messageTemplate.findUnique({
    where: { companyId_subjectKey: { companyId, subjectKey: LIVE_DOUBTS_KEY } },
    select: { body: true },
  });
  return row?.body ?? null;
}

/** Salva a lista de dúvidas atualizada da empresa. */
export async function saveLiveDoubtsRaw(companyId: string, body: string): Promise<void> {
  await prisma.messageTemplate.upsert({
    where: { companyId_subjectKey: { companyId, subjectKey: LIVE_DOUBTS_KEY } },
    create: {
      companyId,
      subject: "Dúvidas Ao Vivo dos Candidatos",
      subjectKey: LIVE_DOUBTS_KEY,
      body,
    },
    update: { body },
  });
}
