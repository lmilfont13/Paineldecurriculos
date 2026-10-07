import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  CompanyFooter,
  CompanyHeader,
} from "@/components/public/company-header";
import { WhatsAppShareButton } from "@/components/public/whatsapp-share-button";
import {
  contractLabels,
  formatPublishedAgo,
  requirementsToBullets,
  workModeLabels,
} from "@/server/models/job.model";
import {
  getJobDetailPageData,
  getPublicSession,
} from "@/server/controllers/public.controller";
import { appUrl } from "@/lib/env";

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

/** P2 · Detalhe da vaga (público). */
export default async function PublicJobDetailPage({
  params,
}: {
  params: Promise<{ slug: string; jobId: string }>;
}) {
  const { slug, jobId } = await params;
  // Sequencial: com connection_limit=1 o Promise.all só enfileira na
  // mesma conexão e aumenta o risco de P2024 (pool_timeout).
  const data = await getJobDetailPageData(slug, jobId);
  const candidate = await getPublicSession();
  if (!data) notFound();
  const { company, job, applicantCount } = data;
  const publicJobUrl = `${appUrl()}/${company.slug}/vagas/${job.id}`;
  const bullets = requirementsToBullets(job.requirements);
  const applyHref = `/${company.slug}/vagas/${job.id}/candidatar`;
  const tags = [
    job.location,
    workModeLabels[job.workMode],
    contractLabels[job.contract],
  ].filter(Boolean) as string[];

  return (
    <>
      <CompanyHeader company={company} candidate={candidate} />
      <main className="mx-auto w-full max-w-[1120px] flex-1 px-5 pt-8 md:px-8 md:pt-10">
        <Link
          href={`/${company.slug}/vagas`}
          className="text-[13px] font-medium text-[#78716c] hover:text-[#1c1917]"
        >
          ← Todas as vagas
        </Link>

        <div className="mt-7 flex flex-col gap-10 lg:flex-row lg:justify-between lg:gap-16">
          <article className="min-w-0 max-w-[680px] flex-1">
            <h1 className="text-[30px] font-bold leading-[1.15] tracking-[-0.4px] text-[#1c1917] md:text-[40px]">
              {job.title}
            </h1>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[#f1ece7] px-2.5 py-1 text-xs text-[#57534e]"
                >
                  {tag}
                </span>
              ))}
              <span className="px-1 py-1 text-xs text-[#a8a29e]">
                {formatPublishedAgo(job.createdAt)}
              </span>
            </div>

            <h2 className="mt-10 text-[15px] font-semibold text-[#1c1917]">
              Sobre a vaga
            </h2>
            <p className="mt-3 whitespace-pre-line text-[15px] leading-7 text-[#57534e]">
              {job.description}
            </p>

            {bullets.length > 0 && (
              <>
                <h2 className="mt-10 text-[15px] font-semibold text-[#1c1917]">
                  O que a gente procura
                </h2>
                <ul className="mt-4 space-y-3">
                  {bullets.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-3 text-[15px] leading-6 text-[#1c1917]"
                    >
                      <span
                        aria-hidden
                        className="mt-[9px] size-[6px] shrink-0 rounded-full"
                        style={{ backgroundColor: "var(--brand-primary)" }}
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {company.aboutText && (
              <>
                <h2 className="mt-10 text-[15px] font-semibold text-[#1c1917]">
                  Sobre a {company.name}
                </h2>
                <p className="mt-3 whitespace-pre-line text-[15px] leading-7 text-[#57534e]">
                  {company.aboutText}
                </p>
              </>
            )}
          </article>

          <aside className="hidden w-full shrink-0 lg:block lg:w-[380px]">
            <div className="sticky top-8 rounded-2xl border border-[#ebe7e3] bg-white p-7 shadow-[0_6px_20px_rgba(28,25,23,0.05)]">
              <h2 className="text-base font-semibold text-[#1c1917]">
                Quer essa vaga?
              </h2>
              <p className="mt-1.5 text-[13px] leading-5 text-[#78716c]">
                Leva uns 3 minutos. Currículo em PDF ajuda, mas não é
                obrigatório.
              </p>
              <Link
                href={applyHref}
                className="mt-6 flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: "var(--brand-primary)",
                  color: "var(--brand-foreground)",
                }}
              >
                Candidatar-se
              </Link>
              <p className="mt-4 text-xs text-[#a8a29e]">
                {applicantCount === 0
                  ? "Ninguém se candidatou ainda."
                  : applicantCount === 1
                    ? "1 pessoa já se candidatou."
                    : `${applicantCount} pessoas já se candidataram.`}
              </p>
              <div className="mt-3">
                <WhatsAppShareButton
                  jobId={job.id}
                  jobTitle={job.title}
                  url={publicJobUrl}
                  variant="outline"
                />
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Celular: botões fixos no rodapé */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#ebe7e3] bg-white/95 px-5 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
        <div className="flex gap-2">
          <WhatsAppShareButton
            jobId={job.id}
            jobTitle={job.title}
            url={publicJobUrl}
            variant="solid"
          />
          <Link
            href={applyHref}
            className="flex h-11 flex-1 items-center justify-center rounded-xl text-[14px] font-semibold transition-opacity hover:opacity-90"
            style={{
              backgroundColor: "var(--brand-primary)",
              color: "var(--brand-foreground)",
            }}
          >
            Candidatar-se
          </Link>
        </div>
      </div>

      <CompanyFooter company={company} />
      {/* Espaço para o rodapé não ficar escondido atrás do botão fixo */}
      <div aria-hidden className="h-20 lg:hidden" />
    </>
  );
}
