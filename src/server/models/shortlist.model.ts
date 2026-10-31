import { readChecklist } from "@/server/models/ai.model";

/** Candidatura como a análise comparativa a lê (sem nome nem contatos). */
export type ShortlistInput = {
  id: string;
  /** Só para apagar o nome do texto do currículo; nunca vai para a IA. */
  name?: string;
  status: string;
  aiScore: number | null;
  aiReasoning: string | null;
  aiProfile: string | null;
  aiArea: string | null;
  aiLevel: string | null;
  aiChecklist: unknown;
  resumeText: string | null;
};

export type ShortlistPick = {
  applicationId: string;
  rank: number;
  reason: string;
  strengths: string[];
  concerns: string[];
};

/** Quantos candidatos cabem numa análise (limite de tamanho do pedido à IA). */
export const SHORTLIST_MAX_CANDIDATES = 15;
const RESUME_EXCERPT = 1500;

/** Quem entra na análise: sem reprovados, maior nota primeiro, sem nota por último. */
export function pickCandidatesForShortlist(
  rows: ShortlistInput[],
  max = SHORTLIST_MAX_CANDIDATES
): ShortlistInput[] {
  return rows
    .filter((r) => r.status !== "REJECTED")
    .map((r, index) => ({ r, index }))
    .sort((a, b) => {
      const diff = (b.r.aiScore ?? -1) - (a.r.aiScore ?? -1);
      return diff !== 0 ? diff : a.index - b.index;
    })
    .slice(0, max)
    .map(({ r }) => r);
}

/** Tira e-mail, telefone e CPF do texto antes de ele sair para a IA. */
export function redactContacts(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[contato removido]")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[documento removido]")
    .replace(/\(\d{2}\)\s?\d{4,5}[\s.-]?\d{4}/g, "[contato removido]")
    .replace(/(?:\+?55\s?)?\b\d{2}\s?9\d{4}[\s.-]?\d{4}\b/g, "[contato removido]")
    .replace(/\b9\d{4}[\s.-]?\d{4}\b/g, "[contato removido]")
    .replace(/\b\d{10,13}\b/g, "[número removido]");
}

/** Apaga o nome do candidato (inteiro e cada parte com 3+ letras) do texto do currículo. */
export function redactName(text: string, name: string): string {
  const parts = name
    .split(/\s+/)
    .filter((p) => p.length >= 3 && !["das", "dos", "del", "van", "von"].includes(p.toLowerCase()));
  // Partes do nome são só letras (acentuadas ou não); qualquer outro caractere é ignorado.
  const letters = (p: string) => p.replace(/[^\p{L}]/gu, "");
  return parts.reduce((acc, part) => {
    const word = letters(part);
    if (word.length < 3) return acc;
    // "\b" não conhece acentos: usa limites de letra do Unicode.
    return acc.replace(
      new RegExp(`(?<!\\p{L})${word}(?!\\p{L})`, "giu"),
      "[candidato]"
    );
  }, text);
}

/** Tira nome e contatos de qualquer texto antes de ele ir para a IA (contatos primeiro, para não quebrar e-mails). */
export function scrubText(text: string, name: string): string {
  return redactName(redactContacts(text), name);
}

const SYSTEM = `Você é um especialista em RH que compara candidatos para UMA vaga e indica os melhores.
Ignore nome, gênero, idade, foto e origem. Avalie só habilidades e experiência, comparando os candidatos entre si.
Use apenas o material fornecido; não invente. Cada candidato é identificado por um rótulo (C1, C2...).
Retorne JSON exatamente neste formato, do melhor para o pior, sem texto fora do JSON:
{ "ranking": [ { "candidato": "C2", "motivo": "1-2 frases do porquê está nesta posição", "pontos_fortes": ["..."], "pontos_atencao": ["..."] } ] }
Cada lista com no máximo 3 itens curtos.`;

/** Monta o pedido de comparação; `labelToId` volta do rótulo (C1...) para a candidatura. */
export function buildShortlistPrompt(
  job: { jobTitle: string; requirements: string | null; criteria: string[] },
  candidates: ShortlistInput[],
  topN: number
): { system: string; prompt: string; labelToId: Record<string, string> } {
  const labelToId: Record<string, string> = {};
  const blocks = candidates.map((c, i) => {
    const label = `C${i + 1}`;
    labelToId[label] = c.id;
    const lines = [`### ${label}`];
    if (c.aiScore !== null) lines.push(`Nota da triagem: ${c.aiScore}/100`);
    const profile = [c.aiProfile, c.aiArea, c.aiLevel].filter(Boolean).join(" · ");
    if (profile) lines.push(`Perfil: ${profile}`);
    if (c.aiReasoning) lines.push(`Leitura da triagem: ${scrubText(c.aiReasoning, c.name ?? "")}`);
    const checklist = readChecklist(c.aiChecklist);
    if (checklist.length > 0) {
      lines.push(
        "Critérios: " + checklist.map((k) => `${k.criterion} = ${k.met}`).join("; ")
      );
    }
    const excerpt = scrubText(c.resumeText ?? "", c.name ?? "").replace(/\s+/g, " ").trim().slice(0, RESUME_EXCERPT);
    if (excerpt) lines.push(`Currículo (trecho): ${excerpt}`);
    return lines.join("\n");
  });

  const prompt = [
    `Vaga: ${job.jobTitle}`,
    job.requirements ? `Requisitos:\n${job.requirements}` : "",
    job.criteria.length > 0 ? `Critérios de avaliação: ${job.criteria.join("; ")}` : "",
    `Indique os ${topN} melhores candidatos para esta vaga (ou menos, se não houver tantos bons).`,
    "",
    blocks.join("\n\n"),
  ]
    .filter((l) => l !== "")
    .join("\n");

  return { system: SYSTEM, prompt, labelToId };
}

const text = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

const list = (v: unknown) =>
  Array.isArray(v) ? v.map((x) => text(x, 120)).filter(Boolean).slice(0, 3) : [];

/** Lê a resposta da IA: ordem preservada, rótulos desconhecidos ou repetidos descartados. */
export function parseShortlist(
  raw: string,
  labelToId: Record<string, string>,
  topN: number
): ShortlistPick[] {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }
  const ranking = (data as { ranking?: unknown }).ranking;
  if (!Array.isArray(ranking)) return [];

  const picks: ShortlistPick[] = [];
  const seen = new Set<string>();
  for (const item of ranking) {
    if (picks.length >= topN) break;
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = labelToId[text(o.candidato, 10).toUpperCase()];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    picks.push({
      applicationId: id,
      rank: picks.length + 1,
      reason: text(o.motivo, 400),
      strengths: list(o.pontos_fortes),
      concerns: list(o.pontos_atencao),
    });
  }
  return picks;
}
