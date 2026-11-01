import { loadJobReportData } from "@/server/services/report.service";
import { loadPortfolioReportData } from "@/server/services/portfolio.service";
import { titleCasePt } from "@/server/models/text.model";
import "server-only";

import { cache } from "react";

import { requireManager } from "@/server/controllers/guards";
import type {
  DashboardStats,
  JobProgress,
  PriorityApplication,
} from "@/server/models/dashboard.model";
import {
  countPendingApplications,
  getCompanyApplication,
  getOtherApplicationsOfPerson,
  listCompanyApplications,
  listApplicationsForCvSearch,
  listCompanyApplicantAges,
  listJobApplicantAges,
} from "@/server/services/application.service";
import {
  calculateAge,
  extractBirthDateFromText,
  extractAgeFromText,
  extractNeighborhoodFromText,
  extractCandidateSkills,
  type CandidateCvCard,
} from "@/server/models/cv-search.model";
import { withPhotoUrls } from "@/server/services/resume-photo.service";
import { getStandbyForJob } from "@/server/services/talent.service";
import { getCompanyById } from "@/server/services/company.service";
import {
  getJobQuestions,
  listApplicationFormFields,
} from "@/server/services/form.service";
import { getDashboard } from "@/server/services/dashboard.service";
import { getCompanyJob, listCompanyJobs } from "@/server/services/job.service";
import { appUrl } from "@/lib/env";
import { effectiveAge } from "@/server/models/age.model";

/** Dados do shell do gestor (sidebar/topbar) — 1x por request. */
export const getGestorShell = cache(async () => {
  const user = await requireManager();
  // Sequencial: com connection_limit=1 o Promise.all só enfileira na
  // mesma conexão e aumenta o risco de P2024 (pool_timeout).
  const company = await getCompanyById(user.companyId);
  const pendingCount = await countPendingApplications(user.companyId);
  if (!company) throw new Error("Empresa da sessão não encontrada");
  return { user, company, pendingCount };
});

export async function getVagasPageData() {
  const { user, company } = await getGestorShell();
  const jobs = await listCompanyJobs(user.companyId);
  return { companySlug: company.slug, jobs };
}

/** Configurações · a vitrine da empresa, como o dono edita. */
export async function getConfiguracoesData() {
  const { company } = await getGestorShell();
  return {
    company,
    publicUrl: `${appUrl()}/${company.slug}/vagas`,
  };
}

export async function getFormularioPageData() {
  const { user } = await getGestorShell();
  const { core, custom } = await listApplicationFormFields(user.companyId);
  return { fields: [...core, ...custom] };
}

export async function getCandidaturasPageData(jobId?: string) {
  const { user, company } = await getGestorShell();
  // Sequencial: com connection_limit=1 o Promise.all só enfileira na
  // mesma conexão e aumenta o risco de P2024 (pool_timeout).
  const applications = await withPhotoUrls(
    await listCompanyApplications(user.companyId, jobId)
  );
  const jobs = await listCompanyJobs(user.companyId);
  const ages = await listCompanyApplicantAges(user.companyId);
  return { applications, jobs, companyName: company.name, ages };
}

