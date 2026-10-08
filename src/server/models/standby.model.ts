/**
 * Stand-by do banco de talentos: quais candidatos guardados vale analisar
 * para uma vaga (e vice-versa) e o convite pelo WhatsApp. Funções puras —
 * testadas em standby.model.test.ts.
 */

/** Quantas análises por rodada (cabem no tempo da função). */
export const STANDBY_JOB_LIMIT = 8;
export const STANDBY_CANDIDATE_JOBS_LIMIT = 5;

const STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "e", "em", "com", "para", "por", "a", "o", "as", "os",
  "um", "uma", "no", "na", "nos", "nas", "ou", "the", "vaga", "experiencia", "conhecimento",
]);

/** Palavras significativas, sem acento, com radical curto (vendas ≈ vendedor). */
export function keywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
      .map((w) => w.slice(0, 5))
  );
}

/** Quanto o perfil guardado conversa com a vaga (palavras em comum). */
export function relevance(
  job: { title: string; aiCriteria: string[]; requirements?: string | null },
  profile: { aiProfile: string | null; aiArea: string | null; folderNames: string[] }
): number {
  const jobWords = keywords([job.title, ...job.aiCriteria, job.requirements ?? ""].join(" "));
  const titleWords = keywords(job.title);
  const profileWords = keywords(
    [profile.aiProfile ?? "", profile.aiArea ?? "", ...profile.folderNames].join(" ")
  );
  let score = 0;
  for (const w of profileWords) {
    if (titleWords.has(w)) score += 2; // bater no título pesa mais
    else if (jobWords.has(w)) score += 1;
  }
  return score;
}

/**
 * Escolhe quem analisar: os mais parecidos primeiro. Com pouca gente, analisa
 * todo mundo; com muita, só quem tem alguma palavra em comum.
 */
export function pickByRelevance<T>(items: { item: T; relevance: number }[], limit: number): T[] {
  const sorted = [...items].sort((a, b) => b.relevance - a.relevance);
  const pool = sorted.length <= limit ? sorted : sorted.filter((x) => x.relevance > 0);
  return pool.slice(0, limit).map((x) => x.item);
}

/** Telefone brasileiro para o wa.me (só dígitos, com 55). */
export function whatsappNumber(phone: string | null | undefined): string | null {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  return null;
}

/** Link do WhatsApp com o convite pronto para a vaga parecida. */
export function whatsappInvite(params: {
  phone: string | null | undefined;
  name: string;
  company: string;
  jobTitle: string;
  url: string;
}): string | null {
  const number = whatsappNumber(params.phone);
  if (!number) return null;
  const first = params.name.trim().split(/\s+/)[0] ?? "";
  const text =
    `Oi, ${first}! Aqui é da ${params.company}. Guardamos seu currículo e abrimos uma vaga ` +
    `que combina com o seu perfil: ${params.jobTitle}. Se tiver interesse, é só se candidatar por aqui: ${params.url}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

/** Na análise de perfil, quantas vagas abertas comparar. */
export const CAREER_JOBS_LIMIT = 3;
