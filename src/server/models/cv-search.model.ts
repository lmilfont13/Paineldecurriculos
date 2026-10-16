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
  skills?: string[];

  // Campos essenciais sem redundância com o currículo:
  birthDate?: string | null; // ISO
  age?: number | null;
  city?: string | null;
  state?: string | null;
  neighborhood?: string | null;
  desiredRole?: string | null;
  workPreference?: string | null;
  availability?: string | null;
  hasCnh?: string | null;
  isPcd?: boolean;
  pcdDetails?: string | null;
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
  onlyRemote?: boolean;

  // Novos filtros refinados:
  selectedNeighborhood?: string;
  selectedCity?: string;
  selectedDesiredRole?: string;
  selectedWorkPreference?: string;
  selectedCnh?: string;
  onlyPcd?: boolean;
  ageBracket?: string; // "18_24" | "25_34" | "35_44" | "45_54" | "55_PLUS"
  salaryBracket?: string;
  /** Empresas (separadas por vírgula) onde o candidato já trabalhou; busca no texto do currículo. */
  previousCompany?: string;
};

export type CvSearchSort = "score" | "recent" | "name";

export type FacetCount = {
  key: string;
  label: string;
  count: number;
};

const COMMON_SKILLS = [
  "React",
  "Node.js",
  "TypeScript",
  "JavaScript",
  "Python",
  "SQL",
  "PostgreSQL",
  "AWS",
  "Docker",
  "Git",
  "Figma",
  "UX/UI",
  "Next.js",
  "Excel Avançado",
  "Power BI",
  "Contabilidade",
  "Sped Fiscal",
  "Conciliação",
  "Tributário",
  "Vendas B2B",
  "Inside Sales",
  "CRM",
  "Marketing Digital",
  "SEO",
  "Tráfego Pago",
  "Logística",
  "Supply Chain",
  "Gestão de Estoque",
  "ERP",
  "Liderança",
  "Inglês Avançado",
  "Inglês Fluente",
  "Espanhol",
  "CNH B",
  "CNH D",
];

/** Identifica competências e ferramentas a partir do texto do currículo e perfil IA. */
export function extractCandidateSkills(
  resumeText: string | null,
  profile: string | null
): string[] {
  const combined = `${profile ?? ""} ${resumeText ?? ""}`.toLowerCase();
  if (!combined.trim()) return [];

  const detected: string[] = [];
  for (const skill of COMMON_SKILLS) {
    const s = skill.toLowerCase();
    // Verifica palavra inteira ou termo
    if (combined.includes(s)) {
      detected.push(skill);
      if (detected.length >= 6) break;
    }
  }
  return detected;
}

/** Extrai trecho relevante do currículo em torno do termo pesquisado (com contexto). */
export function extractResumeSnippet(text: string | null, keyword: string): string | null {
  if (!text || !keyword || keyword.trim().length < 2) return null;
  const clean = text.replace(/\s+/g, " ");

  // Suporte para buscar primeira palavra de busca composta
  const firstWord = keyword.trim().split(/\s+/)[0]?.toLowerCase();
  if (!firstWord) return null;

  const q = firstWord;
  const index = clean.toLowerCase().indexOf(q);
  if (index === -1) return null;

  const start = Math.max(0, index - 80);
  const end = Math.min(clean.length, index + q.length + 120);

  let snippet = clean.slice(start, end).trim();
  if (start > 0) snippet = "…" + snippet;
  if (end < clean.length) snippet = snippet + "…";
  return snippet;
}

/** Calcula a idade em anos a partir da data de nascimento. */
export function calculateAge(birthDate: string | Date | null | undefined): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
    age--;
  }
  return age >= 14 && age <= 100 ? age : null;
}

const MONTHS_PT: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

function buildValidDate(day: number, month: number, year: number): Date | null {
  if (year < 100) year += year > new Date().getFullYear() % 100 ? 1900 : 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day, 12));
  if (d.getUTCMonth() !== month - 1) return null;
  return calculateAge(d) === null ? null : d;
}

