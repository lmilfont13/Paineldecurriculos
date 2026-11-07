import type { Metadata } from "next";
import Link from "next/link";
import { VirtualCareerSpace } from "@/components/public/virtual-career-space";
import { getGestorShell } from "@/server/controllers/gestor.controller";
import { getSupportSpaceStateAction } from "@/server/controllers/support.controller";
import { LIVE_SUPPORT_FEATURE_ENABLED } from "@/server/models/support.model";

export const metadata: Metadata = {
  title: "Suporte ao Vivo & Espaço Virtual · Triagem",
};

export default async function GestorLiveSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { company } = await getGestorShell();
  const { preview } = await searchParams;
  const showPreview = LIVE_SUPPORT_FEATURE_ENABLED || preview === "1";

  if (!showPreview) {
    return (
      <div className="mx-auto my-8 max-w-2xl rounded-2xl border border-[#e4e4e7] bg-white p-8 shadow-2xs space-y-4">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-900">
          ⏸ Módulo Pausado Temporariamente
        </span>
        <h1 className="text-xl font-bold text-[#0a0a0a]">
          Suporte ao Vivo & Espaço Virtual de Carreiras
        </h1>
        <p className="text-sm leading-relaxed text-[#52525b]">
          Este módulo foi desativado momentaneamente nos menus e no cabeçalho público para evolução futura da interface e dos assistentes virtuais. Toda a estrutura de código, rotas e banco foi preservada.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Link
            href="/candidaturas"
            className="rounded-xl bg-[#0a0a0a] px-4 py-2.5 text-xs font-semibold text-white transition hover:opacity-90"
          >
            ← Voltar para Candidaturas
          </Link>
          <Link
            href="/suporte-ao-vivo?preview=1"
            className="rounded-xl border border-[#e4e4e7] bg-[#fafaf9] px-4 py-2.5 text-xs font-semibold text-[#52525b] transition hover:bg-white hover:text-[#0a0a0a]"
          >
            Abrir Pré-visualização de Desenvolvimento (Laboratorio)
          </Link>
        </div>
      </div>
    );
  }

  const initialState = await getSupportSpaceStateAction(company.slug);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-900">
              <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
              SALA AO VIVO
            </span>
            <h1 className="text-2xl font-bold text-[#0a0a0a]">
              Suporte ao Vivo & Espaço de Carreiras
            </h1>
          </div>
          <p className="mt-1 text-sm text-[#71717a]">
            Gerencie os Balcões de Atendimento 1 a 3, acompanhe o Mural de Vagas integrado, os Bots Assistentes de dúvidas e as orientações de avisos para candidatos.
          </p>
        </div>

        <Link
          href={`/${company.slug}/espaco`}
          target="_blank"
          className="rounded-2xl border border-[#e4e4e7] bg-white px-4 py-2 text-xs font-bold text-[#0a0a0a] shadow-2xs transition hover:bg-stone-50"
        >
          Abrir Link Público da Sala ↗
        </Link>
      </div>

      <VirtualCareerSpace
        companySlug={company.slug}
        companyName={company.name}
        initialState={initialState}
        embeddedInGestorPanel
      />
    </div>
  );
}

