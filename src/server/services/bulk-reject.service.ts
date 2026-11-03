import "server-only";

import type { ContactChannel } from "@/server/models/contact-channels.model";
import {
  getCompanyApplication,
  setApplicationStatus,
} from "@/server/services/application.service";
import {
  MAX_BULK_RECIPIENTS,
  sendBulkMessage,
  type BulkMessageResult,
} from "@/server/services/bulk-message.service";

const MAX_TEXT = 2000;

export type BulkRejectResult =
  | {
      ok: true;
      /** Candidaturas que foram para "Reprovados". */
      rejected: number;
      /** Ids reprovados (a tela atualiza o funil sem recarregar). */
      rejectedIds: string[];
      /** Não entraram: já tinham saído da triagem, são de outra vaga ou de outra empresa. */
      skipped: number;
      /** Resultado do envio da mensagem escolhida (null se ninguém foi reprovado). */
      message: BulkMessageResult | null;
    }
  | { ok: false; error: string };

/**
 * Reprova de uma vez quem ficou na triagem de uma vaga e manda a mensagem que
 * o gestor escolheu — no lugar do aviso automático de reprovação, para cada
 * pessoa receber uma mensagem só. Decisão sempre do gestor (regra 2); só
 * alcança candidaturas da empresa dele (regra 1) e só as que ainda estão em
 * triagem nesta vaga, mesmo que a tela esteja desatualizada.
 */
export async function rejectPendingWithMessage(
  companyId: string,
  input: {
    jobId: string;
    applicationIds: string[];
    subject: string;
    template: string;
    channels: ContactChannel[];
  }
): Promise<BulkRejectResult> {
  const ids = [...new Set(input.applicationIds)];
  const body = input.template.trim();
  // Valida a mensagem ANTES de mexer em qualquer etapa: nada de reprovar sem avisar.
  if (ids.length === 0) return { ok: false, error: "Nenhum candidato selecionado." };
  if (ids.length > MAX_BULK_RECIPIENTS) {
    return { ok: false, error: `Selecione no máximo ${MAX_BULK_RECIPIENTS} candidatos por vez.` };
  }
  if (body.length < 2) return { ok: false, error: "Escreva a mensagem antes de reprovar." };
  if (body.length > MAX_TEXT) return { ok: false, error: `A mensagem passa de ${MAX_TEXT} caracteres.` };
  if (input.channels.length === 0) return { ok: false, error: "Escolha ao menos um canal para enviar." };

  const rejectedIds: string[] = [];
  for (const id of ids) {
    const application = await getCompanyApplication(companyId, id);
    if (!application || application.jobId !== input.jobId || application.status !== "PENDING") continue;
    const updated = await setApplicationStatus(companyId, id, "REJECTED", { communicate: false });
    if (updated) rejectedIds.push(id);
  }

  const message =
    rejectedIds.length > 0
      ? await sendBulkMessage(companyId, rejectedIds, input.subject, body, input.channels)
      : null;

  return {
    ok: true,
    rejected: rejectedIds.length,
    rejectedIds,
    skipped: ids.length - rejectedIds.length,
    message,
  };
}
