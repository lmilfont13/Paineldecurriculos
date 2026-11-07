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
    <div className="min-h-screen bg-[#faf9f7]">
      <CompanyHeader
        company={company}
        candidate={candidate}
        tone="light"
        jobCount={jobs.length}
      />

      <main className="mx-auto w-full max-w-[1280px] px-4 py-6 md:px-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-900">
                <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
                AO VIVO
              </span>
              <h1 className="text-xl font-black tracking-tight text-stone-900 md:text-2xl">
                Espaço de Carreiras & Suporte Online · {company.name}
              </h1>
            </div>
            <p className="mt-1 text-xs text-stone-600 md:text-sm">
              Caminhe pelos ambientes isométricos com seu boneco, converse em nuvens públicas, retire senha para atendimento individual com o RH ou jogue no fliperama!
            </p>
          </div>

          <Link
            href={`/${company.slug}/vagas`}
            className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-bold text-stone-800 shadow-2xs transition hover:bg-stone-50"
          >
            ← Voltar para as Vagas ({jobs.length})
          </Link>
        </div>

        {!initialState.isPublicEnabled && initialState.viewerRole !== "STAFF" ? (
          <div className="mx-auto my-8 max-w-xl rounded-3xl border-2 border-stone-900 bg-white p-8 text-center shadow-[0_12px_30px_rgba(0,0,0,0.08)] space-y-4">
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border-2 border-stone-900 bg-amber-300 text-3xl shadow-[0_4px_0_#18181b]">
              🎧
            </div>
            <span className="inline-block rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-amber-900">
              Em preparação pela equipe
            </span>
            <h2 className="text-xl font-black text-stone-900">
              A Sala de Suporte ao Vivo está em Modo de Teste Interno
            </h2>
            <p className="text-sm leading-relaxed text-stone-600">
              A equipe de RH da <strong>{company.name}</strong> está preparando os ambientes de atendimento, café e recepção. Enquanto isso, você pode conferir todas as oportunidades abertas no mural de vagas!
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link
                href={`/${company.slug}/vagas`}
                className="rounded-2xl border-2 border-stone-900 bg-amber-400 px-5 py-2.5 text-xs font-black text-stone-950 shadow-[0_4px_0_#18181b] transition hover:bg-amber-300"
              >
                Ver Vagas Abertas ({jobs.length})
              </Link>
              <Link
                href="/login"
                className="rounded-2xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-100"
              >
                Sou Gestor / Admin (Entrar p/ Testar)
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

