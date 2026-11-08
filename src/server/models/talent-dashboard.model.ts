/**
 * Modelo de dados analíticos para o Dashboard Executivo de Talentos em PDF.
 * Consolida demografia (gênero, idade), mercado (empresas, cargos, senioridade),
 * estabilidade profissional e ranking dos melhores candidatos da base.
 */

import {
  calculateAge,
  cleanDigits,
  cleanEmail,
  cleanName,
  extractAgeFromText,
  extractBirthDateFromText,
} from "@/server/models/cv-search.model";
import { parseTenureAnalysis, type TenureCompany } from "@/server/models/tenure.model";
import { titleCasePt, toPdfSafeText } from "@/server/models/text.model";

export type GenderCategory = "Feminino" | "Masculino" | "Não informado";

export type GenderStats = {
  female: { count: number; pct: number };
  male: { count: number; pct: number };
  unspecified: { count: number; pct: number };
  total: number;
};

export type AgeBracket = {
  label: string;
  count: number;
  pct: number;
};

export type AgeStats = {
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  brackets: AgeBracket[];
  totalWithAge: number;
};

export type CountWithPct = {
  label: string;
  count: number;
  pct: number;
};

export type CompanyStats = {
  topCompanies: CountWithPct[];
  totalCompaniesRecorded: number;
  avgTenureMonths: number | null;
  avgTenureFormatted: string;
};

export type HighlightCandidate = {
  id: string;
  name: string;
  gender: GenderCategory;
  age: number | null;
  role: string;
  area: string;
  level: string;
  score: number | null;
  location: string;
  topCompany: string | null;
  tenureFormatted: string;
  skills: string[];
};

export type TalentDashboardData = {
  generatedAt: Date;
  companyName: string;
  totals: {
    candidates: number;
    withPhoto: number;
    withPhotoPct: number;
    withPdf: number;
    withPdfPct: number;
    analyzed: number;
    analyzedPct: number;
    avgScore: number | null;
    topMatchesCount: number;
    topMatchesPct: number;
  };
  gender: GenderStats;
  age: AgeStats;
  roles: CountWithPct[];
  areas: CountWithPct[];
  levels: CountWithPct[];
  companies: CompanyStats;
  scoreBands: CountWithPct[];
  highlights: HighlightCandidate[];
};

const FEMALE_NAMES = new Set([
  "maria", "ana", "vanessa", "patricia", "patrícia", "julia", "júlia", "simone", "nubia", "núbia",
  "ticiane", "gleiciane", "alana", "jessica", "jéssica", "brenda", "camila", "fernanda", "gabriela",
  "luana", "beatriz", "aline", "larissa", "amanda", "bruna", "leticia", "letícia", "paula", "mariana",
  "juliana", "rafaela", "caroline", "daniela", "barbara", "bárbara", "flavia", "flávia", "renata",
  "luciana", "natalia", "natália", "debora", "débora", "priscila", "kelly", "tais", "taís", "thais", "thaís",
  "rayssa", "sabrina", "sandra", "claudia", "cláudia", "cristina", "silvana", "marcia", "márcia", "rosana",
  "regina", "sonia", "sônia", "monica", "mônica", "eliane", "adriana", "raquel", "talita", "mayara",
  "ingrid", "vitoria", "vitória", "eduarda", "bianca", "yasmin", "stefany", "jennifer", "jaqueline",
  "andressa", "evelyn", "nicole", "lais", "laís", "paloma", "pamela", "pâmela", "heloisa", "heloísa",
  "milena", "samara", "glaucia", "gláucia", "livia", "lívia", "giselle", "gisele", "carla", "valeria", "valéria",
  "michele", "michelle", "lorena", "taina", "tainá", "geovana", "isabela", "isabella", "sueli", "fatima", "fátima",
  "tamires", "clara", "carolina", "elizabeth", "elisangela", "elisângela", "lucilene", "roseli", "rosangela",
  "francisca", "francinete", "antonia", "antônia", "cleide", "conceicao", "conceição", "marlene", "tereza", "teresa",
  "elida", "élida", "geovanna", "sarah", "sara", "rebeca", "monique", "daiane", "dayane", "viviane", "vivian",
]);

