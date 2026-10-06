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

        <div className="relative mx-auto w-full max-w-[1180px] px-5 pb-14 pt-8 md:px-8 md:pb-20 md:pt-10">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(440px,0.9fr)] lg:gap-12">
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70 backdrop-blur">
                <span className="size-1.5 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)]" />
                Carreira · {company.name}
              </div>

              <h1 className="mt-6 max-w-[700px] text-[42px] font-semibold leading-[0.98] tracking-[-2px] text-white md:text-[58px] lg:text-[66px]">
                {company.heroTitle}
              </h1>

              <p className="mt-6 max-w-[610px] text-[15px] leading-7 text-white/70 md:text-[17px]">
                {company.heroSubtitle}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a
                  href="#vagas"
                  className="inline-flex h-11 items-center rounded-xl px-5 text-[13px] font-semibold shadow-[0_10px_30px_rgba(0,0,0,0.18)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(0,0,0,0.24)]"
                  style={{ backgroundColor: "white", color: "var(--brand-primary)" }}
                >
                  Ver vagas abertas <span className="ml-2">→</span>
                </a>
                <span className="text-[12px] text-white/45">
                  {jobs.length} {jobs.length === 1 ? "oportunidade" : "oportunidades"} disponíveis
                </span>
              </div>
            </div>

            <div className="relative mx-auto h-[360px] w-full max-w-[500px] md:h-[420px]" aria-hidden="true">
              <div className="absolute left-1/2 top-1/2 size-[250px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-3xl" style={{ background: "var(--brand-secondary)" }} />
              <div className="absolute left-[12%] top-[12%] size-2 rounded-full bg-white/70 shadow-[0_0_24px_rgba(255,255,255,0.9)] animate-pulse" />
              <div className="absolute right-[10%] top-[30%] size-1.5 rounded-full bg-white/60 shadow-[0_0_18px_rgba(255,255,255,0.8)]" />

              <div className="absolute inset-x-[12%] top-[7%] bottom-[4%] overflow-hidden rounded-[34px] border border-white/20 bg-white/[0.08] shadow-[0_30px_90px_rgba(0,0,0,0.28)] backdrop-blur-xl">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.18),transparent_28%),linear-gradient(145deg,rgba(255,255,255,0.1),rgba(255,255,255,0.015))]" />
                <div className="absolute left-8 top-8 right-8">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">Talent pool</span>
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[9px] font-semibold text-white/65">ao vivo</span>
                  </div>
                  <div className="mt-7 flex items-end gap-2">
                    <span className="text-5xl font-semibold tracking-[-2px] text-white">{jobs.length}</span>
                    <span className="pb-1 text-xs text-white/45">vagas abertas</span>
                  </div>
                  <div className="mt-8 h-px bg-white/10" />
                  <div className="mt-6 space-y-3">
                    {[
                      ["AM", "Ana Martins", "Marketing"],
                      ["RC", "Rafael Costa", "Operações"],
                      ["LS", "Lucas Silva", "Tecnologia"],
                    ].map(([initials, name, role], index) => (
                      <div
                        key={name}
                        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/10 px-3 py-3"
                        style={{ animationDelay: `${index * 120}ms` }}
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[10px] font-bold text-white">
                          {initials}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[11px] font-semibold text-white/85">{name}</span>
                          <span className="block text-[10px] text-white/40">{role}</span>
                        </span>
                        <span className="text-[10px] font-semibold text-white/55">{92 - index * 4}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="absolute -left-1 top-[28%] w-[170px] rounded-2xl border border-white/20 bg-white/95 p-3 shadow-[0_20px_45px_rgba(0,0,0,0.22)] backdrop-blur-md [animation:heroFloat_5s_ease-in-out_infinite]">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-xl text-[9px] font-bold text-white" style={{ background: "var(--brand-primary)" }}>92%</span>
                  <div>
                    <p className="text-[10px] font-semibold text-[#1c1917]">Alta compatibilidade</p>
                    <p className="text-[9px] text-[#78716c]">perfil + vaga</p>
                  </div>
                </div>
              </div>

              <div className="absolute -right-1 bottom-[12%] w-[185px] rounded-2xl border border-white/15 bg-[#171313]/90 p-3.5 shadow-[0_20px_45px_rgba(0,0,0,0.3)] backdrop-blur-md [animation:heroFloatReverse_6s_ease-in-out_infinite]">
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35">Nova candidatura</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-xl bg-white/10 text-[9px] font-bold text-white">JD</span>
                  <div>
                    <p className="text-[10px] font-semibold text-white/85">João Dias</p>
                    <p className="text-[9px] text-white/40">Acabou de se candidatar</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main id="vagas" className="mx-auto w-full max-w-[1120px] px-5 pb-12 pt-9 md:px-8 md:pt-11">
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
