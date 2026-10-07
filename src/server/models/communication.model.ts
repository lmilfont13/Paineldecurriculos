/**
 * Resultado da comunicação com o candidato, canal por canal. Funções puras —
 * testadas em communication.model.test.ts.
 */

/**
 * - sent: o Resend aceitou o envio
 * - sandbox: enviado pelo remetente de teste (onboarding@resend.dev), que só
 *   entrega para o dono da conta Resend; na prática o candidato não recebe
 * - off: RESEND_API_KEY não configurada
 * - failed: o Resend recusou ou deu erro
 * - none: este aviso não tem e-mail (ex.: volta para Triagem, e-mail inválido)
 */
export type EmailOutcome = "sent" | "sandbox" | "off" | "failed" | "none";
export type SiteOutcome = "ok" | "no-account" | "failed";

export type DeliveryReport = { site: SiteOutcome; email: EmailOutcome };

const SITE_TEXT: Record<SiteOutcome, string> = {
  ok: "aviso no site entregue",
  "no-account": "sem aviso no site (candidatura sem conta)",
  failed: "aviso no site falhou",
};

const EMAIL_TEXT: Record<EmailOutcome, string> = {
  sent: "e-mail enviado",
  sandbox: "e-mail não chega ao candidato (remetente de teste do Resend)",
  off: "e-mail desligado (falta RESEND_API_KEY)",
  failed: "e-mail falhou",
  none: "sem e-mail para esta etapa",
};

const STATUS_TEXT: Record<string, string> = {
  PENDING: "Triagem",
  INTERVIEW: "Entrevista",
  APPROVED: "Aprovado",
  REJECTED: "Processo finalizado",
};

/** Resumo da execução do Agente de Comunicação para a tela /agentes. */
export function describeDelivery(status: string, report: DeliveryReport): string {
  const stage = STATUS_TEXT[status] ?? status;
  const site = SITE_TEXT[report.site];
  const email = EMAIL_TEXT[report.email];
  return `${stage}: ${site}; ${email}.`;
}

/** Algum canal realmente chegou ao candidato? */
export function reachedCandidate(report: DeliveryReport): boolean {
  return report.site === "ok" || report.email === "sent";
}