const MALE_NAMES = new Set([
  "joao", "joão", "jose", "josé", "darlan", "walber", "lucas", "gabriel", "carlos", "glaydstone",
  "paulo", "pedro", "mateus", "matheus", "marcos", "bruno", "rodrigo", "felipe", "guilherme",
  "leonardo", "gustavo", "rafael", "daniel", "marcelo", "eduardo", "andre", "andré", "thiago", "tiago",
  "diego", "alexandre", "fernando", "caio", "samuel", "victor", "vitor", "igor", "vinicius", "vinícius",
  "renan", "arthur", "artur", "henrique", "murilo", "douglas", "denis", "david", "davi", "jonathan",
  "jonatas", "jônatas", "jhonatan", "wesley", "william", "willian", "wellington", "everton", "éverton",
  "cleber", "kleber", "fabricio", "fabrício", "fabio", "fábio", "anderson", "robson", "gilberto",
  "roberto", "ricardo", "sergio", "sérgio", "luiz", "luís", "antonio", "antônio", "francisco", "manoel",
  "manuel", "claudio", "cláudio", "cesar", "césar", "mauricio", "maurício", "otavio", "otávio", "leandro",
  "wagner", "valdir", "waldir", "reginaldo", "ronaldo", "romario", "romário", "vagner", "marcio", "márcio",
  "luciano", "alan", "allan", "breno", "danilo", "elias", "erick", "giovanni", "hugo", "ian",
  "itamar", "jorge", "julio", "júlio", "luan", "michel", "nelson", "osvaldo", "patrick", "raimundo",
  "renato", "rubens", "sebastiao", "sebastião", "sidney", "walter", "washington", "yuri", "alisson",
]);

/**
 * Infere o gênero com alta precisão com base no primeiro nome e termos contextuais no currículo.
 */
export function inferGender(name: string, resumeText?: string | null): GenderCategory {
  if (!name) return "Não informado";
  const first = name
    .trim()
    .split(/\s+/)[0]
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (FEMALE_NAMES.has(first)) return "Feminino";
  if (MALE_NAMES.has(first)) return "Masculino";

  // Termos de gênero presentes no texto do currículo
  if (resumeText) {
    const femaleMatch = /\b(brasileira|nascida|solteira|casada|promotora|vendedora|atendente|estagi[aá]ria|recepcionista|assistente)\b/i.test(resumeText);
    const maleMatch = /\b(brasileiro|nascido|solteiro|casado|promotor|vendedor|atendente|estagi[aá]rio|recepcionista|assistente)\b/i.test(resumeText);
    if (femaleMatch && !maleMatch) return "Feminino";
    if (maleMatch && !femaleMatch) return "Masculino";
  }

  // Heurística de terminação de nomes em português
  if (first.endsWith("a") || first.endsWith("ia") || first.endsWith("iane") || first.endsWith("elle")) {
    return "Feminino";
  }
  if (first.endsWith("o") || first.endsWith("os") || first.endsWith("or") || first.endsWith("son") || first.endsWith("ton")) {
    return "Masculino";
  }

  return "Não informado";
}

/** Formata número de meses em texto legível. */
function formatMonths(months: number | null): string {
  if (!months || months <= 0) return "Não informado";
  if (months < 12) return months === 1 ? "1 mês" : `${months} meses`;
  const anos = Math.floor(months / 12);
  const resto = months % 12;
  const anosStr = anos === 1 ? "1 ano" : `${anos} anos`;
  if (resto === 0) return anosStr;
  return `${anosStr} e ${resto}m`;
}

