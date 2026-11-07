import type { Metadata } from "next";
import Link from "next/link";
import { VirtualCareerSpace } from "@/components/public/virtual-career-space";
import { getGestorShell } from "@/server/controllers/gestor.controller";
import { getSupportSpaceStateAction } from "@/server/controllers/support.controller";

export const metadata: Metadata = {
  title: "Suporte ao Vivo & Espaço Virtual · Triagem",
};

export default async function GestorLiveSupportPage() {
  const { company } = await getGestorShell();
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

