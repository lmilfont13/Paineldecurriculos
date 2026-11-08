import "server-only";

import { readEnv } from "@/lib/env";
import {
  buildBirthdayImagePrompt,
  type BirthdayAiStyle,
} from "@/server/models/birthday-image.model";

export interface GenerateBirthdayImageResult {
  ok: boolean;
  base64?: string;
  mimeType?: string;
  sourceUrl?: string;
  promptUsed?: string;
  engine?: "google_imagen" | "flux_neural";
  error?: string;
}

/**
 * Gera um cartão comemorativo de aniversário por IA para enviar ao aniversariante.
 * Prioriza o modelo oficial Google Imagen 3 (imagen-3.0-generate-002) via Google Gemini API
 * ou o motor neural de difusão Flux em alta definição 1024x1024.
 */
export async function generateBirthdayAiImage(params: {
  name: string;
  age?: number;
  company?: string;
  style?: BirthdayAiStyle;
  customPrompt?: string;
  seed?: number;
}): Promise<GenerateBirthdayImageResult> {
  const prompt = buildBirthdayImagePrompt(params);
  const seed = params.seed ?? Math.floor(Math.random() * 1000000);

  // 1. Google Imagen 3 via Google Gemini API (se GEMINI_API_KEY estiver configurada)
  const geminiKey = readEnv("GEMINI_API_KEY");
  if (geminiKey) {
    try {
      const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${encodeURIComponent(
        geminiKey
      )}`;

      const imagenRes = await fetch(imagenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: "1:1",
            outputOptions: {
              mimeType: "image/jpeg",
            },
          },
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (imagenRes.ok) {
        const data = await imagenRes.json();
        const base64Bytes = data?.predictions?.[0]?.bytesBase64Encoded;
        const mimeType = data?.predictions?.[0]?.mimeType || "image/jpeg";

        if (base64Bytes) {
          return {
            ok: true,
            base64: base64Bytes,
            mimeType,
            promptUsed: prompt,
            engine: "google_imagen",
          };
        }
      } else {
        const errorBody = await imagenRes.text().catch(() => "");
        console.warn(`[ai-image] Google Imagen retornou HTTP ${imagenRes.status}:`, errorBody.slice(0, 200));
      }
    } catch (e) {
      console.warn("[ai-image] Google Imagen indisponível, usando fallback neural de difusão:", e);
    }
  }

  // 2. Motor Neural de Difusão HD (Flux)
  try {
    const encodedPrompt = encodeURIComponent(prompt);
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${seed}&nologo=true&model=flux`;

    const res = await fetch(pollinationsUrl, {
      method: "GET",
      headers: {
        Accept: "image/jpeg,image/png,image/*",
      },
      signal: AbortSignal.timeout(25000),
    });

    if (!res.ok) {
      throw new Error(`Falha no motor de imagem (HTTP ${res.status})`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = res.headers.get("content-type") || "image/jpeg";
    const base64 = buffer.toString("base64");

    return {
      ok: true,
      base64,
      mimeType,
      sourceUrl: pollinationsUrl,
      promptUsed: prompt,
      engine: "flux_neural",
    };
  } catch (error: any) {
    console.error("[ai-image] Erro ao gerar cartão de aniversário por IA:", error);
    return {
      ok: false,
      error: error?.message || "Não foi possível gerar o cartão comemorativo com IA neste momento.",
    };
  }
}
