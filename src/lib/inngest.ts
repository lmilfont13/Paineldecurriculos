import { Inngest } from "inngest";

import { readEnv } from "@/lib/env";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Em produção o Inngest só funciona com as duas chaves:
 * - INNGEST_EVENT_KEY   → enviar eventos (inngest.send)
 * - INNGEST_SIGNING_KEY → o Inngest chamar /api/inngest (assinatura)
 * Pegue as duas em Inngest → Manage, cadastre na Vercel (Production) e
 * sincronize o app com https://<domínio>/api/inngest.
 *
 * Sem elas, `inngestConfigured` é false e quem enfileira trabalho roda o
 * fallback em `after()` (src/lib/background.ts) em vez de perder o evento.
 */
const eventKey = readEnv("INNGEST_EVENT_KEY");
const signingKey = readEnv("INNGEST_SIGNING_KEY");

export const inngestConfigured =
  !isProduction || (Boolean(eventKey) && Boolean(signingKey));

if (isProduction && !inngestConfigured) {
  console.warn(
    "[inngest] INNGEST_EVENT_KEY/INNGEST_SIGNING_KEY ausentes em produção — " +
      "jobs rodam pelo fallback em after()."
  );
}

/**
 * Eventos: "application/submitted" → { applicationId: string }
 *
 * Em desenvolvimento os eventos vão para o Inngest Dev Server local
 * (`npx inngest-cli dev`).
 */
export const inngest = new Inngest({
  id: "triagem",
  isDev: !isProduction,
  // Passadas já sem "\r\n" (ver lib/env.ts); sem isso o SDK lê o valor cru.
  ...(eventKey ? { eventKey } : {}),
  ...(signingKey ? { signingKey } : {}),
});

/**
 * Envia um evento ao Inngest. Retorna false se o Inngest não estiver
 * configurado ou se o envio falhar (chave inválida, rede) — aí quem chamou
 * deve rodar o trabalho por outro caminho.
 */
export async function trySendEvent(
  event: Parameters<typeof inngest.send>[0]
): Promise<boolean> {
  if (!inngestConfigured) return false;
  try {
    await inngest.send(event);
    return true;
  } catch (error) {
    console.error("[inngest] Falha ao enviar evento:", error);
    return false;
  }
}
