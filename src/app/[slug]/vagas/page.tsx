import type { Metadata } from "next";
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getJobsPageData(slug);
  return { title: data ? `Vagas · ${data.company.name}` : "Vagas" };
}

export default async function PublicJobsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Sequencial: com connection_limit=1 o Promise.all só enfileira na
  // mesma conexão e aumenta o risco de P2024 (pool_timeout).
  const data = await getJobsPageData(slug);
  const candidate = await getPublicSession();
  if (!data) notFound();
  const { company, jobs, appliedJobIds } = data;

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <section
        className="relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-deep) 100%)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-40 size-[520px] rounded-full opacity-20 blur-3xl"
          style={{ background: "var(--brand-secondary)" }}
        />
        <CompanyHeader
          company={company}
          candidate={candidate}
          tone="brand"
          jobCount={jobs.length}
        />

        <div className="relative mx-auto w-full max-w-[1120px] px-5 pb-8 pt-5 md:px-8 md:pb-10 md:pt-6">
          <div className="relative z-10 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div>
              <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.8px] text-white md:text-[38px]">
                {company.heroTitle}
              </h1>
              <p className="mt-2 max-w-[560px] text-[14px] leading-6 text-white/70 md:text-[15px]">
                {company.heroSubtitle}
              </p>
            </div>
            <span className="rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-[12px] font-medium text-white/85 backdrop-blur">
              {jobs.length} {jobs.length === 1 ? "oportunidade disponível" : "oportunidades disponíveis"}
            </span>
          </div>
        </div>
      </section>

      <main id="vagas" className="mx-auto w-full max-w-[1120px] px-5 pb-10 pt-6 md:px-8 md:pt-8">
        <JobList
          slug={company.slug}
          jobs={jobs}
          companyName={company.name}
          loggedIn={Boolean(candidate)}
          appliedJobIds={appliedJobIds}
        />

        {company.aboutText && (
          <section className="mt-10 grid gap-4 rounded-2xl border border-[#e8e3de] bg-white p-6 md:grid-cols-[220px_1fr] md:gap-10 md:p-7">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a8a29e]">
                Sobre a empresa
              </p>
              <h2 className="mt-2 text-lg font-semibold tracking-[-0.2px] text-[#1c1917]">
                {company.name}
              </h2>
            </div>
            <p className="max-w-[680px] whitespace-pre-line text-[14px] leading-7 text-[#57534e]">
              {company.aboutText}
            </p>
          </section>
        )}
      </main>

      <CompanyFooter company={company} />
    </div>
  );
}
