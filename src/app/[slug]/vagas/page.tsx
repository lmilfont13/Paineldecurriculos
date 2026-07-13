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
  getTenant,
} from "@/server/controllers/public.controller";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const company = await getTenant(slug);
  return { title: company ? `Vagas · ${company.name}` : "Vagas" };
}

/** P1 · Vagas (público) — frame 87:2 do Figma. */
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
      <CompanyHeader company={company} candidate={candidate} />
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-6 pt-16">
        <p
          className="text-xs font-medium uppercase tracking-[1px]"
          style={{ color: "var(--brand-primary)" }}
        >
          Carreiras · {company.name}
        </p>
        <h1 className="mt-3 text-[28px] font-bold leading-tight text-[#0a0a0a] md:text-[44px]">
          {company.heroTitle}
        </h1>
        <div className="mt-5">
          <JobList
            slug={company.slug}
            jobs={jobs}
            subtitle={company.heroSubtitle}
          />
        </div>
      </main>
      <CompanyFooter company={company} />
    </>
  );
}