/** Busca avançada de CVs (nível Michelin): base aberta de currículos com busca facetada. */
export async function getBuscarCvsData() {
  const { user } = await getGestorShell();
  const rawApps = await listApplicationsForCvSearch(user.companyId);
  const jobs = await listCompanyJobs(user.companyId);

  const candidates: CandidateCvCard[] = rawApps.map((app) => {
    // Procura respostas relevantes nas perguntas customizadas
    let salaryExpectation: string | null = null;
    let education: string | null = null;
    let languages: string | null = null;

    for (const ans of app.answers) {
      const label = ans.field.label.toLowerCase();
      if (label.includes("salar") || label.includes("pretens")) {
        salaryExpectation = ans.value;
      } else if (label.includes("escolar") || label.includes("formaç") || label.includes("curso")) {
        education = ans.value;
      } else if (label.includes("idioma") || label.includes("inglês")) {
        languages = ans.value;
      }
    }

    const effectiveSalary = app.salaryExpectation || salaryExpectation;
    const effectiveBirthDate = app.birthDate ?? extractBirthDateFromText(app.resumeText);
    const age = calculateAge(effectiveBirthDate) ?? extractAgeFromText(app.resumeText);

    return {
      id: app.id,
      name: titleCasePt(app.name),
      email: app.email,
      phone: app.phone,
      photoUrl: app.photoUrl,
      resumeUrl: app.resumeUrl,
      resumeText: app.resumeText,
      aiProfile: app.aiProfile,
      aiArea: app.aiArea,
      aiLevel: app.aiLevel,
      aiScore: app.aiScore,
      aiReasoning: app.aiReasoning,
      aiChecklist: app.aiChecklist,
      status: app.status,
      createdAt: app.createdAt.toISOString(),
      job: {
        id: app.job.id,
        title: app.job.title,
        location: app.job.location,
        workMode: app.job.workMode,
        contract: app.job.contract,
        aiMinScore: app.job.aiMinScore,
      },
      salaryExpectation: effectiveSalary,
      education,
      languages,
      skills: extractCandidateSkills(app.resumeText, app.aiProfile),
      birthDate: effectiveBirthDate ? effectiveBirthDate.toISOString() : null,
      age,
      city: app.city,
      state: app.state,
      neighborhood: app.neighborhood || extractNeighborhoodFromText(app.resumeText),
      desiredRole: app.desiredRole,
      workPreference: app.workPreference,
      availability: app.availability,
      hasCnh: app.hasCnh,
      isPcd: app.isPcd,
      pcdDetails: app.pcdDetails,
    };
  });

  return { candidates, jobs };
}

/** Hub da vaga: o processo inteiro em um lugar (funil, sinais, critérios). */
export async function getVagaDetailData(jobId: string) {
  const { user, company } = await getGestorShell();
  const job = await getCompanyJob(user.companyId, jobId);
  if (!job) return null;
  const applications = await withPhotoUrls(
    await listCompanyApplications(user.companyId, jobId)
  );
  const ages = await listJobApplicantAges(user.companyId, jobId);
  const questions = await getJobQuestions(user.companyId, jobId);
  const standby = await getStandbyForJob(user.companyId, jobId);
  return {
    job,
    questions,
    standby,
    companyName: company.name,
    companySlug: company.slug,
    publicUrl: `${appUrl()}/${company.slug}/vagas/${job.id}`,
    applications,
    ages,
  };
}

export async function getCandidaturaDetail(id: string) {
  const { user } = await getGestorShell();
  const application = await getCompanyApplication(user.companyId, id);
  if (!application) return null;
  const [withPhoto] = await withPhotoUrls([application]);
  const otherApplications = await getOtherApplicationsOfPerson(
    user.companyId,
    application.email,
    id
  );
  return {
    ...withPhoto,
    name: titleCasePt(withPhoto.name),
    otherApplications,
    age: effectiveAge(application.birthDate, application.resumeText),
  };
}

/** G12 · Dados para comparação lado a lado (2–3 candidaturas do tenant). */
export async function getCompareData(ids: string[]) {
  const { user } = await getGestorShell();
  // Sequencial (connection_limit=1): cada detalhe já faz vários joins.
  const applications = [];
  for (const id of ids.slice(0, 3)) {
    const application = await getCompanyApplication(user.companyId, id);
    if (application) applications.push(application);
  }
  return withPhotoUrls(applications);
}

export async function getJobForEdit(jobId: string) {
  const { user, company } = await getGestorShell();
  const job = await getCompanyJob(user.companyId, jobId);
  return { job, company };
}

export async function getPainelData(): Promise<{
  userName: string;
  companyName: string;
  companySlug: string;
  publicUrl: string;
  stats: DashboardStats;
  priority: (PriorityApplication & { photoUrl: string | null })[];
  jobs: JobProgress[];
}> {
  const { user, company } = await getGestorShell();
  const { stats, priority, jobs } = await getDashboard(user.companyId);
  return {
    userName: user.name ?? user.email,
    companyName: company.name,
    companySlug: company.slug,
    publicUrl: `${appUrl()}/${company.slug}/vagas`,
    stats,
    priority: await withPhotoUrls(priority),
    jobs,
  };
}

/** Dados do relatório em PDF para a diretoria (vaga da empresa do gestor logado). */
export async function getJobReportForGestor(jobId: string, withAiComparison: boolean) {
  const { user } = await getGestorShell();
  return loadJobReportData(user.companyId, jobId, withAiComparison);
}

/** Dados do relatório geral em PDF (todas as vagas da empresa do gestor logado). */
export async function getPortfolioReportForGestor() {
  const { user } = await getGestorShell();
  return loadPortfolioReportData(user.companyId);
}
