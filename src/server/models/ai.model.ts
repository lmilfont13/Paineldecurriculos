/**
 * Contrato da análise de IA: material do candidato e checklist por critério.
 * Funções puras (sem I/O) — testadas em ai.model.test.ts.
 */

export type ChecklistMet = "sim" | "parcial" | "não";
export type ChecklistItem = {
  criterion: string;
  met: ChecklistMet;
  evidence: string;
};

/** Tipos de campo que não viram texto para a IA. */
const SKIPPED_FIELD_TYPES = new Set(["FILE_UPLOAD", "DATE"]);

/**
 * Respostas do formulário como texto para a IA. Pula anexos e datas (data de
 * nascimento, por exemplo, não deve pesar: a IA ignora idade — regra 3).
 */
/**
 * Perguntas que tocam idade, sexo, família etc. podem existir por exigência
 * legal (ex.: "Tem 18 anos ou mais?"), mas a resposta não vai para a IA
 * (regra 3): o gestor confere, a nota não.
 */
const SENSITIVE_LABEL =
  /\b(idade|anos ou mais|maior de idade|nascimento|sexo|g[eê]nero|estado civil|filhos|religi|ra[cç]a|etnia|defici[eê]ncia|gravid)/i;

export function isSensitiveQuestion(label: string): boolean {
  return SENSITIVE_LABEL.test(label);
}

export function buildAnswersText(
  answers: { value: string; field: { label: string; type: string } }[]
): string {
  return answers
    .filter((a) => !SKIPPED_FIELD_TYPES.has(a.field.type))
    .filter((a) => !isSensitiveQuestion(a.field.label))
    .map((a) => ({ label: a.field.label.trim(), value: a.value.trim() }))
    .filter((a) => a.label && a.value)
    .map((a) => `${a.label}: ${a.value}`)
    .join("\n");
}

/** Há material suficiente para analisar? (currículo ou respostas) */
export function hasMaterial(resumeText: string, answersText: string): boolean {
  return resumeText.trim().length + answersText.trim().length >= 40;
}

const MET_VALUES: ChecklistMet[] = ["sim", "parcial", "não"];

function normalizeMet(value: unknown): ChecklistMet {
  const v = String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
  if (v === "sim" || v === "yes" || v === "atende") return "sim";
  if (v === "parcial" || v === "partial" || v === "parcialmente") return "parcial";
  return "não";
}

/**
 * Lê a resposta da IA para o checklist. Mantém só os critérios da vaga, na
 * ordem da vaga; critério sem resposta vira "não" com evidência vazia.
 */
export function parseChecklist(raw: string, criteria: string[]): ChecklistItem[] {
  let items: unknown[] = [];
  try {
    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as {
      criteria?: unknown;
    };
    if (Array.isArray(parsed.criteria)) items = parsed.criteria;
  } catch {
    items = [];
  }

  const byName = new Map<string, { met: ChecklistMet; evidence: string }>();
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const name = String(rec.criterion ?? "").trim().toLowerCase();
    if (!name) continue;
    byName.set(name, {
      met: normalizeMet(rec.met),
      evidence: String(rec.evidence ?? "").trim().slice(0, 200),
    });
  }

  return criteria.map((criterion) => {
    const hit = byName.get(criterion.trim().toLowerCase());
    return {
      criterion,
      met: hit?.met ?? "não",
      evidence: hit?.evidence ?? "",
    };
  });
}

/** Valida o JSON salvo no banco antes de mostrar na tela. */
export function readChecklist(value: unknown): ChecklistItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
    .map((v) => ({
      criterion: String(v.criterion ?? ""),
      met: MET_VALUES.includes(v.met as ChecklistMet) ? (v.met as ChecklistMet) : "não",
      evidence: String(v.evidence ?? ""),
    }))
    .filter((v) => v.criterion);
}

/**
 * Perfil profissional resumido pela IA (ex.: "Motorista e entregador"), usado
 * para sugerir o nome da pasta no banco de talentos. Só área/função: corta
 * aspas, pontuação final e qualquer coisa longa demais.
 */
export function parseProfile(raw: string): string | null {
  let value: unknown;
  try {
    value = (JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as { profile?: unknown }).profile;
  } catch {
    return null;
  }
  const text = String(value ?? "")
    .replace(/["“”'`]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.;:,!]+$/, "")
    .trim();
  if (text.length < 3 || text.length > 48) return null;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
