import { readChecklist } from "@/server/models/ai.model";
import { criteriaCoverage, decisionIndex } from "@/server/models/report.model";
import { scrubText, type ShortlistInput } from "@/server/models/shortlist.model";

/** Candidatura na comparação: o que a IA lê, mais a vaga de cada uma (podem ser vagas diferentes). */
export type ComparisonCandidate = ShortlistInput & {
  jobTitle: string;
  jobCode: string | null;
  jobRequirements: string | null;
  jobCriteria: string[];
  aiMinScore: number;
};

export type ComparisonResult = {
  /** Candidatura recomendada; null quando a IA não escolhe (empate técnico) ou o rótulo não existe. */
  recommendedId: string | null;
  confidence: "alta" | "media" | "baixa";
  summary: string;
  reasons: string[];
  perCandidate: { id: string; strengths: string[]; concerns: string[]; whyNot: string }[];
  /** O que vale confirmar na entrevista antes de decidir. */
  checkNext: string;
};

const RESUME_EXCERPT = 1200;

const SYSTEM = `Você é um especialista em RH que ajuda um gestor a escolher entre 2 ou 3 candidatos.
Ignore nome, gênero, idade, foto e origem. Avalie só habilidades e experiência, comparando os candidatos entre si e com a vaga de cada um.
Use apenas o material fornecido; não invente. Os candidatos são identificados por rótulos (C1, C2, C3).
No texto livre, cite os candidatos só pelo rótulo, sem artigo antes e sem inventar nomes (escreva "C2 supera C1", não "o C2").
Escolha UM candidato. Se a diferença for pequena demais para decidir, diga "empate". Seja direto e concreto.
Retorne apenas JSON neste formato:
{ "recomendado": "C2" ou "empate", "confianca": "alta" | "media" | "baixa", "resumo": "1-2 frases com a conclusão",
  "motivos": ["até 4 motivos curtos e concretos"],
  "por_candidato": [ { "candidato": "C1", "pontos_fortes": ["até 3"], "pontos_atencao": ["até 3"], "por_que_nao": "se não for o recomendado, em 1 frase" } ],
  "confirmar_na_entrevista": "1 frase sobre o que checar antes de decidir" }`;

export function buildComparisonPrompt(candidates: ComparisonCandidate[]): {
  system: string;
  prompt: string;
  labelToId: Record<string, string>;
} {
  const labelToId: Record<string, string> = {};
  const blocks = candidates.map((c, i) => {
    const label = `C${i + 1}`;
    labelToId[label] = c.id;
    const lines = [`### ${label}`];
    lines.push(`Vaga: ${c.jobTitle}${c.jobCode ? ` #${c.jobCode}` : ""} (corte de aprovação: ${c.aiMinScore} pontos)`);
    if (c.jobRequirements) lines.push(`Requisitos da vaga: ${c.jobRequirements.replace(/\s+/g, " ").trim()}`);
    if (c.jobCriteria.length > 0) lines.push(`Critérios da vaga: ${c.jobCriteria.join("; ")}`);
    if (c.aiScore !== null) lines.push(`Nota da triagem: ${c.aiScore}/100`);
    const profile = [c.aiProfile, c.aiArea, c.aiLevel].filter(Boolean).join(" · ");
    if (profile) lines.push(`Perfil: ${profile}`);
    if (c.aiReasoning) lines.push(`Leitura da triagem: ${scrubText(c.aiReasoning, c.name ?? "")}`);
    const checklist = readChecklist(c.aiChecklist);
    if (checklist.length > 0) {
      lines.push(
        "Critérios avaliados: " +
          checklist
            .map((k) => `${k.criterion} = ${k.met}${k.evidence ? ` (${scrubText(k.evidence, c.name ?? "")})` : ""}`)
            .join("; ")
      );
    }
    const excerpt = scrubText(c.resumeText ?? "", c.name ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, RESUME_EXCERPT);
    if (excerpt) lines.push(`Currículo (trecho): ${excerpt}`);
    return lines.join("\n");
  });
  return {
    system: SYSTEM,
    prompt: `Compare os candidatos abaixo e indique qual escolher.\n\n${blocks.join("\n\n")}`,
    labelToId,
  };
}

const text = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
const list = (v: unknown, n: number) =>
  Array.isArray(v) ? v.map((x) => text(x, 140)).filter(Boolean).slice(0, n) : [];

/** Lê a resposta da IA; null se não der para entender. Rótulo desconhecido ou "empate" = sem recomendação. */
export function parseComparison(
  raw: string,
  labelToId: Record<string, string>
): ComparisonResult | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  const summary = text(data.resumo, 500);
  if (!summary) return null;

  const confidence = ["alta", "media", "baixa"].includes(String(data.confianca))
    ? (data.confianca as ComparisonResult["confidence"])
    : "media";
  const perCandidate = (Array.isArray(data.por_candidato) ? data.por_candidato : []).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const o = item as Record<string, unknown>;
    const id = labelToId[text(o.candidato, 10).toUpperCase()];
    if (!id) return [];
    return [
      {
        id,
        strengths: list(o.pontos_fortes, 3),
        concerns: list(o.pontos_atencao, 3),
        whyNot: text(o.por_que_nao, 220),
      },
    ];
  });

  return {
    recommendedId: labelToId[text(data.recomendado, 10).toUpperCase()] ?? null,
    confidence,
    summary,
    reasons: list(data.motivos, 4),
    perCandidate,
    checkNext: text(data.confirmar_na_entrevista, 260),
  };
}

/** Sugestão só pelos números (usada quando a IA falha): atende o corte primeiro, depois o índice de decisão. */
export function computedRecommendation(candidates: ComparisonCandidate[]): {
  recommendedId: string | null;
  margin: number | null;
} {
  const ranked = candidates
    .filter((c) => c.aiScore !== null)
    .map((c) => ({
      id: c.id,
      meets: (c.aiScore as number) >= c.aiMinScore ? 1 : 0,
      index: decisionIndex(c.aiScore, criteriaCoverage(readChecklist(c.aiChecklist))) as number,
      score: c.aiScore as number,
    }))
    .sort((a, b) => b.meets - a.meets || b.index - a.index || b.score - a.score);
  if (ranked.length === 0) return { recommendedId: null, margin: null };
  return {
    recommendedId: ranked[0].id,
    margin: ranked[1] ? Math.round((ranked[0].index - ranked[1].index) * 100) / 100 : null,
  };
}

/**
 * Troca os rótulos internos (C1, C2...) pelos nomes reais no texto que a IA escreveu,
 * para o gestor ler "Ana Paula" e não "C3". O artigo que abre a frase ("O C3 é...")
 * cai junto; no meio da frase ele fica, porque pode ser preposição ("perguntar a C1").
 */
export function labelsToNames(text: string, labelToName: Record<string, string>): string {
  return text
    .replace(/(^|[.!?]\s+)[OA]s?\s+(C\d+)\b/g, (match, lead: string, label: string) =>
      labelToName[label] ? `${lead}${labelToName[label]}` : match
    )
    .replace(/\b(C\d+)\b/g, (match, label: string) => labelToName[label] ?? match);
}
