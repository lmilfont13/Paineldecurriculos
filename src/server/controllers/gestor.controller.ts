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
  requestReanalysis,
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
import { getActiveRadioStation } from "@/server/services/message-template.service";
import { isPrimaryCompanyAdmin } from "@/server/services/user.service";
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
  const radioStation = await getActiveRadioStation(user.companyId);
  const canManageRadio = await isPrimaryCompanyAdmin(user.companyId, user.id);
  return { user, company, pendingCount, radioStation, canManageRadio };
});

export async function getVagasPageData() {
  const { user, company } = await getGestorShell();

  return { companySlug: company.slug, jobs: await listCompanyJobs(user.companyId) };
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

  // Reenfileira automaticamente até 3 currículos em imagem/PDF escaneado que
  // haviam ficado como NO_RESUME, FAILED ou com leitura inválida.
  const stuck = applications
    .filter(
      (a) =>
        a.resumeUrl &&
        (a.aiState === "NO_RESUME" ||
          a.aiState === "FAILED" ||
          Boolean(a.aiReasoning?.includes("Engenheiro de Software"))) &&
        Date.now() - a.updatedAt.getTime() > 30_000
    )
    .slice(0, 3);
  for (const app of stuck) {
    await requestReanalysis(user.companyId, app.id).catch(() => {});
    app.aiState = "WAITING";
  }

  const ages = await listCompanyApplicantAges(user.companyId);
  return { applications, jobs: (await listCompanyJobs(user.companyId)).filter((j) => j.status === "OPEN"), companyName: company.name, ages };
}

/** Busca avançada de CVs (nível Michelin): base aberta de currículos com busca facetada. */
export async function getBuscarCvsData() {
  const { user } = await getGestorShell();
  const rawApps = await listApplicationsForCvSearch(user.companyId);


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
      instagram: app.instagram ?? null,
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

  return { candidates, jobs: await listCompanyJobs(user.companyId) };
}

/** Hub da vaga: o processo inteiro em um lugar (funil, sinais, critérios). */
export async function getVagaDetailData(jobId: string) {
  const { user, company } = await getGestorShell();
  const job = await getCompanyJob(user.companyId, jobId);
  if (!job) return null;
  const applications = await withPhotoUrls(
    await listCompanyApplications(user.companyId, jobId)
  );

  // Reenfileira automaticamente até 3 currículos em imagem/PDF escaneado da vaga
  const stuck = applications
    .filter(
      (a) =>
        a.resumeUrl &&
        (a.aiState === "NO_RESUME" ||
          a.aiState === "FAILED" ||
          Boolean(a.aiReasoning?.includes("Engenheiro de Software"))) &&
        Date.now() - a.updatedAt.getTime() > 30_000
    )
    .slice(0, 3);
  for (const app of stuck) {
    await requestReanalysis(user.companyId, app.id).catch(() => {});
    app.aiState = "WAITING";
  }

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

  // Se a candidatura tem currículo anexado mas ficou sem leitura do arquivo
  // (ex.: PDF em imagem da Catho antes do OCR visual), dispara a análise ao abrir.
  const needsVisualOcrRetry =
    Boolean(application.resumeUrl) &&
    (application.aiState === "NO_RESUME" ||
      application.aiState === "FAILED" ||
      (application.aiState === "DONE" && !application.resumeText?.trim()) ||
      Boolean(application.aiReasoning?.includes("Engenheiro de Software"))) &&
    Date.now() - application.updatedAt.getTime() > 20_000;

  if (needsVisualOcrRetry) {
    await requestReanalysis(user.companyId, id).catch(() => {});
    application.aiState = "WAITING";
  }

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
