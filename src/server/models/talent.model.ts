/**
 * Banco de talentos: pastas por perfil. Funções puras — testadas em
 * talent.model.test.ts.
 */

export const MAX_FOLDER_NAME = 60;

/** Nome da pasta: sem espaços sobrando, primeira letra maiúscula, até 60. */
export function normalizeFolderName(value: string): string {
  const text = value.replace(/\s+/g, " ").trim().slice(0, MAX_FOLDER_NAME).trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

/** Mesma pasta? ("motorista" e "Motorista " são a mesma). */
export function sameFolderName(a: string, b: string): boolean {
  const key = (s: string) =>
    normalizeFolderName(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return key(a) === key(b);
}

/**
 * Vale sugerir o banco de talentos? A análise terminou e a nota ficou abaixo
 * do mínimo da vaga: não combina com esta vaga, mas pode servir para outra.
 */
export function suggestTalentPool(app: {
  aiState: string;
  aiScore: number | null;
  minScore: number;
}): boolean {
  return app.aiState === "DONE" && app.aiScore !== null && app.aiScore < app.minScore;
}

export type TalentFolderSummary = { id: string; name: string; count: number };
