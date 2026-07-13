import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  CompanyFooter,
  CompanyHeader,
} from "@/components/public/company-header";
import { getMinhasCandidaturasData } from "@/server/controllers/public.controller";
import {
  appStatusLabels,
  formatAppliedAt,
  type AppStatusKey,
} from "@/server/models/application.model";

export const metadata: Metadata = { title: "Minhas candidaturas · Triagem" };

/** Para o candidato, "reprovado" aparece como processo finalizado. */
const candidateStatus: Record<
  AppStatusKey,
  { label: string; className: string }
> = {
  PENDING: { label: "Em análise", className: "bg-[#f1f0ed] text-[#71717a]" },
  INTERVIEW: { label: "Entrevista", className: "bg-[#f7f0e1] text-[#b07818]" },
  APPROVED: { label: "Aprovado", className: "bg-[#e4f6ec] text-[#1f7a4d]" },
  REJECTED: { label: "Finalizado", className: "bg-[#f1f0ed] text-[#a1a1aa]" },
};

/** CA4 · Minhas candidaturas — todas as empresas, na página do tenant atual. */
export default async function MinhasCandidaturasPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getMinhasCandidaturasData(slug);
  if (!data) notFound();
  if (!data.candidate) {
    redirect(
      `/${slug}/entrar?next=${encodeURIComponent(`/${slug}/minhas-candidaturas`)}`
    );
  }
  const { company, candidate, applications } = data;

  return (
    <>
      <CompanyHeader company={company} candidate={candidate} />
      <main className="mx-auto w-full max-w-[720px] flex-1 px-6 pt-14">
        <h1 className="text-2xl font-bold text-[#0a0a0a]">
          Minhas candidaturas
        </h1>
        <p className="mt-2 text-sm text-[#71717a]">
          {candidate.name} · {candidate.email}
        </p>

        <div className="mt-8 divide-y divide-[#e4e4e7] rounded-xl border border-[#e4e4e7] bg-white">
          {applications.length === 0 && (
            <p className="p-6 text-sm text-[#71717a]">
              Você ainda não se candidatou a nenhuma vaga.{" "}
              <Link
                href={`/${slug}/vagas`}
                className="font-medium hover:underline"
                style={{ color: "var(--brand-primary)" }}
              >
                Ver vagas abertas ›
              </Link>
            </p>
          )}
          {applications.map((app) => {
            const status = candidateStatus[app.status];
            return (
              <div key={app.id} className="flex items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#0a0a0a]">
                    {app.job.title}
                  </p>
                  <p className="mt-1 text-xs text-[#71717a]">
                    {app.company.name} · enviada em{" "}
                    {formatAppliedAt(app.createdAt)}
                  </p>
                </div>
                <span
                  className={`flex h-6 shrink-0 items-center gap-1.5 rounded-full px-3 text-[11px] font-medium ${status.className}`}
                >
                  <span className="size-1.5 rounded-full bg-current" />
                  {status.label}
                </span>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-xs text-[#a1a1aa]">
          Seus dados básicos e currículo ficam salvos e são reaproveitados a
          cada nova candidatura.
        </p>
      </main>
      <CompanyFooter company={company} />
    </>
  );
}
