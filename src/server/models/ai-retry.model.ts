/**
 * Regras da reanálise automática da IA (sem I/O).
 *
 * As telas do gestor reenfileiram sozinhas candidaturas que ficaram sem
 * leitura. Sem teto, um arquivo que nunca vai ser lido (PDF vazio ou
 * corrompido) volta para a fila a cada visita. Em novembro/2026, 3 PDFs
 * vazios geraram 232 execuções em quatro dias.
 */

/** Máximo de execuções da triagem por candidatura dentro da janela. */
export const AUTO_RETRY_MAX_RUNS = 3;

/** Janela em que as execuções são contadas. */
export const AUTO_RETRY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Erro passageiro: limite de uso da IA, rede, tempo esgotado. Vale tentar de novo. */
export function isTransientAiError(message: string | null | undefined): boolean {
  if (!message) return false;
  return /\b429\b|rate limit|too many requests|overloaded|\b50[234]\b|timeout|timed out|tempo esgotado|ECONNRESET|fetch failed/i.test(
    message
  );
}

/** Limite de uso da IA: pede uma espera maior antes de tentar de novo. */
export function isRateLimitError(message: string | null | undefined): boolean {
  if (!message) return false;
  return /\b429\b|rate limit|too many requests/i.test(message);
}

/** Arquivo que nunca vai ser lido: vazio, corrompido ou que não é PDF. Não adianta repetir. */
export function isUnreadableFileError(message: string | null | undefined): boolean {
  if (!message) return false;
  return /PDF file is empty|zero bytes|Invalid PDF|InvalidPDFException|bad XRef|No PDF header|arquivo vazio/i.test(
    message
  );
}

/** Espera antes da tentativa `attempt` (2, 3…). Limite de uso espera mais. */
export function retryDelayMs(attempt: number, rateLimited: boolean): number {
  if (rateLimited) return attempt === 2 ? 12_000 : 25_000;
  return attempt === 2 ? 2_000 : 6_000;
}

/** Pode reenfileirar sozinho? Só abaixo do teto de execuções na janela. */
export function canAutoRetry(recentRuns: number): boolean {
  return recentRuns < AUTO_RETRY_MAX_RUNS;
}
