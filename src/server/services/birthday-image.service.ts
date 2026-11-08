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
  error?: string;
}

/**
 * Gera uma imagem comemorativa profissional hiper-realista por Inteligência Artificial.
 * Prioriza Gemini (Nano Banana / Imagen) se a chave estiver configurada,
 * ou o motor neural de difusão Flux / SDXL em alta definição.
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

  // 1. Tentativa via Gemini Interactions API (se GEMINI_API_KEY estiver configurada)
  const geminiKey = readEnv("GEMINI_API_KEY");
  if (geminiKey) {
    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/interactions?key=${encodeURIComponent(
          geminiKey
        )}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gemini-nano-banana-2.1",
            input: [{ type: "text", text: prompt }],
          }),
        }
      );

      if (geminiRes.ok) {
        const geminiData = await geminiRes.json();
        const outputImage = geminiData?.output_image;
        if (outputImage?.data) {
          return {
            ok: true,
            base64: outputImage.data,
            mimeType: outputImage.mime_type || "image/png",
            promptUsed: prompt,
          };
        }
      }
    } catch (e) {
      console.warn("[ai-image] Gemini image generation indisponível, usando motor de difusão Flux:", e);
    }
  }

  // 2. Motor de Difusão Fotográfica de Alta Definição (Flux / SDXL)
  try {
    const encodedPrompt = encodeURIComponent(prompt);
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${seed}&nologo=true&model=flux`;

    const res = await fetch(pollinationsUrl, {
      method: "GET",
      headers: {
        Accept: "image/jpeg,image/png,image/*",
      },
      // Timeout seguro de 25s
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
    };
  } catch (error: any) {
    console.error("[ai-image] Erro ao gerar imagem profissional com IA:", error);
    return {
      ok: false,
      error: error?.message || "Não foi possível gerar a imagem com IA neste momento.",
    };
  }
}

