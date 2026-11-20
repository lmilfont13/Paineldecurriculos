/**
 * Vitrine de contratados na página pública de vagas (sem I/O).
 * Só aparece quem foi aprovado, autorizou na área do candidato e não foi
 * ocultado pelo gestor. Mostra nome completo, vaga e mês — nada além disso.
 */
import { jobCity, splitJobTitle } from "@/server/models/job-title.model";

/** Quantas pessoas a página de vagas mostra. */
export const SHOWCASE_LIMIT = 12;

export type PublicHire = {
  id: string;
  name: string;
  role: string;
  city: string;
  month: string;
};

export type ShowcaseRow = {
  id: string;
  name: string;
  jobTitle: string;
  jobLocation: string | null;
  approvedAt: Date;
};

/** Nome com espaços e caixa arrumados: "MARIA  da silva" → "Maria da Silva". */
export function displayName(raw: string): string {
  const lower = new Set(["da", "de", "do", "das", "dos", "e"]);
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .map((word, i) =>
      i > 0 && lower.has(word) ? word : word.charAt(0).toLocaleUpperCase("pt-BR") + word.slice(1)
    )
    .join(" ");
}

/** "nov. de 2026" → "nov/2026". */
export function hireMonth(date: Date): string {
  const month = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "America/Sao_Paulo" })
    .format(date)
    .replace(".", "");
  const year = new Intl.DateTimeFormat("pt-BR", { year: "numeric", timeZone: "America/Sao_Paulo" }).format(date);
  return `${month}/${year}`;
}

/** Nome de conta excluída ou vazio nunca vai para a vitrine. */
export function isShowableName(name: string): boolean {
  const clean = name.trim();
  return clean.length >= 2 && !/conta exclu[ií]da/i.test(clean);
}

export function toPublicHires(rows: ShowcaseRow[], limit = SHOWCASE_LIMIT): PublicHire[] {
  return rows
    .filter((row) => isShowableName(row.name))
    .sort((a, b) => b.approvedAt.getTime() - a.approvedAt.getTime())
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      name: displayName(row.name),
      role: splitJobTitle(row.jobTitle, row.jobLocation),
      city: jobCity(row.jobLocation),
      month: hireMonth(row.approvedAt),
    }));
}

/** Pedido de autorização aos aprovados ({nome} e {empresa} são trocados por pessoa). */
export const SHOWCASE_ASK_SUBJECT = "Você aparece na nossa página de vagas?";
export const SHOWCASE_ASK_TEXT = `Olá, {nome}!

Você foi contratado(a) pela {empresa} pela nossa página de vagas, e queremos mostrar para quem está procurando emprego que as contratações acontecem de verdade por lá.

Se você autorizar, vamos mostrar na página de vagas apenas seu nome, a vaga e o mês em que você foi contratado(a). Nada além disso.

Para responder, abra sua candidatura e toque em "Sim, pode mostrar" ou "Prefiro não". Você pode mudar de ideia quando quiser. Se preferir não aparecer, não muda nada no seu trabalho com a gente.

Obrigado!
Equipe {empresa}`;
