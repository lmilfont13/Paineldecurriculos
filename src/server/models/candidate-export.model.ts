/**
 * Planilha "todos os cadastrados" (sem I/O): transforma as candidaturas da
 * empresa em três visões — pessoas, candidaturas e resumo.
 *
 * Fica de fora, de propósito: RG, CPF, PcD, dados bancários e de uniforme,
 * notas internas, justificativa da IA e texto do currículo. A planilha sai do
 * sistema e circula; só leva o que serve para organizar e contatar.
 */
import { appStatusLabels, profileChoiceLabel, type AppStatusKey } from "@/server/models/application.model";
import { sourceLabel } from "@/server/models/attribution.model";
import { titleCasePt } from "@/server/models/text.model";

export type ExportApplication = {
  id: string;
  candidateId: string | null;
  name: string;
  email: string;
  phone: string | null;
  birthDate: Date | null;
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  desiredRole: string | null;
  salaryExpectation: string | null;
  workPreference: string | null;
  availability: string | null;
  hasCnh: string | null;
  source: string | null;
  status: AppStatusKey;
  aiState: string;
  aiScore: number | null;
  aiArea: string | null;
  aiLevel: string | null;
  hasImpediment: boolean;
  consentAt: Date | null;
  createdAt: Date;
  interviewAt: Date | null;
  interviewMode: string | null;
  job: { title: string; code: string | null; aiMinScore: number | null; isTalentPool: boolean };
};

export type ExportPerson = {
  name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  neighborhood: string;
  birthDate: Date | null;
  age: number | null;
  desiredRole: string;
  salaryExpectation: string;
  availability: string;
  workPreference: string;
  cnh: string;
  applications: number;
  jobs: string;
  currentStage: string;
  bestScore: number | null;
  aiArea: string;
  aiLevel: string;
  source: string;
  firstSeen: Date;
  lastApplied: Date;
  impediment: string;
  consent: string;
};

export type ExportApplicationRow = {
  name: string;
  email: string;
  phone: string;
  job: string;
  jobCode: string;
  stage: string;
  score: number | null;
  minScore: number | null;
  meetsMinimum: string;
  aiArea: string;
  aiLevel: string;
  source: string;
  appliedOn: Date | null;
  interviewOn: Date | null;
  interviewMode: string;
  impediment: string;
};

export type ExportCount = { label: string; count: number };

export type CandidateExport = {
  people: ExportPerson[];
  applications: ExportApplicationRow[];
  summary: { people: number; applications: number; byStage: ExportCount[]; byJob: ExportCount[] };
};

const TALENT_POOL_LABEL = "Banco de talentos";
const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });

const spDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Dia do calendário de São Paulo, como data pura (meia-noite UTC) para o Excel. */
function saoPauloDay(date: Date | null): Date | null {
  if (!date) return null;
  return new Date(`${spDay.format(date)}T00:00:00.000Z`);
}

