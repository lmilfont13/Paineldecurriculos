import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CompanyFooter,
  CompanyHeader,
} from "@/components/public/company-header";
import { VirtualCareerSpace } from "@/components/public/virtual-career-space";
import {
  getJobsPageData,
  getPublicSession,
} from "@/server/controllers/public.controller";
import { getSupportSpaceStateAction } from "@/server/controllers/support.controller";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getJobsPageData(slug);
  return {
    title: data
      ? `Espaço de Carreiras & Suporte ao Vivo · ${data.company.name}`
      : "Espaço de Carreiras ao Vivo",
  };
}

export default async function PublicSupportSpacePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getJobsPageData(slug);
  if (!data) notFound();

  const candidate = await getPublicSession();
  const initialState = await getSupportSpaceStateAction(slug);
  const { company, jobs } = data;

  return (
    <div className="min-h-screen bg-slate-50/70">
      <CompanyHeader
        company={company}
        candidate={candidate}
        tone="light"
        jobCount={jobs.length}
      />

      <main className="mx-auto w-full max-w-[1280px] px-4 py-6 md:px-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
                ATENDIMENTO & CARREIRAS AO VIVO
              </span>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 md:text-xl">
                Centro Corporativo de Carreiras & Suporte · {company.name}
              </h1>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Consulte o Mural de Vagas Abertas, tire dúvidas em tempo real com nossos Bots Assistentes, veja como acompanhar avisos no sistema ou retire uma senha para atendimento confidencial com o RH.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {candidate && (
              <Link
                href={`/${company.slug}/minhas-candidaturas`}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-100"
              >
                Minhas Candidaturas & Avisos
              </Link>
            )}
            <Link
              href={`/${company.slug}/vagas`}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 shadow-2xs transition hover:bg-slate-50"
            >
              ← Portal de Vagas ({jobs.length})
            </Link>
          </div>
        </div>

        {!initialState.isPublicEnabled && initialState.viewerRole !== "STAFF" ? (
          <div className="mx-auto my-8 max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm space-y-4">
            <div className="mx-auto flex size-14 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-2xl">
              🎧
            </div>
            <span className="inline-block rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-900">
              Ambiente em Homologação pela Equipe
            </span>
            <h2 className="text-lg font-bold text-slate-900">
              O Centro de Suporte ao Vivo está em preparação
            </h2>
            <p className="text-sm leading-relaxed text-slate-600">
              A equipe de RH da <strong>{company.name}</strong> está configurando os balcões de atendimento e assistentes virtuais. Enquanto isso, consulte todas as oportunidades abertas no nosso portal de vagas.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link
                href={`/${company.slug}/vagas`}
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-2xs transition hover:bg-slate-800"
              >
                Acessar Mural de Vagas ({jobs.length})
              </Link>
              <Link
                href="/login"
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Acesso Gestor / RH
              </Link>
            </div>
          </div>
        ) : (
          <VirtualCareerSpace
            companySlug={company.slug}
            companyName={company.name}
            initialState={initialState}
          />
        )}
      </main>

      <CompanyFooter company={company} />
    </div>
  );
}

