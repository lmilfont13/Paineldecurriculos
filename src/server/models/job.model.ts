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

/** Quebra o campo `requirements` (texto livre) em bullets, uma por linha. */
export function requirementsToBullets(requirements: string | null): string[] {
  if (!requirements) return [];
  return requirements
    .split("\n")
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter((line) => line.length > 0);
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
