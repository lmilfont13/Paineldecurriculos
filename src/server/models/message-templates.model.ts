/** Negativa pronta, com marcadores {nome}, {vaga} e {empresa}: texto fixo, sem IA, sem motivo e sem promessa. */
export const REJECTION_TEMPLATE =
  "{nome}, agradecemos o seu interesse na vaga de {vaga} na {empresa} e o tempo dedicado ao processo.\n" +
  "Depois de analisar os perfis, neste momento não vamos seguir com a sua candidatura.\n" +
  "Seu cadastro continua ativo para você se candidatar a outras vagas da {empresa}. Desejamos sucesso na sua trajetória.";

/** Negativa para um candidato específico. */
export function rejectionMessage(
  candidateName: string,
  companyName: string,
  jobTitle: string
): string {
  const first = candidateName.trim().split(/\s+/)[0] ?? "";
  return fillTemplate(REJECTION_TEMPLATE, { firstName: first, companyName, jobTitle });
}

export type TemplateContext = {
  firstName: string;
  companyName: string;
  jobTitle: string;
};

/** Chave do assunto para achar o mesmo modelo: sem caixa, acento nem espaço repetido. */
export function subjectKey(subject: string): string {
  return subject
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const replaceAll = (text: string, from: string, to: string) =>
  from.length < 2 ? text : text.split(from).join(to);

/** Texto enviado → modelo reaproveitável: nome, empresa e vaga viram marcadores. */
export function toTemplate(text: string, ctx: TemplateContext): string {
  // do mais longo para o mais curto, para um valor não "comer" o outro
  return [
    [ctx.jobTitle, "{vaga}"],
    [ctx.companyName, "{empresa}"],
    [ctx.firstName, "{nome}"],
  ]
    .sort((a, b) => b[0].length - a[0].length)
    .reduce((acc, [value, marker]) => replaceAll(acc, value, marker), text);
}

/** Modelo salvo → texto para este candidato. */
export function fillTemplate(body: string, ctx: TemplateContext): string {
  return body
    .split("{nome}").join(ctx.firstName)
    .split("{empresa}").join(ctx.companyName)
    .split("{vaga}").join(ctx.jobTitle);
}
