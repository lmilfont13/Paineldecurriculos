import type { Contract, Job, JobStatus, WorkMode } from "@prisma/client";
import { z } from "zod";

export const jobFormSchema = z.object({
  code: z.string().trim().max(30, "Código muito longo.").optional().default(""),
  title: z.string().min(3, "Informe o título da vaga."),
  description: z.string().min(10, "Descreva a vaga."),
  requirements: z.string().optional().default(""),
  location: z.string().optional().default(""),
  contract: z.enum(["CLT", "PJ", "FREELANCE", "INTERNSHIP"]),
  workMode: z.enum(["REMOTE", "HYBRID", "ONSITE"]),
  aiCriteria: z.array(z.string().min(1)).max(10),
  aiMinScore: z.number().int().min(0).max(100),
});

export type JobFormInput = z.infer<typeof jobFormSchema>;

/** Projeção pública da vaga — o que o candidato vê. */
export type PublicJob = Pick<
  Job,
  | "id"
  | "code"
  | "title"
  | "description"
  | "requirements"
  | "location"
  | "contract"
  | "workMode"
  | "createdAt"
  | "isTalentPool"
>;

export function toPublicJob(job: Job): PublicJob {
  return {
    id: job.id,
    code: job.code,
    title: job.title,
    description: job.description,
    requirements: job.requirements,
    location: job.location,
    contract: job.contract,
    workMode: job.workMode,
    // Para quem lê a vaga, a data que importa é quando ela entrou no ar.
    createdAt: job.publishedAt ?? job.createdAt,
    isTalentPool: job.isTalentPool,
  };
}

export const contractLabels: Record<Contract, string> = {
  CLT: "CLT",
  PJ: "PJ",
  FREELANCE: "Freelance",
  INTERNSHIP: "Estágio",
};

export const workModeLabels: Record<WorkMode, string> = {
  REMOTE: "Remoto",
  HYBRID: "Híbrido",
  ONSITE: "Presencial",
};

export const jobStatusLabels: Record<JobStatus, string> = {
  DRAFT: "Rascunho",
  OPEN: "Aberta",
  PAUSED: "Pausada",
  CLOSED: "Encerrada",
};

/** Vaga na lista do gestor (E2), com contagens. */
export type ManagerJob = PublicJob &
  Pick<Job, "status" | "aiCriteria" | "aiMinScore"> & {
    applicationCount: number;
    pendingCount: number;
  };

/**
 * Meta da vaga no padrão do design:
 * com localização → "Fortaleza, CE · Híbrido"; sem → "Remoto · CLT".
 */
export function formatJobMeta(job: PublicJob): string {
  if (job.location) {
    return `${job.location} · ${workModeLabels[job.workMode]}`;
  }
  return `${workModeLabels[job.workMode]} · ${contractLabels[job.contract]}`;
}

