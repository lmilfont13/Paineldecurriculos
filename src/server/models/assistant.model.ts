import { scrubText } from "@/server/models/shortlist.model";

/**
 * Assistente que responde perguntas do gestor olhando TODAS as candidaturas da
 * empresa (por exemplo: "tenho opções melhores para esta vaga?"). Cada pessoa
 * vai para a IA só com um rótulo (C1, C2...): sem nome, contato, idade ou foto
 * (regra 3). Quem lê a resposta vê os nomes de volta.
 */

export type AssistantRow = {
  id: string;
  name: string;
  jobId: string;
  jobTitle: string;
  status: string;
  aiScore: number | null;
  aiReasoning: string | null;
  aiProfile: string | null;
  aiArea: string | null;
  aiLevel: string | null;
  neighborhood: string | null;
  city: string | null;
  availability: string | null;
  salaryExpectation: string | null;
};

/** Quantas pessoas cabem num pedido (limite de tamanho do pedido à IA). */
export const ASSISTANT_MAX = 40;

/** Sem reprovados, das maiores notas para as menores (sem nota por último). */
export function pickForAssistant(rows: AssistantRow[], max = ASSISTANT_MAX): AssistantRow[] {
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

const STATUS_PT: Record<string, string> = {
  PENDING: "em triagem",
  SHORTLISTED: "passou da triagem",
  INTERVIEW: "em entrevista",
  APPROVED: "aprovado",
};

const SYSTEM = `Você é um assistente de RH que responde perguntas de um recrutador olhando as candidaturas da empresa.
Ignore nome, gênero, idade, foto e origem. Avalie só habilidades e experiência.
Cada pessoa é identificada por um rótulo (C1, C2...). Ao citar alguém, use sempre o rótulo.
Use somente os dados fornecidos; não invente. Se os dados não bastarem para responder, diga isso.
A "nota" é a que a pessoa recebeu na própria vaga: serve de referência, mas não é a nota para a vaga em foco quando ela se candidatou a outra.
Responda em português, direto, em até 10 linhas. Se a pergunta for sobre melhores opções, liste até 5 rótulos com o motivo em uma frase cada.
Você não decide nada: a decisão é do recrutador.`;

/** Monta o pedido; `labelToRef` volta do rótulo (C1...) para a candidatura e o nome. */
export function buildAssistantPrompt(
  job: { title: string; requirements: string | null; criteria: string[]; minScore: number } | null,
  rows: AssistantRow[],
  question: string
): { system: string; prompt: string; labelToRef: Record<string, { id: string; name: string }> } {
  const labelToRef: Record<string, { id: string; name: string }> = {};
  const blocks = rows.map((r, i) => {
    const label = `C${i + 1}`;
    labelToRef[label] = { id: r.id, name: r.name };
    const profile = [r.aiProfile, r.aiLevel, r.aiArea].filter(Boolean).join(" · ");
    const where = [r.neighborhood, r.city].filter(Boolean).join(", ");
    const parts = [
      `vaga: ${r.jobTitle}`,
      `etapa: ${STATUS_PT[r.status] ?? r.status}`,
      r.aiScore !== null ? `nota na vaga dela: ${r.aiScore}/100` : "sem nota",
      profile && `perfil: ${profile}`,
      where && `local: ${where}`,
      r.availability && `disponibilidade: ${r.availability}`,
      r.salaryExpectation && `pretensão: ${r.salaryExpectation}`,
    ].filter(Boolean);
    const reading = r.aiReasoning ? scrubText(r.aiReasoning, r.name).replace(/\s+/g, " ").trim().slice(0, 180) : "";
    return `${label} | ${parts.join(" | ")}${reading ? `\n   leitura: ${reading}` : ""}`;
  });

  const jobBlock = job
    ? [
        `Vaga em foco: ${job.title} (nota mínima ${job.minScore})`,
        job.requirements ? `Requisitos: ${job.requirements.slice(0, 600)}` : "",
        job.criteria.length > 0 ? `Critérios:\n${job.criteria.map((c) => `- ${c}`).join("\n")}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "Sem vaga em foco: considere todas as vagas da empresa.";

  const prompt = `${jobBlock}\n\nCandidaturas da empresa (${rows.length}):\n${blocks.join("\n")}\n\nPergunta do recrutador: ${question}`;
  return { system: SYSTEM, prompt, labelToRef };
}

/** Troca C1, C2... pelos nomes na resposta e devolve quem foi citado (sem repetir, na ordem). */
export function resolveLabels(
  text: string,
  labelToRef: Record<string, { id: string; name: string }>
): { text: string; mentioned: { id: string; name: string }[] } {
  const mentioned: { id: string; name: string }[] = [];
  const out = text.replace(/(?<![\p{L}\p{N}])C(\d{1,3})(?![\p{L}\p{N}])/gu, (match) => {
    const ref = labelToRef[match];
    if (!ref) return match;
    if (!mentioned.some((m) => m.id === ref.id)) mentioned.push(ref);
    return ref.name;
  });
  return { text: out, mentioned };
}
