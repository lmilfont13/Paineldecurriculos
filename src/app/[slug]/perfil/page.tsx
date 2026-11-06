import { Radio } from "lucide-react";
import { signInPath } from "@/server/models/candidate.model";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import {
  CompanyFooter,
  CompanyHeader,
} from "@/components/public/company-header";
import { ProfileForm } from "@/components/public/profile-form";
import {
  getPublicSession,
  getTenant,
} from "@/server/controllers/public.controller";
import { getActiveRadioStation } from "@/server/services/message-template.service";

export const metadata: Metadata = { title: "Meu perfil · Triagem" };

/** CA5 · Perfil do candidato (+ CA8 · exclusão de conta). */
export default async function PerfilPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Sequencial: com connection_limit=1 o Promise.all só enfileira na
  // mesma conexão e aumenta o risco de P2024 (pool_timeout).
  const company = await getTenant(slug);
  const candidate = await getPublicSession();
  if (!company) notFound();
  if (!candidate) {
    redirect(signInPath(slug, `/${slug}/perfil`));
  }

  const radioStation = await getActiveRadioStation(company.id);

  return (
    <>
      <CompanyHeader company={company} candidate={candidate} />
      <main className="mx-auto w-full max-w-[560px] flex-1 px-6 pt-14">
        <h1 className="text-2xl font-bold text-[#0a0a0a]">Meu perfil</h1>
        <p className="mt-2 text-sm text-[#71717a]">
          Esses dados preenchem automaticamente suas próximas candidaturas.
        </p>

        {/* Rádio da Empresa configurada pelo Gestor (replicada e tocando em toda a área) */}
        <div className="mt-6 flex items-center gap-3.5 rounded-2xl border border-[#e4e4e7] bg-white p-4 shadow-xs">
          <div
            className="flex size-11 shrink-0 items-center justify-center rounded-xl text-white shadow-xs"
            style={{ backgroundColor: "var(--brand-primary, #0a0a0a)" }}
          >
            <Radio className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                RÁDIO DA EMPRESA ATIVA
              </span>
            </div>
            <h3 className="mt-1 truncate text-sm font-extrabold text-[#0a0a0a]">
              {radioStation?.name || "Hunter FM - Pop Hits"}
            </h3>
            <p className="truncate text-xs text-[#71717a]">
              {radioStation?.genre || "Pop / Hits"} · Tocando continuamente na barra inferior em todas as telas
            </p>
          </div>
        </div>

        <div className="mt-8">
          <ProfileForm slug={slug} candidate={candidate} />
        </div>
      </main>
      <CompanyFooter company={company} />
    </>
  );
}
