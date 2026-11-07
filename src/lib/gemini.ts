import "server-only";

import { readEnv } from "@/lib/env";
import { findCompanyById } from "@/server/repositories/company.repository";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "qwen/qwen3.8-27b";
const GROQ_TEXT_FALLBACK_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"] as const;

const CLAUDE_ENDPOINT = "https://api.anthropic.com/v1/messages";
const CLAUDE_DEFAULT_MODEL = "claude-haiku-5-5";

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export type VisionAttachment = {
  base64: string;
  /** "image/jpeg" | "image/png" | "image/webp" | "application/pdf" */
  mime: string;
};

type GenerateParams = {
  system: string;
  prompt: string;
  maxTokens?: number;
  json?: boolean;
  /** Empresa dona da análise: define o modelo escolhido nas Configurações. */
  companyId?: string;
  /**
   * Força um modelo ("claude-…" ou "groq:…"), ignorando a escolha da empresa e
   * SEM a reserva automática na Groq — usado no teste de modelos, para nunca
   * comparar um modelo achando que é outro.
   */
  model?: string;
  /**
   * Imagem em base64 para enviar junto com o prompt (visão). Currículos em
   * foto usam isso para que a IA leia o conteúdo direto da imagem.
   */
  imageBase64?: string;
  /** MIME type da imagem (ex.: "image/jpeg"). Obrigatório se imageBase64 vier. */
  imageMime?: string;
  /**
   * Múltiplas imagens (ex.: fatias de um print longo ou páginas escaneadas de
   * PDF) ou documento PDF em base64 para leitura visual (OCR).
   */
  attachments?: VisionAttachment[];
};

function resolveAttachments(params: GenerateParams): VisionAttachment[] {
  const list: VisionAttachment[] = [];
  if (params.imageBase64 && params.imageMime) {
    list.push({ base64: params.imageBase64, mime: params.imageMime });
  }
  if (params.attachments?.length) {
    list.push(...params.attachments);
  }
  return list;
}

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

/** Modelo que a empresa usa hoje, no formato das opções ("claude-…" ou "groq:…"). */
export async function currentModelOption(companyId?: string): Promise<string> {
  const c = await resolveChoice(companyId);
  return c.provider === "groq" ? `groq:${c.model}` : c.model;
}

/** Identificação do modelo gravada em cada nota (Application.aiModel). */
export async function aiModelId(companyId?: string): Promise<string> {
  const c = await resolveChoice(companyId);
  return `${c.provider === "anthropic" ? "anthropic" : "groq"}:${c.model}`;
}