/** Limpa e padroniza nomes de empresas comuns no Ceará/Brasil para consolidação. */
export function normalizeCompanyName(raw: string): string {
  const clean = raw
    .replace(/[•\-\*]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const lower = clean.toLowerCase();
  if (lower.includes("atacadão") || lower.includes("atacadao")) return "Atacadão";
  if (lower.includes("assaí") || lower.includes("assai")) return "Assaí Atacadista";
  if (lower.includes("carrefour")) return "Carrefour";
  if (lower.includes("pague menos")) return "Farmácias Pague Menos";
  if (lower.includes("são geraldo") || lower.includes("sao geraldo")) return "Refrigerantes São Geraldo";
  if (lower.includes("são luiz") || lower.includes("sao luiz")) return "Mercadinhos São Luiz";
  if (lower.includes("cometa")) return "Cometa Supermercados";
  if (lower.includes("pinheiro")) return "Supermercado Pinheiro";
  if (lower.includes("casas bahia")) return "Casas Bahia";
  if (lower.includes("magazine luiza") || lower.includes("magalu")) return "Magazine Luiza";
  if (lower.includes("m. dias branco") || lower.includes("dias branco")) return "M. Dias Branco";
  if (lower.includes("solar coca") || lower.includes("coca-cola")) return "Solar Coca-Cola";
  if (lower.includes("hapvida")) return "Hapvida";
  if (lower.includes("riachuelo")) return "Riachuelo";
  if (lower.includes("c&a")) return "C&A";
  if (lower.includes("renner")) return "Lojas Renner";
  if (lower.includes("ambev")) return "Ambev";
  if (lower.includes("natura")) return "Natura";
  if (lower.includes("avon")) return "Avon";

  return clean.slice(0, 35);
}

export type RawCandidateForDashboard = {
  id: string;
  candidateId?: string | null;
  cpf?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  photoUrl?: string | null;
  resumeUrl?: string | null;
  resumeText?: string | null;
  birthDate?: string | Date | null;
  age?: number | null;
  city?: string | null;
  neighborhood?: string | null;
  aiProfile?: string | null;
  aiArea?: string | null;
  aiLevel?: string | null;
  aiScore?: number | null;
  aiTenure?: unknown;
  skills?: string[];
  createdAt: Date | string;
};

/**
 * Seleciona o melhor registro entre candidaturas da mesma pessoa:
 * 1. Quem tem currículo em anexo/PDF ganha.
 * 2. Quem tem maior score IA ganha.
 * 3. Quem tem análise de histórico de empresas (tenure) ganha.
 * 4. Perfil mais específico ganha contra genérico (ex: "Promotor de Vendas" > "Função Operacional").
 * 5. Candidatura mais recente como desempate.
 */
function betterRawCandidate(a: RawCandidateForDashboard, b: RawCandidateForDashboard): RawCandidateForDashboard {
  if (Boolean(a.resumeUrl) !== Boolean(b.resumeUrl)) {
    return a.resumeUrl ? a : b;
  }
  const sa = a.aiScore ?? -1;
  const sb = b.aiScore ?? -1;
  if (sa !== sb) return sa > sb ? a : b;

  const tenureA = parseTenureAnalysis(a.aiTenure);
  const tenureB = parseTenureAnalysis(b.aiTenure);
  const hasTenureA = Boolean(tenureA && tenureA.empresas.length > 0);
  const hasTenureB = Boolean(tenureB && tenureB.empresas.length > 0);
  if (hasTenureA !== hasTenureB) return hasTenureA ? a : b;

  const isGenericA = !a.aiProfile || a.aiProfile.toLowerCase().includes("operacional");
  const isGenericB = !b.aiProfile || b.aiProfile.toLowerCase().includes("operacional");
  if (isGenericA !== isGenericB) return isGenericA ? b : a;

  const tA = new Date(a.createdAt).getTime();
  const tB = new Date(b.createdAt).getTime();
  return tA >= tB ? a : b;
}

/**
 * Deduplica registros da base de talentos para que uma mesma pessoa física
 * (mesmo CPF, candidateId, e-mail, telefone, arquivo de currículo ou nome completo)
 * apareça estritamente uma única vez nas estatísticas e no ranking de talentos.
 */
export function dedupeRawCandidatesByPerson(
  candidates: RawCandidateForDashboard[]
): RawCandidateForDashboard[] {
  const n = candidates.length;
  if (n <= 1) return candidates;

  const parent = Array.from({ length: n }, (_, i) => i);
  function find(i: number): number {
    if (parent[i] === i) return i;
    parent[i] = find(parent[i]);
    return parent[i];
  }
  function union(i: number, j: number) {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) parent[rootI] = rootJ;
  }

  const keyToIdx = new Map<string, number>();

  for (let i = 0; i < n; i++) {
    const c = candidates[i];
    const keys: string[] = [];

    if (c.candidateId && typeof c.candidateId === "string" && c.candidateId.trim()) {
      keys.push(`cand:${c.candidateId.trim()}`);
    }
    const cpfDigits = cleanDigits(c.cpf);
    if (cpfDigits.length >= 11) {
      keys.push(`cpf:${cpfDigits}`);
    }
    const email = cleanEmail(c.email);
    if (email) {
      keys.push(`email:${email}`);
    }
    const phoneDigits = cleanDigits(c.phone);
    if (phoneDigits.length >= 10) {
      keys.push(`phone:${phoneDigits.slice(-10)}`);
    }
    if (c.resumeUrl && typeof c.resumeUrl === "string" && c.resumeUrl.trim()) {
      keys.push(`resume:${c.resumeUrl.trim().toLowerCase()}`);
    }
    const name = cleanName(c.name);
    if (name) {
      keys.push(`name:${name}`);
    }

    if (keys.length === 0) {
      keys.push(`id:${c.id}`);
    }

    for (const k of keys) {
      const existing = keyToIdx.get(k);
      if (existing !== undefined) {
        union(i, existing);
      } else {
        keyToIdx.set(k, i);
      }
    }
  }

  const groups = new Map<number, RawCandidateForDashboard[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(candidates[i]);
  }

  const result: RawCandidateForDashboard[] = [];
  for (const group of groups.values()) {
    let best = group[0];
    for (let j = 1; j < group.length; j++) {
      best = betterRawCandidate(best, group[j]);
    }

    let merged: RawCandidateForDashboard = { ...best };
    for (const item of group) {
      if (item === best) continue;
      merged = {
        ...merged,
        candidateId: merged.candidateId || item.candidateId,
        cpf: merged.cpf || item.cpf,
        photoUrl: merged.photoUrl || item.photoUrl,
        resumeUrl: merged.resumeUrl || item.resumeUrl,
        resumeText:
          merged.resumeText && merged.resumeText.length >= (item.resumeText?.length ?? 0)
            ? merged.resumeText
            : item.resumeText || merged.resumeText,
        phone: merged.phone || item.phone,
        email: merged.email || item.email,
        birthDate: merged.birthDate || item.birthDate,
        age: merged.age ?? item.age,
        city: merged.city || item.city,
        neighborhood: merged.neighborhood || item.neighborhood,
        aiProfile:
          merged.aiProfile && !merged.aiProfile.toLowerCase().includes("operacional")
            ? merged.aiProfile
            : item.aiProfile || merged.aiProfile,
        aiArea: merged.aiArea || item.aiArea,
        aiLevel: merged.aiLevel || item.aiLevel,
        aiTenure: merged.aiTenure || item.aiTenure,
        skills: Array.from(new Set([...(merged.skills || []), ...(item.skills || [])])),
      };
    }
    result.push(merged);
  }

  return result;
}

