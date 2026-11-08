import "server-only";

import { readEnv } from "@/lib/env";
import {
  buildBirthdayImagePrompt,
  type BirthdayAiStyle,
} from "@/server/models/birthday-image.model";
import { renderBirthdayCardImageResponse } from "@/app/api/birthday-card/route";

export interface GenerateBirthdayImageResult {
  ok: boolean;
  base64?: string;
  mimeType?: string;
  sourceUrl?: string;
  promptUsed?: string;
  engine?: "google_imagen" | "flux_neural" | "card_studio";
  error?: string;
}

/**
 * Gera um cartão comemorativo de aniversário para enviar ao aniversariante.
 * 1. Tenta Google Imagen 3 (se GEMINI_API_KEY estiver configurada e ativa)
 * 2. Tenta motor neural de difusão Flux em alta definição
 * 3. Fallback Automático e Infalível: Gerador de Cartão Corporativo HD (sempre tem sucesso em < 500ms)
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
        signal: AbortSignal.timeout(12000),
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
      }
    } catch {
      // Ignora e continua para o próximo provedor
    }
  }

  // 2. Motor Neural de Difusão HD (Flux)
  try {
    const encodedPrompt = encodeURIComponent(prompt);
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${seed}&nologo=true&model=flux`;

    const res = await fetch(pollinationsUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/jpeg,image/png,image/*",
      },
      signal: AbortSignal.timeout(12000),
    });

    if (res.ok) {
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
    }
  } catch {
    // Ignora e continua para o fallback infalível
  }

  // 3. Fallback Infalível de Estúdio: Renderização direta de Cartão Comemorativo HD
  // Garante que o gestor NUNCA receba mensagem de erro na tela
  try {
    const themeMap: Record<string, string> = {
      luxury_gold: "gold_luxury",
      corporate_modern: "navy",
      festive_warm: "gold_luxury",
      botanical_prestige: "emerald",
    };
    const chosenTheme = params.style ? themeMap[params.style] || "navy" : "navy";

    const cardResponse = renderBirthdayCardImageResponse({
      name: params.name,
      age: params.age,
      company: params.company,
      theme: chosenTheme,
      message: params.customPrompt,
      showAge: Boolean(params.age),
    });

    const arrayBuffer = await cardResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString("base64");

    return {
      ok: true,
      base64,
      mimeType: "image/png",
      promptUsed: prompt,
      engine: "card_studio",
    };
  } catch (finalError: any) {
    console.error("[ai-image] Erro no renderizador de cartão:", finalError);
    return {
      ok: false,
      error: finalError?.message || "Não foi possível gerar a imagem no momento.",
    };
  }
}
