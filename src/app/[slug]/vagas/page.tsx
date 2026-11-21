import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  CompanyFooter,
  CompanyHeader,
} from "@/components/public/company-header";
import { HiresShowcase } from "@/components/public/hires-showcase";
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
  const { company, jobs, appliedJobIds, hires } = data;

  return (
    <div className="min-h-screen bg-[#f3f1ec]">
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

        <div className="relative mx-auto w-full max-w-[1120px] px-5 pb-4 pt-2 md:px-8 md:pb-5 md:pt-3">
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <div>
              <h1 className="text-[22px] sm:text-[26px] md:text-[30px] font-bold leading-tight tracking-[-0.6px] text-white">
                {company.heroTitle}
              </h1>
              <p className="mt-0.5 max-w-[560px] text-[13px] leading-relaxed text-white/85 sm:text-[14px]">
                {company.heroSubtitle}
              </p>
            </div>
            {jobs.length > 0 && (
              <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-white backdrop-blur shadow-xs">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[18px] sm:text-[20px] font-bold leading-none tracking-tight">{jobs.length}</span>
                <span className="text-[12px] sm:text-[13px] font-medium leading-tight text-white/90">
                  {jobs.length === 1 ? "vaga aberta" : "vagas abertas"}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      <main id="vagas" className="mx-auto w-full max-w-[1120px] px-4 pb-10 pt-4 md:px-8 md:pt-6">
        <JobList
          slug={company.slug}
          jobs={jobs}
          companyName={company.name}
          loggedIn={Boolean(candidate)}
          appliedJobIds={appliedJobIds}
        />

        <HiresShowcase hires={hires} companyName={company.name} />

        <section className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#e2ddd6] bg-white p-6 shadow-[0_1px_3px_rgba(28,25,23,0.06)] md:p-7">
          <div className="max-w-[620px]">
            <h2 className="text-lg font-semibold tracking-[-0.2px] text-[#1c1917]">
              Não encontrou a vaga ideal?
            </h2>
            <p className="mt-1.5 text-[14px] leading-6 text-[#57534e]">
              Deixe seu currículo no nosso banco de talentos. Quando surgir uma vaga com o seu perfil, a{" "}
              {company.name} entra em contato com você.
            </p>
          </div>
          <Link
            href={`/${company.slug}/banco-de-talentos`}
            className="inline-flex h-11 items-center rounded-xl px-5 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-foreground)" }}
          >
            Cadastrar meu currículo
          </Link>
        </section>

        {company.aboutText && (
          <section className="mt-10 grid gap-4 rounded-2xl border border-[#e2ddd6] bg-white p-6 shadow-[0_1px_3px_rgba(28,25,23,0.06)] md:grid-cols-[220px_1fr] md:gap-10 md:p-7">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#78716c]">
                Sobre a empresa
              </p>
              <h2 className="mt-2 text-lg font-semibold tracking-[-0.2px] text-[#1c1917]">
                {company.name}
              </h2>
            </div>
            <p className="max-w-[680px] whitespace-pre-line text-[14px] leading-7 text-[#44403c]">
              {company.aboutText}
            </p>
          </section>
        )}
      </main>

      <CompanyFooter company={company} />
    </div>
  );
}
