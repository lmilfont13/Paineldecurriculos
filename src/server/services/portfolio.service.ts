import "server-only";

import { readChecklist } from "@/server/models/ai.model";
import { profileChoiceLabel } from "@/server/models/application.model";
import {
  buildPortfolio,
  type Portfolio,
  type PortfolioApplication,
  type PortfolioJob,
} from "@/server/models/portfolio.model";
import { titleCasePt, toPdfSafeText } from "@/server/models/text.model";
import { findApplicationsForPortfolio } from "@/server/repositories/application.repository";
import { findJobsByCompanyId } from "@/server/repositories/job.repository";
import { getCompanyById } from "@/server/services/company.service";

const safe = (v: string | null): string | null => (v === null ? null : toPdfSafeText(v));

export type PortfolioReportData = {
  data: Portfolio;
  company: { name: string; brand: string };
};

/** Reúne as vagas e candidaturas reais da empresa para o relatório geral (sem chamar a IA). */
export async function loadPortfolioReportData(companyId: string): Promise<PortfolioReportData | null> {
  const company = await getCompanyById(companyId);
  if (!company) return null;

  // Sequencial: com connection_limit=1 o Promise.all só enfileira na mesma conexão.
  const jobRows = await findJobsByCompanyId(companyId);
  const rows = await findApplicationsForPortfolio(companyId);

  const jobs: PortfolioJob[] = jobRows.map((j) => ({
    id: j.id,
    title: toPdfSafeText(j.title),
    code: j.code,
    status: j.status,
    location: safe(j.location),
    aiMinScore: j.aiMinScore,
    criteria: j.aiCriteria.map(toPdfSafeText),
    createdAt: j.createdAt,
  }));

  const applications: PortfolioApplication[] = rows.map((r) => ({
    id: r.id,
    jobId: r.jobId,
    email: r.email,
    hasCnh: r.hasCnh,
    workPreference: r.workPreference
      ? profileChoiceLabel("workPreference", r.workPreference) || r.workPreference
      : null,
    name: toPdfSafeText(titleCasePt(r.name)),
    status: r.status,
    aiScore: r.aiScore,
    aiReasoning: safe(r.aiReasoning),
    criteria: readChecklist(r.aiChecklist).map((k) => ({
      criterion: toPdfSafeText(k.criterion),
      met: k.met,
      evidence: toPdfSafeText(k.evidence),
    })),
    aiProfile: safe(r.aiProfile),
    aiArea: safe(r.aiArea),
    aiLevel: safe(r.aiLevel),
    salaryExpectation: safe(r.salaryExpectation),
    availability: r.availability ? profileChoiceLabel("availability", r.availability) || r.availability : null,
    city: safe(r.city),
    neighborhood: safe(r.neighborhood),
    createdAt: r.createdAt,
  }));

  return {
    data: buildPortfolio(jobs, applications, new Date()),
    company: { name: company.name, brand: company.primaryColor },
  };
}