/**
 * Constrói os dados do dashboard analítico de talentos a partir das candidaturas da empresa.
 * Garante que a base seja deduplicada por pessoa física para evitar distorções nas métricas.
 */
export function buildTalentDashboardData(
  companyName: string,
  rawCandidates: RawCandidateForDashboard[]
): TalentDashboardData {
  const candidates = dedupeRawCandidatesByPerson(rawCandidates);
  const total = candidates.length;

  let femaleCount = 0;
  let maleCount = 0;
  let unspecifiedGenderCount = 0;

  const validAges: number[] = [];
  const ageBracketsCount = {
    "< 20 anos": 0,
    "20 a 24 anos": 0,
    "25 a 34 anos": 0,
    "35 a 44 anos": 0,
    "45 a 54 anos": 0,
    "55+ anos": 0,
    "Não informada": 0,
  };

  const roleMap = new Map<string, number>();
  const areaMap = new Map<string, number>();
  const levelMap = new Map<string, number>();
  const companyMap = new Map<string, number>();

  let withPhoto = 0;
  let withPdf = 0;
  let totalScoreSum = 0;
  let totalScoreCount = 0;
  let topMatchesCount = 0;
  let totalTenureMonthsSum = 0;
  let totalTenureCount = 0;

  const scoreBandsCount = {
    "80–100% (Top Match)": 0,
    "60–79% (Bom Potencial)": 0,
    "40–59% (Regular)": 0,
    "0–39% (Baixa Aderência)": 0,
  };

  const candidateHighlights: HighlightCandidate[] = [];

  for (const c of candidates) {
    if (c.photoUrl) withPhoto++;
    if (c.resumeUrl) withPdf++;

    // 1. Gênero
    const gender = inferGender(c.name, c.resumeText);
    if (gender === "Feminino") femaleCount++;
    else if (gender === "Masculino") maleCount++;
    else unspecifiedGenderCount++;

    // 2. Idade
    const effectiveBirthDate = c.birthDate ?? extractBirthDateFromText(c.resumeText);
    const age = c.age ?? (effectiveBirthDate ? calculateAge(effectiveBirthDate) : extractAgeFromText(c.resumeText));
    if (age !== null && age >= 14 && age <= 90) {
      validAges.push(age);
      if (age < 20) ageBracketsCount["< 20 anos"]++;
      else if (age <= 24) ageBracketsCount["20 a 24 anos"]++;
      else if (age <= 34) ageBracketsCount["25 a 34 anos"]++;
      else if (age <= 44) ageBracketsCount["35 a 44 anos"]++;
      else if (age <= 54) ageBracketsCount["45 a 54 anos"]++;
      else ageBracketsCount["55+ anos"]++;
    } else {
      ageBracketsCount["Não informada"]++;
    }

    // 3. Cargos e Áreas
    const role = c.aiProfile?.trim() || "Função Operacional";
    roleMap.set(role, (roleMap.get(role) || 0) + 1);

    const area = c.aiArea?.trim() || "Outras";
    areaMap.set(area, (areaMap.get(area) || 0) + 1);

    const level = c.aiLevel?.trim() || "Operacional";
    levelMap.set(level, (levelMap.get(level) || 0) + 1);

    // 4. Scores
    if (typeof c.aiScore === "number" && !isNaN(c.aiScore)) {
      totalScoreSum += c.aiScore;
      totalScoreCount++;
      if (c.aiScore >= 80) {
        topMatchesCount++;
        scoreBandsCount["80–100% (Top Match)"]++;
      } else if (c.aiScore >= 60) {
        scoreBandsCount["60–79% (Bom Potencial)"]++;
      } else if (c.aiScore >= 40) {
        scoreBandsCount["40–59% (Regular)"]++;
      } else {
        scoreBandsCount["0–39% (Baixa Aderência)"]++;
      }
    }

    // 5. Empresas e Estabilidade
    let topCandidateCompany: string | null = null;
    let candidateAvgMonths: number | null = null;

    const parsedTenure = parseTenureAnalysis(c.aiTenure);
    if (parsedTenure && parsedTenure.empresas.length > 0) {
      if (parsedTenure.tempoMedioMeses > 0) {
        totalTenureMonthsSum += parsedTenure.tempoMedioMeses;
        totalTenureCount++;
        candidateAvgMonths = parsedTenure.tempoMedioMeses;
      }
      for (const emp of parsedTenure.empresas) {
        if (emp.empresa && emp.empresa !== "Empresa não informada") {
          const norm = normalizeCompanyName(emp.empresa);
          companyMap.set(norm, (companyMap.get(norm) || 0) + 1);
          if (!topCandidateCompany) topCandidateCompany = norm;
        }
      }
    }

    // Localização formatada
    const loc = [c.neighborhood, c.city].filter(Boolean).join(", ") || "Fortaleza / CE";

    candidateHighlights.push({
      id: c.id,
      name: toPdfSafeText(titleCasePt(c.name)),
      gender,
      age: age ?? null,
      role: toPdfSafeText(role),
      area: toPdfSafeText(area),
      level: toPdfSafeText(level),
      score: c.aiScore ?? null,
      location: toPdfSafeText(loc),
      topCompany: topCandidateCompany ? toPdfSafeText(topCandidateCompany) : null,
      tenureFormatted: formatMonths(candidateAvgMonths),
      skills: Array.isArray(c.skills) ? c.skills.slice(0, 3).map(toPdfSafeText) : [],
    });
  }

  // Ordena os destaques pelo maior score IA e quem tem experiência
  candidateHighlights.sort((a, b) => {
    const sA = a.score ?? -1;
    const sB = b.score ?? -1;
    return sB - sA;
  });

  // Cálculo de idade
  validAges.sort((a, b) => a - b);
  const ageMean = validAges.length > 0 ? Math.round(validAges.reduce((a, b) => a + b, 0) / validAges.length) : null;
  const ageMedian =
    validAges.length > 0
      ? validAges.length % 2 === 0
        ? Math.round((validAges[validAges.length / 2 - 1] + validAges[validAges.length / 2]) / 2)
        : validAges[Math.floor(validAges.length / 2)]
      : null;

  const toPct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

  // Rankings e top listas
  const sortMapToCountPct = (m: Map<string, number>, limit = 8): CountWithPct[] => {
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([label, count]) => ({
        label: toPdfSafeText(label),
        count,
        pct: toPct(count, total),
      }));
  };

  const topCompanies = sortMapToCountPct(companyMap, 8);
  const avgTenure = totalTenureCount > 0 ? Math.round(totalTenureMonthsSum / totalTenureCount) : null;

  // Garante que a lista de destaques nunca repita a mesma pessoa
  const uniqueHighlights: HighlightCandidate[] = [];
  const seenHighlightKeys = new Set<string>();
  for (const h of candidateHighlights) {
    const norm = cleanName(h.name) || h.name.toLowerCase().trim();
    if (seenHighlightKeys.has(norm)) continue;
    seenHighlightKeys.add(norm);
    uniqueHighlights.push(h);
    if (uniqueHighlights.length >= 15) break;
  }

  return {
    generatedAt: new Date(),
    companyName: toPdfSafeText(companyName),
    totals: {
      candidates: total,
      withPhoto,
      withPhotoPct: toPct(withPhoto, total),
      withPdf,
      withPdfPct: toPct(withPdf, total),
      analyzed: totalScoreCount,
      analyzedPct: toPct(totalScoreCount, total),
      avgScore: totalScoreCount > 0 ? Math.round(totalScoreSum / totalScoreCount) : null,
      topMatchesCount,
      topMatchesPct: toPct(topMatchesCount, total),
    },
    gender: {
      female: { count: femaleCount, pct: toPct(femaleCount, total) },
      male: { count: maleCount, pct: toPct(maleCount, total) },
      unspecified: { count: unspecifiedGenderCount, pct: toPct(unspecifiedGenderCount, total) },
      total,
    },
    age: {
      mean: ageMean,
      median: ageMedian,
      min: validAges.length > 0 ? validAges[0] : null,
      max: validAges.length > 0 ? validAges[validAges.length - 1] : null,
      brackets: Object.entries(ageBracketsCount).map(([label, count]) => ({
        label,
        count,
        pct: toPct(count, total),
      })),
      totalWithAge: validAges.length,
    },
    roles: sortMapToCountPct(roleMap, 8),
    areas: sortMapToCountPct(areaMap, 6),
    levels: sortMapToCountPct(levelMap, 5),
    companies: {
      topCompanies,
      totalCompaniesRecorded: companyMap.size,
      avgTenureMonths: avgTenure,
      avgTenureFormatted: formatMonths(avgTenure),
    },
    scoreBands: Object.entries(scoreBandsCount).map(([label, count]) => ({
      label,
      count,
      pct: toPct(count, total),
    })),
    highlights: uniqueHighlights,
  };
}

