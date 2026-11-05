import { signInPath } from "@/server/models/candidate.model";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { CandidateRadioPlayer } from "@/components/public/candidate-radio-player";
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

        {/* Rádio da Empresa configurada pelo Gestor (apenas escutar e mutar) */}
        <div className="mt-6">
          <CandidateRadioPlayer station={radioStation} companyName={company.name} />
        </div>

        <div className="mt-8">
          <ProfileForm slug={slug} candidate={candidate} />
        </div>
      </main>
      <CompanyFooter company={company} />
    </>
  );
}
