/**
 * O que o candidato recebe quando o gestor muda a etapa: e-mail (entrevista,
 * aprovação, reprovação) e aviso na área do candidato. Fonte única do texto —
 * o envio (email.service / notification.service) e a prévia que o gestor vê
 * ao mover saem daqui, então a prévia é sempre o que vai.
 *
 * Regra inviolável: nada aqui vem de aiScore, aiReasoning ou notas internas.
 */
import type { AppStatus } from "@prisma/client";

import { stageNotification } from "@/server/models/notification.model";

export type EmailStage = "INTERVIEW" | "APPROVED" | "REJECTED";

export function isEmailStage(status: AppStatus): status is EmailStage {
  return status === "INTERVIEW" || status === "APPROVED" || status === "REJECTED";
}

/** Texto do e-mail de mudança de etapa (texto puro; o e-mail só destaca a vaga). */
export function stageEmailCopy(
  status: EmailStage,
  companyName: string,
  jobTitle: string
): { subject: string; title: string; body: string } {
  switch (status) {
    case "INTERVIEW":
      return {
        subject: `Você avançou: ${jobTitle}`,
        title: "Você avançou para a entrevista",
        body: `A ${companyName} quer conversar com você sobre a vaga de ${jobTitle}. Em breve alguém entra em contato para combinar o horário.`,
      };
    case "APPROVED":
      return {
        subject: `Você foi aprovado: ${jobTitle}`,
        title: "Você foi aprovado",
        body: `A ${companyName} aprovou sua candidatura para ${jobTitle}. O próximo contato é sobre a contratação.`,
      };
    case "REJECTED":
      return {
        subject: `Sobre sua candidatura: ${jobTitle}`,
        title: "Processo encerrado",
        body: `Muito obrigado por se candidatar à vaga de ${jobTitle} na ${companyName}. Seu currículo é bom e agradecemos o tempo que você dedicou, mas, neste momento, vamos seguir com outros perfis. Isso não diminui o que você construiu até aqui. Seu cadastro continua ativo para as próximas vagas: continue firme e acredite no seu potencial!`,
      };
  }
}

/** "Oi, Maria." — mesma saudação do e-mail. */
export function greetingFor(candidateName: string): string {
  const first = candidateName.trim().split(/\s+/)[0] ?? "";
  return first ? `Oi, ${first}.` : "Oi.";
}

export type StageMovePreview = {
  /** E-mail que sai (null nas etapas que só avisam no site). */
  email: { subject: string; title: string; greeting: string; body: string } | null;
  /** Aviso na área do candidato (null quando a etapa não vira novidade). */
  site: { title: string; body: string } | null;
};

/** Tudo o que o candidato vai receber ao ir para `status`. */
export function stageMovePreview(
  status: AppStatus,
  ctx: { candidateName: string; companyName: string; jobTitle: string }
): StageMovePreview {
  const site = stageNotification(status, ctx.companyName, ctx.jobTitle);
  const email = isEmailStage(status)
    ? { ...stageEmailCopy(status, ctx.companyName, ctx.jobTitle), greeting: greetingFor(ctx.candidateName) }
    : null;
  return { email, site: site ? { title: site.title, body: site.body } : null };
}
