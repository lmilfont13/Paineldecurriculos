import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  CompanyFooter,
  CompanyHeader,
} from "@/components/public/company-header";
import {
  formatJobMeta,
  formatPublishedAgo,
  requirementsToBullets,
} from "@/server/models/job.model";
import { getJobDetailPageData } from "@/server/controllers/public.controller";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; jobId: string }>;
}): Promise<Metadata> {
  const { slug, jobId } = await params;
  const data = await getJobDetailPageData(slug, jobId);
  return {
    title: data ? `${data.job.title} · ${data.company.name}` : "Vaga",
  };
}

/** P2 · Detalhe da vaga (público) — frame 87:44 do Figma. */
export default async function PublicJobDetailPage({
  params,
}: {
  params: Promise<{ slug: string; jobId: string }>;
}) {
  const { slug, jobId } = await params;
  const data = await getJobDetailPageData(slug, jobId);
  if (!data) notFound();
  const { company, job, applicantCount } = data;
  const bullets = requirementsToBullets(job.requirements);

  return (
    <>
      <CompanyHeader company={company} />
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-6 pt-10">
        <Link
          href={`/${company.slug}/vagas`}
          className="text-[13px] font-medium text-[#71717a] hover:text-[#0a0a0a]"
        >
          ← Todas as vagas
        </Link>

        <div className="mt-8 flex flex-col gap-12 lg:flex-row lg:justify-between">
          <article className="max-w-[680px]">
            <h1 className="text-[40px] font-bold leading-tight text-[#0a0a0a]">
              {job.title}
            </h1>
            <p className="mt-4 text-sm text-[#71717a]">
              {formatJobMeta(job)} · {formatPublishedAgo(job.createdAt)}
            </p>

            <h2 className="mt-12 text-[15px] font-semibold text-[#0a0a0a]">
              Sobre a vaga
            </h2>
            <p className="mt-3 max-w-[640px] whitespace-pre-line text-[15px] leading-6 text-[#71717a]">
              {job.description}
            </p>

            {bullets.length > 0 && (
              <>
                <h2 className="mt-12 text-[15px] font-semibold text-[#0a0a0a]">
                  O que esperamos
                </h2>
                <ul className="mt-4 space-y-2.5">
                  {bullets.map((item) => (
                    <li
                      key={item}
                      className="flex max-w-[600px] items-start gap-3 text-[15px] text-[#0a0a0a]"
                    >
                      <span
                        aria-hidden
                        className="mt-[7px] size-[5px] shrink-0 rounded-full"
                        style={{ backgroundColor: "var(--brand-primary)" }}
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </article>

          <aside className="w-full shrink-0 lg:w-[440px]">
            <div className="rounded-3xl border border-[#e4e4e7] bg-white p-7 shadow-[0px_4px_6px_rgba(0,0,0,0.07)]">
              <h2 className="text-base font-semibold text-[#0a0a0a]">
                Candidate-se a esta vaga
              </h2>
              <p className="mt-1 text-[13px] leading-[19px] text-[#71717a]">
                Menos de 2 minutos. Sem criar conta.
              </p>
              <Link
                href={`/${company.slug}/vagas/${job.id}/candidatar`}
                className="mt-6 flex h-[46px] w-full items-center justify-center rounded-2xl text-sm font-semibold transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: "var(--brand-primary)",
                  color: "var(--brand-foreground)",
                }}
              >
                Candidatar-se agora
              </Link>
              <p className="mt-4 text-xs text-[#a1a1aa]">
                {applicantCount === 0
                  ? "Seja a primeira pessoa a se candidatar"
                  : applicantCount === 1
                    ? "1 pessoa já se candidatou"
                    : `${applicantCount} pessoas já se candidataram`}
              </p>
            </div>
          </aside>
        </div>
      </main>
      <CompanyFooter company={company} />
    </>
  );
}
