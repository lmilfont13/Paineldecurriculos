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

export type TalentFolderSummary = {
  id: string;
  name: string;
  area: string | null;
  jobId: string | null;
  count: number;
};

export const FOLDER_SEPARATOR = " · ";

/**
 * Nome sugerido para a pasta, segmentado como o currículo: "Área · Função"
 * (ex.: "Logística · Motorista e entregador"). Sem área, só a função.
 */
export function suggestFolderName(segment: { area: string | null; role: string | null }): string {
  const role = segment.role?.trim() ?? "";
  const area = segment.area?.trim() ?? "";
  if (!role) return area;
  if (!area || sameFolderName(area, role)) return role;
  return normalizeFolderName(`${area}${FOLDER_SEPARATOR}${role}`);
}

/** Área de uma pasta: a informada, senão o que vem antes do " · " no nome. */
export function folderArea(folder: { name: string; area?: string | null }): string {
  if (folder.area?.trim()) return folder.area.trim();
  const [first, ...rest] = folder.name.split(FOLDER_SEPARATOR);
  return rest.length > 0 && first.trim() ? first.trim() : "Outros";
}

/** Pastas agrupadas por área, áreas e pastas em ordem alfabética ("Outros" no fim). */
export function groupFoldersByArea<T extends { name: string; area?: string | null }>(
  folders: T[]
): { area: string; folders: T[] }[] {
  const map = new Map<string, T[]>();
  for (const folder of folders) {
    const area = folderArea(folder);
    map.set(area, [...(map.get(area) ?? []), folder]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a === "Outros" ? 1 : b === "Outros" ? -1 : a.localeCompare(b, "pt-BR")))
    .map(([area, list]) => ({
      area,
      folders: list.sort((x, y) => x.name.localeCompare(y.name, "pt-BR")),
    }));
}
