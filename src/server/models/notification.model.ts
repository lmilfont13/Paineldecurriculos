import type { AppStatus, NotificationType } from "@prisma/client";

/**
 * Texto de cada novidade, na voz do candidato.
 *
 * Regra inviolável: nada aqui pode ser derivado de `aiScore`, `aiReasoning`
 * ou `managerNotes` — a notificação é montada a partir do status do processo,
 * nunca da análise da IA nem das anotações internas da empresa.
 */
export function stageNotification(
  to: AppStatus,
  companyName: string,
  jobTitle: string
): { type: NotificationType; title: string; body: string } | null {
  switch (to) {
    case "INTERVIEW":
      return {
        type: "STAGE_CHANGED",
        title: "Você avançou para a entrevista",
        body: `A ${companyName} quer conversar com você sobre a vaga de ${jobTitle}. Fique de olho no e-mail para combinar o horário.`,
      };
    case "APPROVED":
      return {
        type: "RESULT",
        title: "Você foi aprovado!",
        body: `A ${companyName} aprovou sua candidatura para ${jobTitle}. Em breve entram em contato com os próximos passos.`,
      };
    case "REJECTED":
      return {
        type: "RESULT",
        title: "Processo finalizado",
        body: `A ${companyName} seguiu com outros candidatos para a vaga de ${jobTitle}. Obrigado por ter participado — suas outras candidaturas continuam ativas.`,
      };
    case "PENDING":
      // Voltar para triagem é conserto de erro do gestor; não vira novidade.
      return null;
  }
}

export function receivedNotification(
  companyName: string,
  jobTitle: string
): { type: NotificationType; title: string; body: string } {
  return {
    type: "APPLICATION_RECEIVED",
    title: "Candidatura enviada",
    body: `A ${companyName} recebeu sua candidatura para ${jobTitle}. Você é avisado por aqui assim que houver novidade.`,
  };
}

/** "agora há pouco" / "há 3 h" / "há 2 dias" — idade da novidade. */
export function formatNotificationAge(createdAt: Date): string {
  const minutes = Math.floor((Date.now() - createdAt.getTime()) / 60_000);
  if (minutes < 5) return "agora há pouco";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "ontem" : `há ${days} dias`;
}

/**
 * O que o candidato pode esperar agora — a frase que responde a pergunta que
 * o traz de volta ao site.
 */
export function whatHappensNow(status: AppStatus, companyName: string): string {
  switch (status) {
    case "PENDING":
      return `A ${companyName} está avaliando as candidaturas. Você é avisado aqui e por e-mail assim que houver novidade.`;
    case "INTERVIEW":
      return `A ${companyName} vai combinar com você o horário da conversa. Se preferir, responda o e-mail que recebeu.`;
    case "APPROVED":
      return `A ${companyName} entra em contato com os próximos passos da contratação.`;
    case "REJECTED":
      return "Este processo foi encerrado. Suas outras candidaturas continuam ativas.";
  }
}
