/**
 * Rascunho de vaga sugerido a partir de uma pasta do banco de talentos.
 * Funções puras — testadas em job-draft.model.test.ts.
 */

export type JobDraft = {
  title: string;
  description: string;
  requirements: string;
  aiCriteria: string[];
  aiMinScore: number;
};

/** O que a IA recebe sobre a pasta: só perfis agregados, nada pessoal. */
export function buildFolderBrief(folder: {
  name: string;
  area: string | null;
  people: { aiProfile: string | null; aiLevel: string | null; jobTitle: string }[];
}): string {
  const count = (values: (string | null)[]) => {
    const map = new Map<string, number>();
    for (const v of values) if (v) map.set(v, (map.get(v) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([v, n]) => `${v} (${n})`);
  };
  return [
    `Pasta: ${folder.name}`,
    folder.area ? `Área: ${folder.area}` : "",
    `Candidatos guardados: ${folder.people.length}`,
    `Funções: ${count(folder.people.map((p) => p.aiProfile)).join(", ") || "não informado"}`,
    `Níveis: ${count(folder.people.map((p) => p.aiLevel)).join(", ") || "não informado"}`,
    `Vagas em que se inscreveram: ${count(folder.people.map((p) => p.jobTitle)).join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function text(value: unknown, max: number): string {
  return String(value ?? "").replace(/\r/g, "").trim().slice(0, max);
}

/**
 * Lê o rascunho devolvido pela IA. Garante título, descrição, de 3 a 6
 * critérios curtos e nota mínima entre 50 e 80; o resto cai no padrão.
 */
export function parseJobDraft(raw: string, fallbackTitle: string): JobDraft {
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as Record<string, unknown>;
  } catch {
    data = {};
  }
  const title = text(data.title, 90) || fallbackTitle;
  const description =
    text(data.description, 4000) ||
    `Vaga para ${fallbackTitle}. Revise e complete a descrição antes de publicar.`;
  const requirements = Array.isArray(data.requirements)
    ? data.requirements.map((r) => `• ${text(r, 200)}`).filter((r) => r.length > 3).join("\n")
    : text(data.requirements, 3000);
  const criteria = (Array.isArray(data.criteria) ? data.criteria : [])
    .map((c) => text(c, 80))
    .filter((c) => c.length >= 3);
  const unique = [...new Set(criteria)].slice(0, 6);
  const minRaw = Math.round(Number(data.minScore));
  return {
    title,
    description,
    requirements,
    aiCriteria: unique.length >= 3 ? unique : unique.concat([fallbackTitle]).slice(0, Math.max(1, unique.length + 1)),
    aiMinScore: Number.isFinite(minRaw) ? Math.min(80, Math.max(50, minRaw)) : 60,
  };
}
