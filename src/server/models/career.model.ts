/**
 * Análise de perfil pelo agente: em quais áreas a pessoa seria um bom
 * candidato, com nota estimada por área, e um resumo de onde ela seria bem
 * aproveitada. Funções puras — testadas em career.model.test.ts.
 *
 * Não é a nota de aderência de uma vaga (essa vem do prompt imutável da
 * triagem); é uma leitura geral do currículo para orientar o gestor.
 */

export type CareerArea = { area: string; score: number; why: string };
export type CareerProfile = {
  areas: CareerArea[];
  roles: string[];
  summary: string;
  analyzedAt: string;
};

function clean(value: unknown, max: number): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Lê a resposta da IA: 1 a 3 áreas (nota 0–100), até 4 funções e o resumo. */
export function parseCareer(raw: string, now = new Date()): CareerProfile | null {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "") as Record<string, unknown>;
  } catch {
    return null;
  }
  const areas = (Array.isArray(data.areas) ? data.areas : [])
    .map((a) => {
      const rec = (a ?? {}) as Record<string, unknown>;
      const score = Math.round(Number(rec.score));
      return {
        area: clean(rec.area, 40),
        score: Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : -1,
        why: clean(rec.why ?? rec.reason, 220),
      };
    })
    .filter((a) => a.area.length >= 3 && a.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const summary = clean(data.summary, 500);
  if (areas.length === 0 || !summary) return null;
  const roles = [
    ...new Set(
      (Array.isArray(data.roles) ? data.roles : []).map((r) => clean(r, 48)).filter((r) => r.length >= 3)
    ),
  ].slice(0, 4);
  return { areas, roles, summary, analyzedAt: now.toISOString() };
}

/** Valida o JSON salvo no banco antes de mostrar. */
export function readCareer(value: unknown): CareerProfile | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.areas) || typeof v.summary !== "string") return null;
  const areas = v.areas
    .filter((a): a is Record<string, unknown> => !!a && typeof a === "object")
    .map((a) => ({ area: String(a.area ?? ""), score: Number(a.score), why: String(a.why ?? "") }))
    .filter((a) => a.area && Number.isFinite(a.score));
  if (areas.length === 0) return null;
  return {
    areas,
    roles: Array.isArray(v.roles) ? v.roles.map(String) : [],
    summary: v.summary,
    analyzedAt: String(v.analyzedAt ?? ""),
  };
}

/** Texto para comparar o perfil com as vagas abertas (áreas + funções). */
export function careerKeywordsText(career: CareerProfile): string {
  return [...career.areas.map((a) => a.area), ...career.roles].join(" ");
}
