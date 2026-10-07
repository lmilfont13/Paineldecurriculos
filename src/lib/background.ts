import "server-only";

import { after } from "next/server";

/**
 * Agenda trabalho para depois da resposta sem que a Vercel o congele.
 *
 * Um `void promessa()` solto morre quando a função serverless responde: a
 * instância é congelada e o e-mail/notificação/análise simplesmente não
 * acontece. `after()` mantém a função viva até o callback terminar (dentro do
 * maxDuration da rota). Fora de um request (scripts, testes) `after()` lança
 * erro — aí rodamos direto.
 *
 * Erros são só registrados: trabalho em background nunca derruba o fluxo
 * principal (regra 2).
 */
export function runInBackground(
  label: string,
  task: () => Promise<unknown>
): void {
  const wrapped = async () => {
    try {
      await task();
    } catch (error) {
      console.error(`[background] ${label}:`, error);
    }
  };
  try {
    after(wrapped);
  } catch {
    void wrapped();
  }
}