/** Data pura já gravada à meia-noite UTC (nascimento): só zera a hora. */
function pureDay(date: Date | null): Date | null {
  if (!date || Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function ageOn(birth: Date | null, now: Date): number | null {
  if (!birth) return null;
  const today = saoPauloDay(now)!;
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    today.getUTCMonth() < birth.getUTCMonth() ||
    (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age--;
  return age >= 14 && age <= 100 ? age : null;
}

function jobLabel(job: ExportApplication["job"]): string {
  if (job.isTalentPool) return TALENT_POOL_LABEL;
  return job.code ? `${job.title} (${job.code})` : job.title;
}

const clean = (value: string | null | undefined) => (value ?? "").trim();

/** Primeiro valor preenchido, da candidatura mais recente para a mais antiga. */
function latest<T>(apps: ExportApplication[], pick: (a: ExportApplication) => T | null | undefined | ""): T | null {
  for (const a of apps) {
    const v = pick(a);
    if (v !== null && v !== undefined && v !== "") return v as T;
  }
  return null;
}

export function buildCandidateExport(apps: ExportApplication[], now: Date = new Date()): CandidateExport {
  const groups = new Map<string, ExportApplication[]>();
  for (const a of apps) {
    const key = a.candidateId ? `c:${a.candidateId}` : `e:${a.email.trim().toLowerCase()}`;
    const list = groups.get(key);
    if (list) list.push(a);
    else groups.set(key, [a]);
  }

  const people: ExportPerson[] = [];
  for (const list of groups.values()) {
    list.sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime()); // mais recente primeiro
    const newest = list[0];
    const birthDate = pureDay(latest(list, (a) => a.birthDate));
    const scores = list.map((a) => a.aiScore).filter((s): s is number => typeof s === "number");
    const jobs = [...new Set(list.map((a) => jobLabel(a.job)))];
    const pick = (kind: "workPreference" | "availability" | "hasCnh") =>
      profileChoiceLabel(kind, latest(list, (a) => clean(a[kind])) ?? "");
    people.push({
      name: titleCasePt(clean(newest.name)),
      email: clean(newest.email).toLowerCase(),
      phone: latest(list, (a) => clean(a.phone)) ?? "",
      city: latest(list, (a) => clean(a.city)) ?? "",
      state: (latest(list, (a) => clean(a.state)) ?? "").toUpperCase(),
      neighborhood: latest(list, (a) => clean(a.neighborhood)) ?? "",
      birthDate,
      age: ageOn(birthDate, now),
      desiredRole: latest(list, (a) => clean(a.desiredRole)) ?? "",
      salaryExpectation: latest(list, (a) => clean(a.salaryExpectation)) ?? "",
      availability: pick("availability"),
      workPreference: pick("workPreference"),
      cnh: pick("hasCnh"),
      applications: list.length,
      jobs: jobs.join("; "),
      currentStage: appStatusLabels[newest.status],
      bestScore: scores.length > 0 ? Math.max(...scores) : null,
      aiArea: latest(list, (a) => clean(a.aiArea)) ?? "",
      aiLevel: latest(list, (a) => clean(a.aiLevel)) ?? "",
      source: sourceLabel(list[list.length - 1].source), // por onde chegou da primeira vez
      firstSeen: saoPauloDay(list[list.length - 1].createdAt)!,
      lastApplied: saoPauloDay(newest.createdAt)!,
      impediment: list.some((a) => a.hasImpediment) ? "Sim" : "",
      consent: list.some((a) => a.consentAt) ? "Sim" : "Não",
    });
  }
  people.sort((a, b) => collator.compare(a.name, b.name) || collator.compare(a.email, b.email));

  const applications: ExportApplicationRow[] = apps
    .map((a) => {
      const min = a.job.isTalentPool ? null : a.job.aiMinScore;
      return {
        name: titleCasePt(clean(a.name)),
        email: clean(a.email).toLowerCase(),
        phone: clean(a.phone),
        job: a.job.isTalentPool ? TALENT_POOL_LABEL : a.job.title,
        jobCode: a.job.isTalentPool ? "" : clean(a.job.code),
        stage: appStatusLabels[a.status],
        score: a.aiScore,
        minScore: min,
        meetsMinimum: a.aiScore === null || min === null ? "" : a.aiScore >= min ? "Sim" : "Não",
        aiArea: clean(a.aiArea),
        aiLevel: clean(a.aiLevel),
        source: sourceLabel(a.source),
        appliedOn: saoPauloDay(a.createdAt),
        interviewOn: saoPauloDay(a.interviewAt),
        interviewMode: clean(a.interviewMode),
        impediment: a.hasImpediment ? "Sim" : "",
      };
    })
    .sort(
      (a, b) =>
        collator.compare(a.job, b.job) ||
        collator.compare(a.jobCode, b.jobCode) ||
        (b.score ?? -1) - (a.score ?? -1) ||
        collator.compare(a.name, b.name)
    );

  const byStage = (Object.keys(appStatusLabels) as AppStatusKey[]).map((status) => ({
    label: appStatusLabels[status],
    count: apps.filter((a) => a.status === status).length,
  }));
  const jobCounts = new Map<string, number>();
  for (const a of apps) jobCounts.set(jobLabel(a.job), (jobCounts.get(jobLabel(a.job)) ?? 0) + 1);
  const byJob = [...jobCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || collator.compare(a.label, b.label));

  return { people, applications, summary: { people: people.length, applications: apps.length, byStage, byJob } };
}

/** "cadastrados-tarhget-2026-11-11.xlsx" */
export function exportFileName(companyName: string, now: Date = new Date()): string {
  const slug = companyName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `cadastrados-${slug ? `${slug}-` : ""}${spDay.format(now)}.xlsx`;
}
