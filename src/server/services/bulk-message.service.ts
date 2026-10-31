import { replyToEmail } from "@/server/models/company.model";
import "server-only";

import { runInBackground } from "@/lib/background";
import { fillTemplate } from "@/server/models/message-templates.model";
import { managerMessageNotification } from "@/server/models/notification.model";
import { titleCasePt } from "@/server/models/text.model";
import { findApplicationsForBulkMessage } from "@/server/repositories/application.repository";
import { createNotifications } from "@/server/repositories/notification.repository";
import { findManagerByCompanyId } from "@/server/repositories/user.repository";
import { getCompanyById } from "@/server/services/company.service";
import { sendManagerMessageEmails, type ManagerMessageEmailParams } from "@/server/services/email.service";

/** Máximo de destinatários por envio (um erro de seleção não vira um estrago). */
export const MAX_BULK_RECIPIENTS = 300;
const MAX_SUBJECT = 80;
const MAX_TEXT = 2000;

export type BulkMessageResult =
  | {
      ok: true;
      /** Candidaturas que receberam (ou tentaram receber) a mensagem. */
      total: number;
      /** Receberam o aviso dentro do site. */
      notified: number;
      /** E-mails enviados em segundo plano. */
      emailed: number;
      /** Sem conta no site e sem e-mail válido: ninguém para avisar. */
      noChannel: number;
      /** Não entraram: não são da empresa ou são de demonstração. */
      skipped: number;
    }
  | { ok: false; error: string };

/**
 * Recado para várias candidaturas de uma vez, igual ao recado individual
 * (aviso no site + e-mail), com o texto personalizado para cada pessoa:
 * {nome}, {vaga} e {empresa}. Só alcança candidaturas da empresa do gestor.
 */
export async function sendBulkMessage(
  companyId: string,
  applicationIds: string[],
  subject: string,
  template: string
): Promise<BulkMessageResult> {
  const ids = [...new Set(applicationIds)];
  const body = template.trim();
  if (ids.length === 0) return { ok: false, error: "Nenhum candidato selecionado." };
  if (ids.length > MAX_BULK_RECIPIENTS) {
    return { ok: false, error: `Selecione no máximo ${MAX_BULK_RECIPIENTS} candidatos por envio.` };
  }
  if (body.length < 2) return { ok: false, error: "Escreva a mensagem antes de enviar." };
  if (body.length > MAX_TEXT) return { ok: false, error: `A mensagem passa de ${MAX_TEXT} caracteres.` };
  const cleanSubject = subject.trim().slice(0, MAX_SUBJECT);

  const company = await getCompanyById(companyId);
  if (!company) return { ok: false, error: "Empresa não encontrada." };

  const found = await findApplicationsForBulkMessage(companyId, ids);
  const apps = found.filter((a) => !a.isDemo);
  const skipped = ids.length - apps.length;
  if (apps.length === 0) return { ok: false, error: "Nenhuma candidatura válida entre as selecionadas." };

  const manager = await findManagerByCompanyId(companyId);
  const brand = {
    name: company.name,
    slug: company.slug,
    primaryColor: company.primaryColor,
    logoUrl: company.logoUrl,
    senderEmail: company.senderEmail,
  };

  const notifications: Parameters<typeof createNotifications>[0] = [];
  const emails: ManagerMessageEmailParams[] = [];
  let noChannel = 0;

  for (const app of apps) {
    const text = fillTemplate(body, {
      firstName: titleCasePt(app.name).split(" ")[0] ?? "",
      companyName: company.name,
      jobTitle: app.job.title,
    });
    let reached = false;
    if (app.candidateId) {
      const n = managerMessageNotification(company.name, app.job.title, text, cleanSubject || undefined);
      notifications.push({
        candidateId: app.candidateId,
        applicationId: app.id,
        type: n.type,
        title: n.title,
        body: n.body,
      });
      reached = true;
    }
    if (app.email.includes("@")) {
      emails.push({
        brand,
        to: app.email,
        candidateName: titleCasePt(app.name),
        jobTitle: app.job.title,
        message: text,
        subject: cleanSubject || undefined,
        managerEmail: replyToEmail(company.email, manager?.email),
        applicationId: app.id,
      });
      reached = true;
    }
    if (!reached) noChannel += 1;
  }

  if (notifications.length > 0) {
    try {
      await createNotifications(notifications);
    } catch (error) {
      console.error("[recado em massa] avisos no site:", error);
    }
  }
  if (emails.length > 0) {
    runInBackground("recado em massa por e-mail", () => sendManagerMessageEmails(emails));
  }

  return {
    ok: true,
    total: apps.length,
    notified: notifications.length,
    emailed: emails.length,
    noChannel,
    skipped,
  };
}
