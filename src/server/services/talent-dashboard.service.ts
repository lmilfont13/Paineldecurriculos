import "server-only";

import {
  buildTalentDashboardData,
  type TalentDashboardData,
  type RawCandidateForDashboard,
} from "@/server/models/talent-dashboard.model";
import { findApplicationsForCvSearch } from "@/server/repositories/application.repository";
import { getCompanyById } from "@/server/services/company.service";
import { withPhotoUrls } from "@/server/services/resume-photo.service";

export type TalentDashboardReportResult = {
  data: TalentDashboardData;
  company: {
    id: string;
    name: string;
    brand: string;
  };
};

/**
 * Carrega e consolida todos os dados analíticos de talentos e currículos da empresa
 * para a geração do relatório executivo em PDF (nível Michelin).
 */
export async function loadTalentDashboardReportData(
  companyId: string
): Promise<TalentDashboardReportResult | null> {
  const company = await getCompanyById(companyId);
  if (!company) return null;

  const raw = await findApplicationsForCvSearch(companyId);
  const rows = await withPhotoUrls(raw);

  const candidates: RawCandidateForDashboard[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    photoUrl: r.photoUrl,
    resumeUrl: r.resumeUrl,
    resumeText: r.resumeText,
    birthDate: r.birthDate,
    city: r.city,
    neighborhood: r.neighborhood,
    aiProfile: r.aiProfile,
    aiArea: r.aiArea,
    aiLevel: r.aiLevel,
    aiScore: r.aiScore,
    aiTenure: r.aiTenure,
    createdAt: r.createdAt,
  }));

  const data = buildTalentDashboardData(company.name, candidates);

  return {
    data,
    company: {
      id: company.id,
      name: company.name,
      brand: company.primaryColor || "#7a1f3d",
    },
  };
}

