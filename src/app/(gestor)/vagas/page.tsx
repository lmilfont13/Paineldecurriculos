import type { Metadata } from "next";

import { VagasDashboard } from "@/components/gestor/vagas-dashboard";
import { getVagasPageData } from "@/server/controllers/gestor.controller";
import { appUrl } from "@/lib/env";

export const metadata: Metadata = { title: "Vagas · Triagem" };

export default async function VagasPage() {
  const { companySlug, jobs } = await getVagasPageData();
  const publicUrl = `${appUrl()}/${companySlug}/vagas`;

  return <VagasDashboard jobs={jobs} companySlug={companySlug} publicUrl={publicUrl} />;
}
