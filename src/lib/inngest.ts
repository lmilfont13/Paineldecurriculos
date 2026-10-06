import { Inngest } from "inngest";

/**
 * Eventos: "application/submitted" → { applicationId: string }
 *
 * Sem INNGEST_EVENT_KEY (desenvolvimento), roda em modo dev: os eventos vão
 * para o Inngest Dev Server local (`npx inngest-cli dev`). Em produção,
 * basta definir INNGEST_EVENT_KEY e INNGEST_SIGNING_KEY.
 */
export const inngest = new Inngest({
  id: "triagem",
  isDev: process.env.NODE_ENV !== "production",
});