/**
 * Extrai a data de nascimento do texto do currículo ("Data de nascimento:
 * 12/03/1990", "Nasc.: 12-03-90", "Nascido em 12 de março de 1990").
 * Só considera datas perto de um rótulo de nascimento, para não confundir
 * com datas de emprego.
 */
export function extractBirthDateFromText(text: string | null | undefined): Date | null {
  if (!text) return null;
  const clean = text.replace(/\s+/g, " ");

  const numeric = clean.match(
    /(?:data\s*(?:de)?\s*nasc(?:imento|\.)?|nascimento|nasc\.?|nascid[oa](?:\s*em)?|\b\d{2}\s*anos\s*[\(\[\-–,]|\bd\.?\s*n\.?\s*s?\b\.?|\b(?:casad[oa]|solteir[oa]|divorciad[oa]|vi[uú]v[oa]|uni[aã]o\s*est[aá]vel)\b[\s,.;\-–]*(?:d\.?\s*n\.?\s*s?\b\.?)?)\s*[:\-–]?\s*(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*(\d{2,4})/i
  );
  if (numeric) {
    const d = buildValidDate(Number(numeric[1]), Number(numeric[2]), Number(numeric[3]));
    if (d) return d;
  }

  const written = clean
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/(?:nasc(?:imento|\.)?|nascid[oa](?:\s*em)?)\s*[:\-–]?\s*(\d{1,2})\s*de\s*([a-z]+)\s*de\s*(\d{4})/i);
  if (written) {
    const month = MONTHS_PT[written[2].toLowerCase()];
    if (month) {
      const d = buildValidDate(Number(written[1]), month, Number(written[3]));
      if (d) return d;
    }
  }
  return null;
}

/** Idade escrita no currículo ("Idade: 34 anos"), quando não há data. */
export function extractAgeFromText(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.replace(/\s+/g, " ").match(/idade\s*[:\-–]?\s*(\d{2})\s*anos?/i);
  if (!m) return null;
  const age = Number(m[1]);
  return age >= 14 && age <= 100 ? age : null;
}

/** Minúsculas, sem acentos e espaços extras: comparação tolerante. */
export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Extrai o bairro do endereço do currículo ("Bairro: Aldeota", "Bairro Messejana"). */
export function extractNeighborhoodFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text
    .replace(/[ \t]+/g, " ")
    .match(/\bbairro\s*[:\-–]?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' ]{2,40}?)(?=\s*(?:[,;\-–|\n\r(]|\bcep\b|\bcidade\b|\bfortaleza\b|\d|$))/i);
  const value = m?.[1]?.trim();
  return value && value.length >= 3 ? value : null;
}

const JOB_TITLE_WORDS =
  /\b(auxiliar|assistente|analista|vendedor|vendedora|operador|operadora|promotor|promotora|repositor|repositora|gerente|supervisor|supervisora|coordenador|coordenadora|atendente|caixa|estoquista|motorista|t[eé]cnico|t[eé]cnica|estagi[aá]ri[oa]|aprendiz|encarregad[oa]|l[ií]der|diretor|diretora|recepcionista|cargo|fun[cç][aã]o|atividades?|responsabilidades?|per[ií]odo|experi[eê]ncias?|profissional|atual|presente|conferente|a[cç]ougueiro|padeiro|balconista|fiscal|consultor|consultora|jovem|funcion[aá]rio|funcion[aá]ria|admiss[aã]o|demiss[aã]o|sal[aá]rio)\b/i;
const COMPANY_HINT =
  /\b(ltda|s\/a|s\.a\.?|eireli|supermercados?|atacad(?:ista|[aã]o)|atacarejo|com[eé]rcio|ind[uú]stria|grupo|rede|farm[aá]cias?|drogaria|distribuidora|cl[ií]nica|hospital|restaurante|hotel|banco|construtora|transportes?|servi[cç]os|ag[eê]ncia|escola|col[eé]gio|shopping|companhia|center|market|mercadinho|mercantil|mercadinhos|padaria|lojas|loja|empresa)\b/i;
const NOT_COMPANY =
  /^(fortaleza|eus[eé]bio|caucaia|maracana[uú]|brasil|cear[aá]|pessoais?|dados|contato|telefone|e-?mail|endere[cç]o|casad[oa]|solteir[oa]|bairro|cidade|cnh|forma[cç][aã]o|escolaridade|ensino|idiomas?|cursos?|objetivo|resumo|refer[eê]ncias?|habilidades|compet[eê]ncias|qualifica[cç][oõ]es|curr[ií]culo|curriculum|vitae|nome|nascimento|idade|estado|civil|nacionalidade|brasileir[oa])\b/i;
const DATE_RANGE =
  /\(?\b(?:\d{1,2}\s*[\/.]\s*)?(?:19|20)\d{2}\b.*$|\b(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\.?\s*(?:de\s*)?(?:19|20)\d{2}.*$/i;

/**
 * Extrai nomes de empresas do histórico profissional do currículo.
 * Heurística: rótulo "Empresa:", trechos com sufixos típicos (Ltda, Supermercados…)
 * e nomes próprios em linhas que trazem período (ex.: "Assaí Atacadista 2019 - 2022").
 */
export function extractCompaniesFromText(text: string | null | undefined): string[] {
  if (!text) return [];
  const lines = text
    .split(/\r?\n|•|·|\|/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const startIdx = lines.findIndex((l) =>
    /^(experi[eê]ncias?(\s+profissionais?)?|hist[oó]rico\s+profissional|trajet[oó]ria\s+profissional|atua[cç][aã]o\s+profissional)\b/i.test(l)
  );
  let section = lines;
  if (startIdx >= 0) {
    const rest = lines.slice(startIdx + 1);
    const endRel = rest.findIndex((l) =>
      /^(forma[cç][aã]o|escolaridade|educa[cç][aã]o|cursos?|idiomas?|qualifica|habilidades|compet[eê]ncias|objetivo|dados\s+pessoais|refer[eê]ncias)/i.test(l)
    );
    section = endRel >= 0 ? rest.slice(0, endRel) : rest;
  }

  const found = new Map<string, string>();
  const add = (raw: string) => {
    const name = raw.replace(/^[\s\-–—:;,.]+|[\s\-–—:;,.]+$/g, "").trim();
    if (name.length < 3 || name.length > 45) return;
    const key = normalizeText(name);
    if (!found.has(key)) found.set(key, name);
  };

  // 1) Campos rotulados ("Empresa: X Função: Y Período: Z"), em qualquer lugar do
  //    texto e mesmo com tudo numa linha só (comum na extração de PDF).
  const flat = text.replace(/\s+/g, " ");
  const labeled = flat.matchAll(
    /\b(?:empresa|empregador|local\s+de\s+trabalho)\s*[:\-–]\s*(.+?)(?=\s*\b(?:fun[cç][aã]o|cargo|per[ií]odo|atividades?|sal[aá]rio|admiss[aã]o|demiss[aã]o|motivo|empresa|empregador|local\s+de\s+trabalho)\s*[:\-–]|$)/gi
  );
  for (const m of labeled) {
    add(m[1].replace(DATE_RANGE, "").split(/\s[-–—]\s/)[0]);
  }

  for (const line of section) {
    if (line.length > 90) continue;
    const label = line.match(/^(?:empresa|empregador|local\s+de\s+trabalho)\s*[:\-–]\s*(.+)$/i);
    if (label) {
      add(label[1].replace(DATE_RANGE, "").split(/\s[-–—]\s|,/)[0]);
      continue;
    }
    const hasDates = DATE_RANGE.test(line);
    const withoutDates = line.replace(DATE_RANGE, "").trim();
    for (const seg of withoutDates.split(/\s[-–—]\s|,|\(|\)|:|;/)) {
      const s = seg.trim();
      if (s.length < 3 || s.length > 40) continue;
      const words = s.split(/\s+/);
      if (words.length > 5) continue;
      if (JOB_TITLE_WORDS.test(s) || NOT_COMPANY.test(s) || /\d/.test(s)) continue;
      if (!/^[A-ZÀ-Ý0-9]/.test(s)) continue;
      const properCase = words
        .filter((w) => w.length > 3)
        .every((w) => /^[A-ZÀ-Ý]/.test(w));
      if (COMPANY_HINT.test(s) || (hasDates && properCase)) add(s);
    }
  }
  return Array.from(found.values()).slice(0, 12);
}

/** Agrupa empresas encontradas nos currículos (para escolher no filtro). */
export function computeCompanyFacets(candidates: CandidateCvCard[]): FacetCount[] {
  const map = new Map<string, { label: string; count: number }>();
  for (const c of candidates) {
    for (const name of extractCompaniesFromText(c.resumeText)) {
      const key = normalizeText(name);
      const cur = map.get(key);
      if (cur) cur.count += 1;
      else map.set(key, { label: name, count: 1 });
    }
  }
  return Array.from(map.values())
    .map((v) => ({ key: v.label, label: v.label, count: v.count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 300);
}

/** Agrupa contagens de bairros para a sidebar de filtro. */
export function computeNeighborhoodFacets(candidates: CandidateCvCard[]): FacetCount[] {
  const map = new Map<string, number>();
  for (const c of candidates) {
    const raw = c.neighborhood?.trim();
    if (!raw) continue;
    const formatted = raw
      .split(/\s+/)
      .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase()))
      .join(" ");
    map.set(formatted, (map.get(formatted) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((a, b) => b.count - a.count);
}

/** Agrupa contagens de funções pretendidas para a sidebar. */
export function computeDesiredRoleFacets(candidates: CandidateCvCard[]): FacetCount[] {
  const map = new Map<string, number>();
  for (const c of candidates) {
    const raw = c.desiredRole?.trim();
    if (!raw) continue;
    const formatted = raw
      .split(/\s+/)
      .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase()))
      .join(" ");
    map.set(formatted, (map.get(formatted) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((a, b) => b.count - a.count);
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

/** Busca booleana simples: avalia AND / OR / NOT ou palavras soltas. */
function matchesBooleanSearch(text: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  // Se tiver operador NOT (ex: "vendas NOT junior")
  if (q.includes(" not ")) {
    const [includePart, excludePart] = q.split(" not ");
    const includesOk = matchesBooleanSearch(text, includePart);
    const excludesFound = excludePart.split(/\s+/).some((term) => text.includes(term.trim()));
    return includesOk && !excludesFound;
  }

  // Se tiver operador OR (ex: "react or python")
  if (q.includes(" or ")) {
    const terms = q.split(" or ");
    return terms.some((t) => matchesBooleanSearch(text, t.trim()));
  }

  // Se tiver operador AND ou múltiplos termos
  const terms = q.replace(/ and /g, " ").split(/\s+/).filter(Boolean);
  return terms.every((term) => text.includes(term));
}

/** Aplica todos os filtros facetados e busca textual. */
export function filterCandidates(
  candidates: CandidateCvCard[],
  filters: CvSearchFilters
): CandidateCvCard[] {
  const q = filters.keyword.trim().toLowerCase();

  return candidates.filter((item) => {
    // 1. Busca textual inteligente (booleana e em todo o material)
    if (q) {
      const allText = [
        item.name,
        item.email,
        item.phone ?? "",
        item.neighborhood ?? "",
        item.city ?? "",
        item.state ?? "",
        item.desiredRole ?? "",
        item.salaryExpectation ?? "",
        item.workPreference ?? "",
        item.hasCnh ?? "",
        item.isPcd ? "pcd deficiência acessibilidade" : "",
        item.pcdDetails ?? "",
        item.aiProfile ?? "",
        item.aiArea ?? "",
        item.aiLevel ?? "",
        item.job.title,
        item.aiReasoning ?? "",
        item.education ?? "",
        item.languages ?? "",
        ...(item.skills ?? []),
        item.resumeText ?? "",
      ]
        .join(" ")
        .toLowerCase();

      if (!matchesBooleanSearch(allText, q)) {
        return false;
      }
    }

    // 2. Filtro de Bairro
    if (filters.selectedNeighborhood) {
      const targetN = normalizeText(filters.selectedNeighborhood);
      const itemN = item.neighborhood ? normalizeText(item.neighborhood) : "";
      const inField = itemN.includes(targetN);
      // Sem bairro no cadastro: procura o bairro no endereço do currículo.
      const inResume = !itemN && normalizeText(item.resumeText ?? "").includes(targetN);
      if (!inField && !inResume) return false;
    }

    // 2b. Filtro de empresa onde já trabalhou (qualquer uma das informadas)
    if (filters.previousCompany?.trim()) {
      const companies = filters.previousCompany
        .split(/[,;\n]/)
        .map((c) => normalizeText(c))
        .filter((c) => c.length >= 2);
      if (companies.length > 0) {
        const resume = normalizeText(item.resumeText ?? "");
        if (!companies.some((c) => resume.includes(c))) return false;
      }
    }

    // 3. Filtro de Cidade
    if (filters.selectedCity) {
      const targetC = filters.selectedCity.trim().toLowerCase();
      const itemC = item.city?.trim().toLowerCase();
      if (!itemC || !itemC.includes(targetC)) return false;
    }

    // 4. Filtro de Função Pretendida
    if (filters.selectedDesiredRole) {
      const targetR = filters.selectedDesiredRole.trim().toLowerCase();
      const itemR = item.desiredRole?.trim().toLowerCase();
      if (!itemR || !itemR.includes(targetR)) return false;
    }

    // 5. Filtro de Modalidade
    if (filters.selectedWorkPreference && filters.selectedWorkPreference !== "ANY") {
      if (
        item.workPreference &&
        item.workPreference !== "ANY" &&
        item.workPreference !== filters.selectedWorkPreference
      ) {
        return false;
      }
    }

    // 6. Filtro de CNH
    if (filters.selectedCnh && filters.selectedCnh !== "NONE") {
      if (!item.hasCnh || item.hasCnh === "NONE") return false;
      if (filters.selectedCnh !== "ANY" && item.hasCnh !== filters.selectedCnh) {
        // Se pediu B e tem AB, é válido
        if (filters.selectedCnh === "B" && item.hasCnh === "AB") {
          // OK
        } else if (filters.selectedCnh === "A" && item.hasCnh === "AB") {
          // OK
        } else {
          return false;
        }
      }
    }

    // 7. Filtro apenas PCD
    if (filters.onlyPcd && !item.isPcd) {
      return false;
    }

    // 8. Faixa Etária
    if (filters.ageBracket) {
      const age = item.age ?? calculateAge(item.birthDate);
      if (age === null) return false;
      if (filters.ageBracket === "18_24" && (age < 18 || age > 24)) return false;
      if (filters.ageBracket === "25_34" && (age < 25 || age > 34)) return false;
      if (filters.ageBracket === "35_44" && (age < 35 || age > 44)) return false;
      if (filters.ageBracket === "45_54" && (age < 45 || age > 54)) return false;
      if (filters.ageBracket === "55_PLUS" && age < 55) return false;
    }

    // 9. Faixa Salarial
    if (filters.salaryBracket) {
      const salary = item.salaryExpectation?.toLowerCase() ?? "";
      if (!salary.includes(filters.salaryBracket.toLowerCase())) return false;
    }

    // 10. Filtro de Área
    if (filters.selectedAreas.length > 0) {
      const area = item.aiArea?.trim() || "Outras Áreas";
      if (!filters.selectedAreas.includes(area)) return false;
    }

    // 11. Filtro de Nível
    if (filters.selectedLevels.length > 0) {
      const level = item.aiLevel?.trim() || "Não especificado";
      if (!filters.selectedLevels.includes(level)) return false;
    }

    // 12. Filtro de Vaga
    if (filters.selectedJobId && item.job.id !== filters.selectedJobId) {
      return false;
    }

    // 13. Filtro de Status
    if (filters.selectedStatus && item.status !== filters.selectedStatus) {
      return false;
    }

    // 14. Score Mínimo
    if (filters.minScore !== null && (item.aiScore === null || item.aiScore < filters.minScore)) {
      return false;
    }

    // 15. Filtro apenas com foto
    if (filters.onlyWithPhoto && !item.photoUrl) {
      return false;
    }

    // 16. Filtro apenas com PDF
    if (filters.onlyWithPdf && !item.resumeUrl) {
      return false;
    }

    // 17. Filtro Remoto
    if (filters.onlyRemote && item.job.workMode !== "REMOTE") {
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
