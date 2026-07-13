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

export const metadata: Metadata = { title: "Meu perfil · Triagem" };

/** CA5 · Perfil do candidato (+ CA8 · exclusão de conta). */
export default async function PerfilPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [company, candidate] = await Promise.all([
    getTenant(slug),
    getPublicSession(),
  ]);
  if (!company) notFound();
  if (!candidate) {
    redirect(`/${slug}/entrar?next=${encodeURIComponent(`/${slug}/perfil`)}`);
  }

  return (
    <>
      <CompanyHeader company={company} candidate={candidate} />
      <main className="mx-auto w-full max-w-[560px] flex-1 px-6 pt-14">
        <h1 className="text-2xl font-bold text-[#0a0a0a]">Meu perfil</h1>
        <p className="mt-2 text-sm text-[#71717a]">
          Esses dados preenchem automaticamente suas próximas candidaturas.
        </p>
        <div className="mt-8">
          <ProfileForm slug={slug} candidate={candidate} />
        </div>
      </main>
      <CompanyFooter company={company} />
    </>
  );
}
