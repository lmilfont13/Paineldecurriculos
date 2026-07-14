import "server-only";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
// flash-lite: rápido, barato e no free tier do Gemini
const MODEL = "gemini-flash-lite-latest";

/**
 * Chamada mínima ao Gemini (generateContent) via REST — sem SDK.
 * `system` é a instrução fixa; `prompt` é o conteúdo do usuário.
 * Retorna o texto (JSON quando `json` é true).
 */
export async function geminiGenerate(params: {
  system: string;
  prompt: string;
  maxTokens?: number;
  json?: boolean;
}): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY não configurada");

  const res = await fetch(
    `${ENDPOINT}/${MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: params.system }] },
        contents: [{ parts: [{ text: params.prompt }] }],
        generationConfig: {
          maxOutputTokens: params.maxTokens ?? 300,
          ...(params.json ? { responseMimeType: "application/json" } : {}),
        },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}
