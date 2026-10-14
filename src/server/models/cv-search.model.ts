import type { AppStatus } from "@prisma/client";

export type CandidateCvCard = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  photoUrl: string | null;
  resumeUrl: string | null;
  resumeText: string | null;
  aiProfile: string | null;
  aiArea: string | null;
  aiLevel: string | null;
  aiScore: number | null;
  aiReasoning: string | null;
  aiChecklist?: unknown;
  status: AppStatus;
  createdAt: string; // ISO
  job: {
    id: string;
    title: string;
    location: string | null;
    workMode: string;
    contract: string;
    aiMinScore: number;
  };
  salaryExpectation?: string | null;
  education?: string | null;
  languages?: string | null;
};

export type CvSearchFilters = {
  keyword: string;
  selectedAreas: string[];
  selectedLevels: string[];
  selectedJobId: string;
  selectedStatus: string;
  minScore: number | null;
  onlyWithPhoto: boolean;
  onlyWithPdf: boolean;
};

export type CvSearchSort = "score" | "recent" | "name";

export type FacetCount = {
  key: string;
  label: string;
  count: number;
};

/** Extrai trecho relevante do currículo em torno do termo pesquisado (com contexto). */
export function extractResumeSnippet(text: string | null, keyword: string): string | null {
  if (!text || !keyword || keyword.trim().length < 2) return null;
  const clean = text.replace(/\s+/g, " ");
  const q = keyword.trim().toLowerCase();
  const index = clean.toLowerCase().indexOf(q);
  if (index === -1) return null;

  const start = Math.max(0, index - 80);
  const end = Math.min(clean.length, index + q.length + 120);

  let snippet = clean.slice(start, end).trim();
  if (start > 0) snippet = "…" + snippet;
  if (end < clean.length) snippet = snippet + "…";
  return snippet;
}

/** Agrupa contagens de áreas profissionais para a sidebar. */
export function computeAreaFacets(candidates: CandidateCvCard[]): FacetCount[] {
  const map = new Map<string, number>();
  for (const c of candidates) {
    const area = c.aiArea?.trim() || "Outras Áreas";
    map.set(area, (map.get(area) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((a, b) => b.count - a.count);
}

/** Agrupa contagens de senioridade / nível para a sidebar. */
export function computeLevelFacets(candidates: CandidateCvCard[]): FacetCount[] {
  const order = ["Liderança", "Sênior", "Pleno", "Júnior", "Operacional", "Estágio"];
  const map = new Map<string, number>();
  for (const c of candidates) {
    const level = c.aiLevel?.trim() || "Não especificado";
    map.set(level, (map.get(level) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((a, b) => {
      const idxA = order.indexOf(a.key);
      const idxB = order.indexOf(b.key);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return b.count - a.count;
    });
}

/** Aplica todos os filtros facetados e busca textual. */
export function filterCandidates(
  candidates: CandidateCvCard[],
  filters: CvSearchFilters
): CandidateCvCard[] {
  const q = filters.keyword.trim().toLowerCase();

  return candidates.filter((item) => {
    // 1. Busca por palavra-chave no texto completo do CV, nome, e-mail, cargo e raciocínio IA
    if (q) {
      const matchName = item.name.toLowerCase().includes(q);
      const matchEmail = item.email.toLowerCase().includes(q);
      const matchProfile = (item.aiProfile ?? "").toLowerCase().includes(q);
      const matchArea = (item.aiArea ?? "").toLowerCase().includes(q);
      const matchJob = item.job.title.toLowerCase().includes(q);
      const matchReasoning = (item.aiReasoning ?? "").toLowerCase().includes(q);
      const matchText = (item.resumeText ?? "").toLowerCase().includes(q);

      if (
        !matchName &&
        !matchEmail &&
        !matchProfile &&
        !matchArea &&
        !matchJob &&
        !matchReasoning &&
        !matchText
      ) {
        return false;
      }
    }

    // 2. Filtro de Área
    if (filters.selectedAreas.length > 0) {
      const area = item.aiArea?.trim() || "Outras Áreas";
      if (!filters.selectedAreas.includes(area)) return false;
    }

    // 3. Filtro de Nível
    if (filters.selectedLevels.length > 0) {
      const level = item.aiLevel?.trim() || "Não especificado";
      if (!filters.selectedLevels.includes(level)) return false;
    }

    // 4. Filtro de Vaga
    if (filters.selectedJobId && item.job.id !== filters.selectedJobId) {
      return false;
    }

    // 5. Filtro de Status
    if (filters.selectedStatus && item.status !== filters.selectedStatus) {
      return false;
    }

    // 6. Score Mínimo
    if (filters.minScore !== null && (item.aiScore === null || item.aiScore < filters.minScore)) {
      return false;
    }

    // 7. Filtro apenas com foto
    if (filters.onlyWithPhoto && !item.photoUrl) {
      return false;
    }

    // 8. Filtro apenas com PDF
    if (filters.onlyWithPdf && !item.resumeUrl) {
      return false;
    }

    return true;
  });
}

/** Ordenação refinada dos candidatos. */
export function sortCandidates(
  candidates: CandidateCvCard[],
  sort: CvSearchSort
): CandidateCvCard[] {
  return [...candidates].sort((a, b) => {
    if (sort === "score") {
      return (b.aiScore ?? -1) - (a.aiScore ?? -1);
    }
    if (sort === "recent") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (sort === "name") {
      return a.name.localeCompare(b.name, "pt-BR");
    }
    return 0;
  });
}
