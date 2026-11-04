/**
 * Banco de talentos: pastas por perfil. Funções puras — testadas em
 * talent.model.test.ts.
 */

export const MAX_FOLDER_NAME = 60;

/**
 * Neutraliza gênero de uma palavra em português (masculino singular como forma
 * canônica). Cobre os pares mais comuns em cargos: or/ora, eiro/eira.
 * Invariáveis (ista, ente) ficam intactos.
 */
function neutralizeWord(word: string): string {
  // Promotora → Promotor, Vendedora → Vendedor, Consultora → Consultor
  if (/ora$/i.test(word)) return word.replace(/ora$/i, "or");
  // Cabeleireira → Cabeleireiro
  if (/eira$/i.test(word)) return word.replace(/eira$/i, "eiro");
  return word;
}

/** Aplica neutralização de gênero em cada palavra de uma frase. */
function neutralizeGender(phrase: string): string {
  return phrase
    .split(/\s+/)
    .map((w) => neutralizeWord(w))
    .join(" ");
}

/**
 * Normaliza um nome de pasta: sem espaços sobrando, neutraliza gênero,
 * ordena termos compostos ("Vendedora e promotora" → "Promotor e vendedor"),
 * primeira letra maiúscula, até 60 caracteres.
 */
export function normalizeFolderName(value: string): string {
  let text = value.replace(/\s+/g, " ").trim();
  if (!text) return "";

  // Separa pelo " · " (área · função) para normalizar cada parte
  const parts = text.split(FOLDER_SEPARATOR);
  const normalized = parts.map((part) => {
    const trimmed = part.trim();
    // Se contém " e " (conjunção), normaliza e ordena os termos
    if (/ e /i.test(trimmed)) {
      const terms = trimmed
        .split(/ e /i)
        .map((t) => neutralizeGender(t.trim()).toLowerCase())
        .sort((a, b) => a.localeCompare(b, "pt-BR"));
      const joined = terms.join(" e ");
      return joined.charAt(0).toUpperCase() + joined.slice(1);
    }
    return neutralizeGender(trimmed);
  });

  text = normalized.join(FOLDER_SEPARATOR).slice(0, MAX_FOLDER_NAME).trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

/**
 * Chave de comparação: normalizada, lowercase, sem acentos. Usada para
 * detectar pastas duplicadas ("Promotora de vendas" = "Promotor de vendas").
 */
function folderKey(s: string): string {
  return normalizeFolderName(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Mesma pasta? ("motorista" e "Motorista " são a mesma, assim como "Promotor" e "Promotora"). */
export function sameFolderName(a: string, b: string): boolean {
  return folderKey(a) === folderKey(b);
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
  count: number;
};

export const FOLDER_SEPARATOR = " · ";

/**
 * Nome sugerido para a pasta: só a área canônica (ex.: "Vendas", "Logística").
 * Antes usava "Área · Função", agora simplifica para ter no máximo ~10 pastas.
 */
export function suggestFolderName(segment: { area: string | null; role: string | null }): string {
  const area = segment.area?.trim() ?? "";
  if (area) return normalizeArea(area);
  // Sem área mas com função: tenta usar a função como área
  const role = segment.role?.trim() ?? "";
  return role ? normalizeArea(role) : "Outros";
}

/**
 * Mapa de áreas canônicas: normaliza sinônimos e termos compostos para manter
 * o banco de talentos com no máximo ~10 pastas. Chave = lowercase sem acento.
 */
const AREA_MAP: Record<string, string> = {
  vendas: "Vendas",
  atendimento: "Atendimento",
  beleza: "Beleza",
  cosmeticos: "Beleza",
  estetica: "Beleza",
  gestao: "Gestão",
  logistica: "Logística",
  transporte: "Logística",
  "trade marketing": "Trade Marketing",
  promocao: "Vendas",
  varejo: "Vendas",
  administrativo: "Administrativo",
  saude: "Saúde",
  ti: "TI",
  industria: "Indústria",
  desconhecida: "Outros",
  indefinida: "Outros",
};

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function lookupArea(term: string): string | undefined {
  return AREA_MAP[stripAccents(term.trim().toLowerCase())];
}

/**
 * Normaliza área: mapeia para uma área canônica, simplifica compostos como
 * "Vendas e Beleza" → "Vendas", "Cosméticos e vendas" → "Beleza".
 * Desconhecida/Indefinida/vazio → "Outros".
 */
export function normalizeArea(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "Outros";

  // Direto no mapa? (ex.: "Vendas", "Desconhecida", "Trade marketing")
  const direct = lookupArea(trimmed);
  if (direct) return direct;

  // Composto "X e Y": pega o primeiro termo antes de " e "
  const match = trimmed.match(/^(.+?)\s+e\s+/i);
  if (match) {
    const first = lookupArea(match[1]);
    if (first) return first;
    // Não está no mapa: capitaliza o primeiro termo
    const t = match[1].trim();
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** Área de uma pasta: a informada (normalizada), senão o que vem antes do " · " no nome. */
export function folderArea(folder: { name: string; area?: string | null }): string {
  if (folder.area?.trim()) return normalizeArea(folder.area);
  const [first, ...rest] = folder.name.split(FOLDER_SEPARATOR);
  return rest.length > 0 && first.trim() ? normalizeArea(first) : "Outros";
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
