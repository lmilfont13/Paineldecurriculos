import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { CandidateAuthForm } from "@/components/public/candidate-auth-form";
import {
  CompanyFooter,
  CompanyHeader,
} from "@/components/public/company-header";
import {
  getPublicSession,
  getTenant,
} from "@/server/controllers/public.controller";

export const metadata: Metadata = { title: "Entrar · Triagem" };

/** CA1 · Conta do candidato — pedida ao clicar em "Candidatar-se". */
export default async function CandidateEntrarPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const [{ slug }, { next }] = await Promise.all([params, searchParams]);
  const company = await getTenant(slug);
  if (!company) notFound();

  const destination =
    next && next.startsWith("/") ? next : `/${slug}/vagas`;

  // Já logado → segue direto para o destino
  if (await getPublicSession()) redirect(destination);

  return (
    <>
      <CompanyHeader company={company} candidate={null} />
      <main className="mx-auto w-full max-w-[440px] flex-1 px-6 pt-14">
        <h1 className="text-center text-2xl font-semibold text-[#0a0a0a]">
          Falta pouco para se candidatar
        </h1>
        <p className="mt-2 text-center text-sm text-[#71717a]">
          Crie sua conta uma vez — nas próximas vagas, tudo já vem preenchido.
        </p>
        <div className="mt-8">
          <CandidateAuthForm next={destination} />
        </div>
      </main>
      <CompanyFooter company={company} />
    </>
  );
}
