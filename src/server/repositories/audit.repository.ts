import "server-only";

import { prisma } from "@/lib/prisma";

export type AuditAction =
  | "VAGA_CRIADA"
  | "VAGA_EDITADA"
  | "VAGA_PUBLICADA"
  | "VAGA_PAUSADA"
  | "VAGA_ENCERRADA"
  | "CANDIDATURA_STATUS_ALTERADO"
  | "ENTREVISTA_AGENDADA"
  | "RECADO_ENVIADO"
  | "NOTA_SALVA"
  | "CONFIGURACOES_ATUALIZADAS"
  | "VAGA_COMPARTILHADA_WHATSAPP";

export interface CreateAuditLogInput {
  companyId: string;
  userId?: string;
  userEmail?: string;
  userName?: string | null;
  action: AuditAction;
  entityType?: "VAGA" | "CANDIDATURA" | "EMPRESA";
  entityId?: string;
  entityLabel?: string;
  metadata?: Record<string, unknown>;
}

export function createAuditLog(input: CreateAuditLogInput) {
  return prisma.auditLog.create({ data: input });
}

export function findAuditLogs(companyId: string, limit = 200) {
  return prisma.auditLog.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
