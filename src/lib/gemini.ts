import "server-only";

import { readEnv } from "@/lib/env";

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "qwen/qwen3.8-27b";

/** Identificação do modelo gravada em cada nota (Application.aiModel). */
export const AI_MODEL_ID = `groq:${MODEL}`;

async function callGroq(
  key: string,
  params: { system: string; prompt: string; maxTokens?: number; json?: boolean }
): Promise<Response> {
  return fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODEL,
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

export async function geminiGenerate(params: {
  system: string;
  prompt: string;
  maxTokens?: number;
  json?: boolean;
}): Promise<string> {
  const key = readEnv("GROQ_API_KEY");
  if (!key) throw new Error("GROQ_API_KEY não configurada");

  // Até 3 tentativas com backoff para absorver picos de 429 (limite OTPM do Groq).
  // Somam menos que o maxDuration (60s) das páginas que chamam a IA.
  const delays = [12_000, 25_000];
  let res = await callGroq(key, params);

  for (const delay of delays) {
    if (res.status !== 429) break;
    await new Promise((r) => setTimeout(r, delay));
    res = await callGroq(key, params);
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