async function callGroq(
  key: string,
  model: string,
  params: GenerateParams,
  mergeSystemForVision = false
): Promise<Response> {
  const attachments = resolveAttachments(params);
  // qwen/qwen3.8-27b na Groq aceita até 3 imagens por requisição via image_url.
  const imageAttachments = attachments.filter((a) => a.mime.startsWith("image/")).slice(0, 3);

  const hasVision = imageAttachments.length > 0;
  const textPrompt =
    hasVision && mergeSystemForVision && params.system
      ? `${params.system}\n\n${params.prompt}`
      : params.prompt;

  // Groq (OpenAI-compatible): visão via content array com image_url (base64 data URI).
  const userContent: unknown = hasVision
    ? [
        ...imageAttachments.map((att) => ({
          type: "image_url",
          image_url: { url: `data:${att.mime};base64,${att.base64}` },
        })),
        { type: "text", text: textPrompt },
      ]
    : params.prompt;

  const messages =
    hasVision && mergeSystemForVision
      ? [{ role: "user", content: userContent }]
      : [
          { role: "system", content: params.system },
          { role: "user", content: userContent },
        ];

  return fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: params.maxTokens ?? 300,
      temperature: 0.2,
      ...(params.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
}

async function generateWithGroq(model: string, params: GenerateParams): Promise<string> {
  const attachments = resolveAttachments(params);
  const imageAttachments = attachments.filter((a) => a.mime.startsWith("image/"));

  // NUNCA envie um prompt de OCR sem imagem para a Groq: se o anexo era um PDF
  // bruto (sem imagens raster extraídas), a Groq não lê application/pdf.
  // Sem essa trava, o modelo recebia só o texto "Extraia o texto completo deste
  // currículo" sem imagem e inventava um currículo fictício.
  if (attachments.length > 0 && imageAttachments.length === 0) {
    if (readEnv("GEMINI_API_KEY")) {
      return generateWithGemini(params);
    }
    if (readEnv("ANTHROPIC_API_KEY")) {
      return generateWithClaude(CLAUDE_DEFAULT_MODEL, params);
    }
    throw new Error("Groq requer imagem (image/*) para leitura visual; PDF bruto não suportado.");
  }

  const key = readEnv("GROQ_API_KEY");
  if (!key) {
    if (!params.model && readEnv("GEMINI_API_KEY")) {
      return generateWithGemini(params);
    }
    if (!params.model && readEnv("ANTHROPIC_API_KEY")) {
      return generateWithClaude(CLAUDE_DEFAULT_MODEL, params);
    }
    throw new Error("GROQ_API_KEY não configurada");
  }

  // Tentativas rápidas com backoff curto para não estourar o maxDuration (60s) da Vercel.
  const delays = [2_000, 4_000];
  let res = await callGroq(key, model, params);

  if (imageAttachments.length > 0 && (res.status === 400 || res.status === 422)) {
    res = await callGroq(key, model, params, true);
  }

  for (const delay of delays) {
    if (res.status !== 429 && res.status < 500) break;
    await new Promise((r) => setTimeout(r, delay));
    res = await callGroq(key, model, params);
  }

  // Se o modelo principal da Groq bateu rate-limit (429) ou erro em chamada de texto
  // (e não estamos forçando um modelo específico no comparador), tenta os modelos
  // secundários da Groq que possuem cotas independentes de TPM/RPM.
  if (!res.ok && !params.model && imageAttachments.length === 0) {
    for (const fallbackModel of GROQ_TEXT_FALLBACK_MODELS) {
      if (fallbackModel === model) continue;
      const fallbackRes = await callGroq(key, fallbackModel, params);
      if (fallbackRes.ok) {
        res = fallbackRes;
        break;
      }
    }
  }

  if (!res.ok) {
    const body = await res.text();
    if (!params.model) {
      if (readEnv("GEMINI_API_KEY")) {
        try {
          console.error("[ia] Groq falhou, usando Gemini como reserva:", body.slice(0, 200));
          return await generateWithGemini(params);
        } catch (geminiErr) {
          console.error("[ia] Gemini reserva também falhou:", geminiErr);
        }
      }
      if (readEnv("ANTHROPIC_API_KEY")) {
        try {
          console.error("[ia] Groq falhou, usando Claude como reserva:", body.slice(0, 200));
          return await generateWithClaude(CLAUDE_DEFAULT_MODEL, params);
        } catch (claudeErr) {
          console.error("[ia] Claude reserva também falhou:", claudeErr);
        }
      }
    }
    throw new Error(`Groq ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? "";
}

/**
 * Reserva multimodal com Google Gemini (gemini-2.5-flash) para leitura visual
 * de imagens e PDFs escaneados quando os outros provedores falharem.
 */
async function generateWithGemini(params: GenerateParams): Promise<string> {
  const key = readEnv("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY não configurada");

  const attachments = resolveAttachments(params);
  const parts: unknown[] = [
    ...attachments.map((att) => ({
      inline_data: {
        mime_type: att.mime,
        data: att.base64,
      },
    })),
    { text: params.prompt },
  ];

  const res = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: params.system }] },
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: params.maxTokens ?? 1000,
        ...(params.json ? { responseMimeType: "application/json" } : {}),
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return (
    data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("") ?? ""
  );
}

/**
 * Modelos Claude que recusam `temperature` ("deprecated for this model"). Os
 * mais novos recusam; os mais antigos aceitam. Aprendido na primeira recusa e
 * lembrado enquanto a função estiver viva.
 */
const CLAUDE_NO_TEMPERATURE = new Set<string>();

function isTemperatureRejection(status: number, body: string): boolean {
  return status === 400 && /temperature/i.test(body);
}

async function generateWithClaude(model: string, params: GenerateParams): Promise<string> {
  const key = readEnv("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ANTHROPIC_API_KEY não configurada");

  // A API do Claude não tem "modo JSON": o pedido vai explícito no system prompt.
  const system = params.json
    ? `${params.system}\n\nResponda somente com o JSON válido, sem texto antes ou depois.`
    : params.system;

  const attachments = resolveAttachments(params);

  // Conteúdo do usuário: texto simples ou [imagens/documentos + texto] quando há visão.
  const userContent: unknown =
    attachments.length > 0
      ? [
          ...attachments.map((att) =>
            att.mime === "application/pdf"
              ? {
                  type: "document",
                  source: {
                    type: "base64",
                    media_type: "application/pdf",
                    data: att.base64,
                  },
                }
              : {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: att.mime,
                    data: att.base64,
                  },
                }
          ),
          { type: "text", text: params.prompt },
        ]
      : params.prompt;

  const call = (withTemperature: boolean) =>
    fetch(CLAUDE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: params.maxTokens ?? 300,
        ...(withTemperature ? { temperature: 0.2 } : {}),
        system,
        messages: [{ role: "user", content: userContent }],
      }),
    });

  // Decide pela chamada que FOI feita: em paralelo, outra chamada pode já ter
  // marcado o modelo enquanto esta ainda saía com temperature.
  const sentTemperature = !CLAUDE_NO_TEMPERATURE.has(model);
  let res = await call(sentTemperature);
  if (!res.ok) {
    const body = await res.text();
    if (sentTemperature && isTemperatureRejection(res.status, body)) {
      // Modelo novo: repete sem temperature e não manda mais para ele.
      CLAUDE_NO_TEMPERATURE.add(model);
      res = await call(false);
      if (!res.ok) throw new Error(`Claude ${res.status}: ${(await res.text()).slice(0, 300)}`);
    } else {
      throw new Error(`Claude ${res.status}: ${body.slice(0, 300)}`);
    }
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
  return (await generateWithModelInfo(params)).text;
}

/**
 * Como geminiGenerate, mas diz qual modelo DE FATO respondeu ("anthropic:…" ou
 * "groq:…") — quando o Claude falha e a Groq assume, a nota precisa registrar
 * a Groq, não o modelo escolhido.
 */
export async function generateWithModelInfo(
  params: GenerateParams
): Promise<{ text: string; modelUsed: string }> {
  if (params.model) {
    if (params.model.startsWith("groq:")) {
      return { text: await generateWithGroq(params.model.slice(5), params), modelUsed: params.model };
    }
    if (params.model.startsWith("claude-")) {
      return { text: await generateWithClaude(params.model, params), modelUsed: `anthropic:${params.model}` };
    }
    throw new Error(`Modelo desconhecido: ${params.model}`);
  }
  const choice = await resolveChoice(params.companyId);
  if (choice.provider === "groq") {
    return { text: await generateWithGroq(choice.model, params), modelUsed: `groq:${choice.model}` };
  }
  try {
    return { text: await generateWithClaude(choice.model, params), modelUsed: `anthropic:${choice.model}` };
  } catch (error) {
    if (!readEnv("GROQ_API_KEY") && !readEnv("GEMINI_API_KEY")) throw error;
    console.error("[ia] Claude falhou, usando a Groq como reserva:", error);
    return { text: await generateWithGroq(GROQ_MODEL, params), modelUsed: `groq:${GROQ_MODEL}` };
  }
}
