import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CandidatePortalExperience } from "@/components/candidate/candidate-portal-experience";
import { getDefaultCompanySlug, listPublicCompanies } from "@/server/services/company.service";
import { listPublicFeaturedJobs } from "@/server/services/job.service";
import { getSessionUser, isAdmin } from "@/server/services/auth.service";

export const metadata: Metadata = {
  title: "TARHGET · Portal de Vagas e Recrutamento",
  description:
    "Encontre sua próxima vaga na TARHGET. Conectamos profissionais às melhores marcas com processos ágeis e transparentes.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; gestor?: string; login?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect(isAdmin(user) ? "/admin/empresas" : "/painel");

  const params = await searchParams;
  const autoOpenCompanyLogin = Boolean(params.empresa || params.gestor || params.login);

  const defaultCompanySlug = await getDefaultCompanySlug();
  const companies = await listPublicCompanies();
  const featuredJobs = await listPublicFeaturedJobs(12);

  return (
    <CandidatePortalExperience
      companies={companies}
      featuredJobs={featuredJobs}
      defaultCompanySlug={defaultCompanySlug}
      autoOpenCompanyLogin={autoOpenCompanyLogin}
    />
  );
}
