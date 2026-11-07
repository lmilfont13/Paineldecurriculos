import "server-only";

import type { AppStatus } from "@prisma/client";

import { DEFAULT_CHANNELS } from "@/server/models/contact-channels.model";
import { getCompanyApplication, setApplicationStatus } from "@/server/services/application.service";
import { sendBulkMessage } from "@/server/services/bulk-message.service";

const MAX_TEXT = 2000;

/**
 * Como avisar o candidato ao mover de etapa:
 * - standard: a mensagem padrão da etapa (a da prévia), como sempre;
 * - custom:   a mensagem que o gestor editou, no lugar da padrão;
 * - silent:   muda a etapa sem avisar (ajuste interno).
 */
export type MoveNotice =
  | { mode: "standard" }
  | { mode: "silent" }
  | { mode: "custom"; subject: string; text: string };

export type MoveResult = { ok: true; notice: MoveNotice["mode"] } | { ok: false; error: string };

/** Move uma candidatura da empresa (regra 1) por decisão do gestor (regra 2). */
export async function moveApplication(
  companyId: string,
  applicationId: string,
  status: AppStatus,
  notice: MoveNotice
): Promise<MoveResult> {
  // Mensagem editada é validada antes de mexer na etapa.
  if (notice.mode === "custom") {
    const text = notice.text.trim();
    if (text.length < 2) return { ok: false, error: "Escreva a mensagem ou envie a padrão." };
    if (text.length > MAX_TEXT) return { ok: false, error: `A mensagem passa de ${MAX_TEXT} caracteres.` };
  }

  const application = await getCompanyApplication(companyId, applicationId);
  if (!application) return { ok: false, error: "Candidatura não encontrada." };

  if (application.hasImpediment && (status === "INTERVIEW" || status === "APPROVED")) {
    return {
      ok: false,
      error: "Candidato possui impedimento de contratação ativo (Tarja Preta) e não pode ser movido para Entrevista ou Aprovado.",
    };
  }

  const updated = await setApplicationStatus(companyId, applicationId, status, {
    communicate: notice.mode === "standard",
  });
  if (!updated) return { ok: false, error: "Não foi possível mover o candidato." };

  if (notice.mode === "custom" && status !== application.status) {
    const sent = await sendBulkMessage(
      companyId,
      [applicationId],
      notice.subject,
      notice.text.trim(),
      [...DEFAULT_CHANNELS]
    );
    if (!sent.ok) return { ok: false, error: `Etapa alterada, mas a mensagem não saiu: ${sent.error}` };
  }
  return { ok: true, notice: notice.mode };
}
