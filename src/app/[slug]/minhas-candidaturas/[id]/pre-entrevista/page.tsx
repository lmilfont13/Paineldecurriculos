import { WrongAccountNotice } from "@/components/public/wrong-account-notice";
import { signInPath } from "@/server/models/candidate.model";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  CompanyFooter,
  CompanyHeader,
} from "@/components/public/company-header";
import { PreInterviewForm } from "@/components/public/pre-interview-form";
import { getMinhaCandidaturaData } from "@/server/controllers/public.controller";
import { INFO_FIELDS, type InfoField } from "@/server/models/pre-interview.model";

export const metadata: Metadata = { title: "Informações para a conversa · Triagem" };

/** Pré-entrevista (candidato): só as perguntas que o gestor pediu. */
export default async function PreEntrevistaPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const data = await getMinhaCandidaturaData(slug, id);
  if (!data) notFound();
  if (!data.candidate) {
    redirect(
      signInPath(slug, `/${slug}/minhas-candidaturas/${id}/pre-entrevista`)
    );
  }
  const { company, candidate, application } = data;
  if (!application) {
    return (
      <>
        <CompanyHeader company={company} candidate={candidate} />
        <main className="mx-auto w-full max-w-[560px] flex-1 px-6">
          <WrongAccountNotice slug={slug} nextPath={`/${slug}/minhas-candidaturas/${id}/pre-entrevista`} currentEmail={candidate.email} />
        </main>
        <CompanyFooter company={company} />
      </>
    );
  }

  const fields = (application.infoRequestedFields as string[]).filter(
    (f): f is InfoField => (INFO_FIELDS as readonly string[]).includes(f)
  );
  const pending = fields.length > 0 && !application.infoAnsweredAt;

  return (
    <>
      <CompanyHeader company={company} candidate={candidate} />
      <main className="mx-auto w-full max-w-[560px] flex-1 px-6 pt-12">
        <Link
          href={`/${slug}/minhas-candidaturas/${id}`}
          className="text-[13px] font-medium text-[#71717a] hover:text-[#0a0a0a]"
        >
          ← Minha candidatura
        </Link>
        <h1 className="mt-5 text-2xl font-bold text-[#0a0a0a]">
          Falta pouco para a conversa
        </h1>
        <p className="mt-1 text-sm text-[#71717a]">
          {application.job.title} · {application.company.name}
        </p>

        {pending && (
          <p className="mt-5 rounded-2xl border border-[#f0e3c8] bg-[#fdfaf3] p-4 text-sm leading-6 text-[#57534e]">
            Seu currículo avançou! Para a <strong className="text-[#0a0a0a]">próxima fase</strong>, a{" "}
            {company.name} precisa dos dados abaixo. Sem eles não conseguimos seguir com o seu
            processo, então preencha com atenção.
          </p>
        )}

        {pending ? (
          <PreInterviewForm
            slug={slug}
            applicationId={id}
            fields={fields}
            companyName={company.name}
          />
        ) : (
          <div className="mt-8 rounded-2xl border border-[#e4e4e7] bg-white p-6 text-sm leading-6 text-[#57534e]">
            {application.infoAnsweredAt ? (
              <>
                <p className="font-semibold text-[#0a0a0a]">Recebemos suas informações. Obrigado!</p>
                <p className="mt-2">
                  A sua avaliação está em andamento e estamos próximos da entrevista. Assim que
                  tivermos novidades, a {company.name} entra em contato com você. Acompanhe pela
                  página da sua candidatura.
                </p>
              </>
            ) : (
              "Não há nada pendente por aqui."
            )}
          </div>
        )}
      </main>
      <CompanyFooter company={company} />
    </>
  );
}
