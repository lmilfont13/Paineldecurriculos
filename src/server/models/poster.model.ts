/**
 * Cartaz de vaga para o Instagram (sem I/O): decide o que entra no cartaz e
 * como o texto quebra. O desenho em si fica no navegador
 * (components/gestor/instagram-poster-draw.ts).
 *
 * Regra: o cartaz só mostra o que a vaga tem. Campo vazio não vira linha,
 * benefício vazio não vira coluna e nada de valor de exemplo.
 */
import { splitJobTitle } from "@/server/models/job-title.model";
import type { SocialJobPostData } from "@/server/models/social-post.model";

export type PosterInfoIcon = "local" | "roteiro" | "inicio" | "contrato" | "escala";
export type PosterInfoRow = { icon: PosterInfoIcon; label: string; value: string };

export type PosterBenefitIcon = "salary" | "meal" | "aid" | "health" | "phone";
export type PosterBenefit = {
  icon: PosterBenefitIcon;
  label: string;
  value: string;
  /** Valor em negrito e caixa alta, como "APARELHO / CORPORATIVO". */
  strongValue: boolean;
};

export const MAX_POSTER_BENEFITS = 5;

/** Tira emoji, marcação do WhatsApp e espaços repetidos. */
export function cleanPosterText(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}]/gu, "")
    .replace(/[*_~`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Título do cargo para o cartaz: sem a cidade repetida, em caixa alta e com o
 * "(A)" colado na palavra ("PROMOTOR (A)" → "PROMOTOR(A)").
 */
export function posterTitle(title: string, location: string | null | undefined): string {
  const city = cleanPosterText(location).split(/\s*[-,/]\s*/)[0];
  const base = splitJobTitle(cleanPosterText(title), city);
  return base
    .replace(/\s+\(\s*([AO]S?)\s*\)/gi, "($1)")
    .replace(/\(\s*([AO]S?)\s*\)/gi, "($1)")
    .toUpperCase()
    .trim();
}

type Measure = (text: string) => number;

/** Quebra o texto em linhas que cabem em `maxWidth` (palavras inteiras). */
export function wrapWords(text: string, maxWidth: number, measure: Measure): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (!current || measure(next) <= maxWidth) current = next;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Título em até duas linhas, equilibradas: escolhe o ponto de quebra que deixa
 * a linha mais larga a menor possível.
 */
export function balanceTitle(text: string, measure: Measure): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return words;
  let best: string[] = [text];
  let bestWidth = measure(text);
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    const width = Math.max(measure(a), measure(b));
    if (width < bestWidth) {
      best = [a, b];
      bestWidth = width;
    }
  }
  return best;
}

export function posterInfoRows(data: SocialJobPostData): PosterInfoRow[] {
  const rows: PosterInfoRow[] = [
    { icon: "local", label: "Local:", value: cleanPosterText(data.location) },
    { icon: "roteiro", label: "Roteiro:", value: cleanPosterText(data.route) },
    { icon: "inicio", label: "Início:", value: cleanPosterText(data.startDate) },
    { icon: "contrato", label: "Contratação:", value: cleanPosterText(data.contractType) },
    { icon: "escala", label: "Escala:", value: cleanPosterText(data.workSchedule) },
  ];
  return rows.filter((row) => row.value.length > 0);
}

const LIST_ICON: Record<string, PosterBenefitIcon> = {
  salary: "salary",
  meal: "meal",
  aid: "aid",
  health: "health",
  phone: "phone",
};

/**
 * Benefícios do cartaz: os campos preenchidos do formulário, na ordem do
 * cartaz original. Se nenhum estiver preenchido, usa a lista que a IA montou
 * (só os itens com valor). Nunca inventa.
 */
export function posterBenefits(data: SocialJobPostData): PosterBenefit[] {
  const fromFields: PosterBenefit[] = [
    { icon: "salary" as const, label: "Salário:", value: cleanPosterText(data.salary), strongValue: false },
    { icon: "meal" as const, label: "VALE REFEIÇÃO", value: cleanPosterText(data.mealVoucher), strongValue: false },
    { icon: "aid" as const, label: "AJUDA DE CUSTO", value: cleanPosterText(data.costAid), strongValue: false },
    { icon: "health" as const, label: "CONVÊNIO MÉDICO", value: cleanPosterText(data.healthInsurance), strongValue: false },
    {
      icon: "phone" as const,
      label: "APARELHO",
      value: cleanPosterText(data.corporatePhone).replace(/^aparelho\s+/i, "").toUpperCase(),
      strongValue: true,
    },
  ].filter((b) => b.value.length > 0);
  if (fromFields.length > 0) return fromFields.slice(0, MAX_POSTER_BENEFITS);

  return (data.benefitsList ?? [])
    .map((item) => ({
      icon: LIST_ICON[item.type] ?? ("aid" as const),
      label: cleanPosterText(item.label).toUpperCase(),
      value: cleanPosterText(item.value),
      strongValue: item.type === "phone",
    }))
    .filter((b) => b.label.length > 0 && b.value.length > 0)
    .slice(0, MAX_POSTER_BENEFITS);
}

/** Centros das colunas de benefício, centralizadas no cartaz de 1080 px. */
export function benefitCenters(count: number, width = 1080): number[] {
  if (count <= 0) return [];
  const pitch = Math.min(207, (width - 60) / count);
  return Array.from({ length: count }, (_, i) => width / 2 + (i - (count - 1) / 2) * pitch);
}

/** Aviso do rodapé sem o "⚠️" e sem o "Atenção:" (o cartaz desenha os dois). */
export function posterDisclaimer(value: string | null | undefined): string {
  return cleanPosterText(value).replace(/^aten[cç][aã]o\s*:\s*/i, "");
}
