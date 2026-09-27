import { notFound } from "next/navigation";

import {
  CompanyFooter,
  CompanyHeader,
} from "@/components/public/company-header";
import { JobList } from "@/components/public/job-list";
import {
  getJobsPageData,
  getPublicSession,
} from "@/server/controllers/public.controller";

/**
 * P1 · Vagas (público). A faixa da marca carrega a identidade (logo completo,
 * no espírito do material que a empresa já usa); abaixo dela, só as vagas.
 */
export default async function PublicJobsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [data, candidate] = await Promise.all([
    getJobsPageData(slug),
    getPublicSession(),
  ]);
  if (!data) notFound();
  const { company, jobs } = data;

  return (
    <>
      <div
        style={{
          background:
            "linear-gradient(165deg, var(--brand-primary) 0%, var(--brand-deep) 100%)",
        }}
      >
        <CompanyHeader company={company} candidate={candidate} tone="brand" />
        <section className="mx-auto w-full max-w-[1120px] px-5 pb-14 pt-12 md:px-8 md:pb-20 md:pt-16">
          <h1 className="max-w-[720px] text-[32px] font-bold leading-[1.1] tracking-[-0.5px] text-white md:text-[48px]">
            {company.heroTitle}
          </h1>
          <p className="mt-4 max-w-[560px] text-[15px] leading-6 text-white/80 md:text-base md:leading-7">
            {company.heroSubtitle}
          </p>
          {jobs.length > 0 && (
            <p className="mt-8 inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-[13px] font-medium text-white ring-1 ring-white/15">
              <span className="size-1.5 rounded-full bg-white" />
              {jobs.length === 1 ? "1 vaga aberta" : `${jobs.length} vagas abertas`}
            </p>
          )}
        </section>
      </div>

      <main className="mx-auto w-full max-w-[1120px] flex-1 px-5 pt-10 md:px-8 md:pt-14">
        <JobList
          slug={company.slug}
          jobs={jobs}
          companyName={company.name}
          loggedIn={Boolean(candidate)}
        />

        {company.aboutText && (
          <section className="mt-16 grid gap-4 border-t border-[#ebe7e3] pt-10 md:grid-cols-[240px_1fr] md:gap-10">
            <h2 className="text-[15px] font-semibold text-[#1c1917]">
              Sobre a {company.name}
            </h2>
            <p className="max-w-[640px] whitespace-pre-line text-[15px] leading-7 text-[#57534e]">
              {company.aboutText}
            </p>
          </section>
        )}
      </main>
      <CompanyFooter company={company} />
    </>
  );
}
