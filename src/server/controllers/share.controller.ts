"use server";

import { prisma } from "@/lib/prisma";

/**
 * Registra compartilhamento via WhatsApp sem exigir autenticação —
 * qualquer visitante da página pública pode acionar.
 * Valida que a vaga existe e está aberta antes de incrementar.
 */
export async function trackPublicShareAction(jobId: string): Promise<void> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { status: true },
  });
  if (!job || job.status !== "OPEN") return;
  await prisma.job.update({
    where: { id: jobId },
    data: { whatsappShares: { increment: 1 } },
  });
}
