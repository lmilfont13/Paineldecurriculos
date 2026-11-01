import "server-only";

import { readEnv } from "@/lib/env";
import { findCompanyById } from "@/server/repositories/company.repository";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "qwen/qwen3.8-27b";

const CLAUDE_ENDPOINT = "https://api.anthropic.com/v1/messages";
const CLAUDE_DEFAULT_MODEL = "claude-haiku-5-5";

type GenerateParams = {
  system: string;
  prompt: string;
  maxTokens?: number;
  json?: boolean;
  /** Empresa dona da análise: define o modelo escolhido nas Configurações. */
  companyId?: string;
};

type Choice = { provider: "anthropic" | "groq"; model: string };

/** Modelo escolhido pela empresa; sem escolha, o padrão do sistema (Claude se houver chave, senão Groq). */
async function resolveChoice(companyId?: string): Promise<Choice> {
  const hasClaudeKey = Boolean(readEnv("ANTHROPIC_API_KEY"));
  const picked = companyId ? ((await findCompanyById(companyId))?.aiModel ?? null) : null;
  if (picked?.startsWith("claude-") && hasClaudeKey) return { provider: "anthropic", model: picked };
  if (picked?.startsWith("groq:")) return { provider: "groq", model: picked.slice(5) };
  if (hasClaudeKey && readEnv("AI_PROVIDER") !== "groq") {
    return { provider: "anthropic", model: readEnv("ANTHROPIC_MODEL") ?? CLAUDE_DEFAULT_MODEL };
  }
  return { provider: "groq", model: GROQ_MODEL };
}

/** Identificação do modelo gravada em cada nota (Application.aiModel). */
export async function aiModelId(companyId?: string): Promise<string> {
  const c = await resolveChoice(companyId);
  return `${c.provider === "anthropic" ? "anthropic" : "groq"}:${c.model}`;
}

async function callGroq(key: string, model: string, params: GenerateParams): Promise<Response> {
  return fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.prompt },
      ],
      max_tokens: params.maxTokens ?? 300,
      temperature: 0.2,
      ...(params.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
}

async function generateWithGroq(model: string, params: GenerateParams): Promise<string> {
  const key = readEnv("GROQ_API_KEY");
  if (!key) throw new Error("GROQ_API_KEY não configurada");

  // Até 3 tentativas com backoff para absorver picos de 429 (limite OTPM do Groq).
  // Somam menos que o maxDuration (60s) das páginas que chamam a IA.
  const delays = [12_000, 25_000];
  let res = await callGroq(key, model, params);

  for (const delay of delays) {
    if (res.status !== 429) break;
    await new Promise((r) => setTimeout(r, delay));
    res = await callGroq(key, model, params);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? "";
}

async function generateWithClaude(model: string, params: GenerateParams): Promise<string> {
  const key = readEnv("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ANTHROPIC_API_KEY não configurada");

  // A API do Claude não tem "modo JSON": o pedido vai explícito no system prompt.
  const system = params.json
    ? `${params.system}\n\nResponda somente com o JSON válido, sem texto antes ou depois.`
    : params.system;

  const res = await fetch(CLAUDE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: params.maxTokens ?? 300,
      temperature: 0.2,
      system,
      messages: [{ role: "user", content: params.prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  return (data.content ?? []).map((b) => (b.type === "text" ? (b.text ?? "") : "")).join("");
}

/**
 * Gera texto com a IA escolhida pela empresa (padrão: Claude quando há
 * ANTHROPIC_API_KEY, senão Groq). Se o Claude falhar, a Groq é a reserva.
 * (O nome "geminiGenerate" é histórico — o provedor mudou mais de uma vez.)
 */
export async function geminiGenerate(params: GenerateParams): Promise<string> {
  const choice = await resolveChoice(params.companyId);
  if (choice.provider === "groq") return generateWithGroq(choice.model, params);
  try {
    return await generateWithClaude(choice.model, params);
  } catch (error) {
    if (!readEnv("GROQ_API_KEY")) throw error;
    console.error("[ia] Claude falhou, usando a Groq como reserva:", error);
    return generateWithGroq(GROQ_MODEL, params);
  }
}
