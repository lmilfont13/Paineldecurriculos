import type { Metadata } from "next";
import { getExternalJobsPageData } from "@/server/controllers/external-job.controller";
import { GoogleJobsImporter } from "@/components/gestor/google-jobs-importer";

export const metadata: Metadata = {
  title: "Importar do Google Vagas · Triagem",
  description: "Pesquise e concentre vagas externas no seu portal para ajudar os candidatos.",
};

export default async function ExternalJobsManagerPage() {
  const data = await getExternalJobsPageData();

  return (
    <GoogleJobsImporter
      initialJobs={data.jobs}
      companySlug={data.companySlug}
      searchConfigured={data.searchConfigured}
      initialStats={data.stats}
    />
  );
}

