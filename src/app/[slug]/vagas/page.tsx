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
  const [data, candidate] = await Promise.all([
    getJobsPageData(slug),
    getPublicSession(),
  ]);
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

        <div className="relative mx-auto grid w-full max-w-[1120px] gap-8 px-5 pb-11 pt-9 md:grid-cols-[1fr_300px] md:items-end md:px-8 md:pb-14 md:pt-10">
          <div>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
              Carreira · {company.name}
            </p>
            <h1 className="max-w-[680px] text-[34px] font-bold leading-[1.05] tracking-[-1px] text-white md:text-[52px]">
              {company.heroTitle}
            </h1>
            <p className="mt-4 max-w-[600px] text-[15px] leading-6 text-white/75 md:text-[16px] md:leading-7">
              {company.heroSubtitle}
            </p>
          </div>

          <div className="rounded-2xl border border-white/15 bg-black/10 p-5 backdrop-blur-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
              Oportunidades
            </p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-4xl font-bold tracking-[-1px] text-white">
                {jobs.length}
              </span>
              <span className="pb-1 text-sm text-white/65">
                {jobs.length === 1 ? "vaga aberta" : "vagas abertas"}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-white/55">
              Encontre uma oportunidade que combine com o seu próximo passo.
            </p>
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-[1120px] px-5 pb-12 pt-9 md:px-8 md:pt-11">
        <JobList
          slug={company.slug}
          jobs={jobs}
          companyName={company.name}
          loggedIn={Boolean(candidate)}
          appliedJobIds={appliedJobIds}
        />

        {company.aboutText && (
          <section className="mt-16 grid gap-5 rounded-2xl border border-[#e8e3de] bg-white p-7 md:grid-cols-[220px_1fr] md:gap-10 md:p-9">
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