/** "publicada hoje" / "publicada há 1 dia" / "publicada há N dias". */
export function formatPublishedAgo(createdAt: Date): string {
  const days = Math.floor(
    (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days <= 0) return "publicada hoje";
  if (days === 1) return "publicada há 1 dia";
  return `publicada há ${days} dias`;
}

export const TEMPORARY_JOB_MARKER = "[VAGA_TEMPORARIA]";

/** Verifica se a vaga foi marcada como temporária pelo gestor ou no tipo/texto da vaga. */
export function isTemporaryJob(
  job: Pick<PublicJob, "title" | "description" | "requirements" | "contract">
): boolean {
  if (job.contract === "FREELANCE") return true;
  if ((job.requirements ?? "").includes(TEMPORARY_JOB_MARKER)) return true;
  if ((job.description ?? "").includes(TEMPORARY_JOB_MARKER)) return true;
  const text = `${job.title} ${job.description ?? ""} ${job.requirements ?? ""}`;
  return /\b(vaga\s+tempor[aá]ria|contrato\s+tempor[aá]rio|tempor[aá]ri[oa])\b/i.test(text);
}

/** Remove o marcador interno de vaga temporária para exibição limpa em formulários. */
export function stripTemporaryJobMarker(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .split("\n")
    .filter((line) => line.trim() !== TEMPORARY_JOB_MARKER)
    .join("\n")
    .trim();
}

/** Aplica ou remove o marcador de vaga temporária no texto de requisitos salvo no banco. */
export function withTemporaryJobMarker(
  requirements: string | null | undefined,
  isTemporary: boolean
): string {
  const clean = stripTemporaryJobMarker(requirements);
  if (!isTemporary) return clean;
  return clean ? `${TEMPORARY_JOB_MARKER}\n${clean}` : TEMPORARY_JOB_MARKER;
}

/** Quebra o campo `requirements` (texto livre) em bullets, uma por linha. */
export function requirementsToBullets(requirements: string | null): string[] {
  if (!requirements) return [];
  return requirements
    .split("\n")
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter((line) => line.length > 0 && line !== TEMPORARY_JOB_MARKER);
}

const normalizeJobText = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/**
 * Vaga que já existe e se confunde com a nova: mesmo código, ou mesmo cargo na
 * mesma cidade. Encerradas não contam; `ignoreId` é a própria vaga em edição.
 */
export function findDuplicateJob<
  T extends Pick<Job, "id" | "title" | "code" | "location" | "status">,
>(
  jobs: T[],
  input: { title: string; location?: string | null; code?: string | null },
  ignoreId?: string
): T | null {
  const code = normalizeJobText(input.code);
  const title = normalizeJobText(input.title);
  const location = normalizeJobText(input.location);
  return (
    jobs.find((j) => {
      if (j.id === ignoreId || j.status === "CLOSED") return false;
      if (code && normalizeJobText(j.code) === code) return true;
      return normalizeJobText(j.title) === title && normalizeJobText(j.location) === location;
    }) ?? null
  );
}

/** Separa cargo e praça/cidade do título da vaga para dar destaque visual à filial/cidade. */
export function parseJobTitleAndCity(title: string): { role: string; city: string | null } {
  const trimmed = title.trim();
  // Remove código da vaga no final caso já venha formatado como "Cargo (Cidade) #1123"
  const withoutCode = trimmed.replace(/\s*#\w+\s*$/, "");
  const match = withoutCode.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (!match) return { role: withoutCode, city: null };

  const inside = match[2].trim();
  // Se for apenas flexão de gênero como (a), (o), (a/o), (m/f), faz parte do cargo
  if (/^(a|o|a\/o|o\/a|as|os|m\/f)$/i.test(inside)) {
    return { role: withoutCode, city: null };
  }

  return { role: match[1].trim(), city: inside };
}

export const JOB_ACCENT_THEMES = [
  {
    key: "indigo",
    bar: "bg-indigo-600",
    code: "bg-indigo-600 text-white",
    cityTag: "border-indigo-300 bg-indigo-100 text-indigo-950 font-bold",
    border: "border-indigo-200/90",
    bg: "bg-indigo-50/20",
    sectionBorder: "border-indigo-200/90",
    sectionBg: "bg-indigo-50/20",
    countBadge: "border-indigo-200 bg-white text-indigo-800",
  },
  {
    key: "emerald",
    bar: "bg-emerald-600",
    code: "bg-emerald-600 text-white",
    cityTag: "border-emerald-300 bg-emerald-100 text-emerald-950 font-bold",
    border: "border-emerald-200/90",
    bg: "bg-emerald-50/20",
    sectionBorder: "border-emerald-200/90",
    sectionBg: "bg-emerald-50/20",
    countBadge: "border-emerald-200 bg-white text-emerald-800",
  },
  {
    key: "amber",
    bar: "bg-amber-600",
    code: "bg-amber-600 text-white",
    cityTag: "border-amber-300 bg-amber-100 text-amber-950 font-bold",
    border: "border-amber-200/90",
    bg: "bg-amber-50/20",
    sectionBorder: "border-amber-200/90",
    sectionBg: "bg-amber-50/20",
    countBadge: "border-amber-200 bg-white text-amber-900",
  },
  {
    key: "violet",
    bar: "bg-violet-600",
    code: "bg-violet-600 text-white",
    cityTag: "border-violet-300 bg-violet-100 text-violet-950 font-bold",
    border: "border-violet-200/90",
    bg: "bg-violet-50/20",
    sectionBorder: "border-violet-200/90",
    sectionBg: "bg-violet-50/20",
    countBadge: "border-violet-200 bg-white text-violet-800",
  },
  {
    key: "teal",
    bar: "bg-teal-600",
    code: "bg-teal-600 text-white",
    cityTag: "border-teal-300 bg-teal-100 text-teal-950 font-bold",
    border: "border-teal-200/90",
    bg: "bg-teal-50/20",
    sectionBorder: "border-teal-200/90",
    sectionBg: "bg-teal-50/20",
    countBadge: "border-teal-200 bg-white text-teal-800",
  },
  {
    key: "rose",
    bar: "bg-rose-600",
    code: "bg-rose-600 text-white",
    cityTag: "border-rose-300 bg-rose-100 text-rose-950 font-bold",
    border: "border-rose-200/90",
    bg: "bg-rose-50/20",
    sectionBorder: "border-rose-200/90",
    sectionBg: "bg-rose-50/20",
    countBadge: "border-rose-200 bg-white text-rose-800",
  },
  {
    key: "sky",
    bar: "bg-sky-600",
    code: "bg-sky-600 text-white",
    cityTag: "border-sky-300 bg-sky-100 text-sky-950 font-bold",
    border: "border-sky-200/90",
    bg: "bg-sky-50/20",
    sectionBorder: "border-sky-200/90",
    sectionBg: "bg-sky-50/20",
    countBadge: "border-sky-200 bg-white text-sky-800",
  },
] as const;

/** Retorna a paleta consistente por ID ou por índice da vaga */
export function getJobAccentTheme(indexOrId: number | string) {
  if (typeof indexOrId === "number") {
    return JOB_ACCENT_THEMES[Math.abs(indexOrId) % JOB_ACCENT_THEMES.length];
  }
  let hash = 0;
  for (let i = 0; i < indexOrId.length; i++) {
    hash = (hash << 5) - hash + indexOrId.charCodeAt(i);
    hash |= 0;
  }
  return JOB_ACCENT_THEMES[Math.abs(hash) % JOB_ACCENT_THEMES.length];
}
