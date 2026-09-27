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

export const metadata: Metadata = { title: "Entrar" };

/**
 * CA1 · Conta do candidato. Chega-se aqui por dois caminhos: ao clicar em
 * "Candidatar-se" (criar conta é o passo natural) ou pelo "Entrar" do
 * cabeçalho (quem já tem conta quer ver o andamento).
 */
export default async function CandidateEntrarPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ next?: string; modo?: string }>;
}) {
  const [{ slug }, { next, modo }] = await Promise.all([params, searchParams]);
  const company = await getTenant(slug);
  if (!company) notFound();

  const destination =
    next && next.startsWith("/") && !next.startsWith("//")
      ? next
      : `/${slug}/minhas-candidaturas`;
  const applying = destination.includes("/candidatar");

  // Já logado → segue direto para o destino
  if (await getPublicSession()) redirect(destination);

  return (
    <>
      <CompanyHeader company={company} candidate={null} showSignIn={false} />
      <main className="mx-auto w-full max-w-[440px] flex-1 px-5 pt-12">
        <h1 className="text-center text-2xl font-semibold text-[#1c1917]">
          {applying ? "Falta pouco para se candidatar" : "Acesse sua área"}
        </h1>
        <p className="mx-auto mt-2 max-w-[360px] text-center text-sm leading-6 text-[#78716c]">
          {applying
            ? "Você cria a conta uma vez. Nas próximas vagas, seus dados já vêm preenchidos."
            : `Veja em que etapa estão suas candidaturas na ${company.name} e as novidades de cada uma.`}
        </p>
        <div className="mt-8">
          <CandidateAuthForm
            next={destination}
            initialMode={modo === "entrar" ? "login" : "signup"}
          />
        </div>
      </main>
      <CompanyFooter company={company} />
    </>
  );
}
