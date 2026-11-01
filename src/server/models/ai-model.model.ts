/** Modelos de IA que o gestor pode escolher para analisar candidatos. */
export type AiModelOption = {
  id: string;
  provider: "anthropic" | "groq";
  label: string;
  hint: string;
};

export const AI_MODEL_OPTIONS: AiModelOption[] = [
  {
    id: "claude-haiku-5-5",
    provider: "anthropic",
    label: "Claude Haiku 5.5",
    hint: "Rápido e econômico. Bom para o dia a dia e muitos currículos.",
  },
  {
    id: "claude-sonnet-5-5",
    provider: "anthropic",
    label: "Claude Sonnet 5.5",
    hint: "Equilíbrio entre qualidade e custo. Análises mais cuidadosas.",
  },
  {
    id: "claude-opus-5-5",
    provider: "anthropic",
    label: "Claude Opus 5.5",
    hint: "O mais preciso. Mais lento e mais caro; use em vagas importantes.",
  },
  {
    id: "groq:qwen/qwen3.8-27b",
    provider: "groq",
    label: "Groq · Qwen 3.8",
    hint: "Alternativa gratuita, com limite de uso por minuto.",
  },
];

/** Escolha válida ou null (= padrão do sistema). Ignora valores desconhecidos. */
export function parseAiModelChoice(value: unknown): string | null {
  return typeof value === "string" && AI_MODEL_OPTIONS.some((o) => o.id === value) ? value : null;
}
