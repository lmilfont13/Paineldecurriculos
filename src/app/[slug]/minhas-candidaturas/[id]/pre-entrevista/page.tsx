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
  if (!application) notFound();

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

        {pending ? (
          <PreInterviewForm
            slug={slug}
            applicationId={id}
            fields={fields}
            companyName={company.name}
          />
        ) : (
          <p className="mt-8 rounded-2xl border border-[#e4e4e7] bg-white p-6 text-sm text-[#71717a]">
            {application.infoAnsweredAt
              ? "Recebemos suas informações. Obrigado!"
              : "Não há nada pendente por aqui."}
          </p>
        )}
      </main>
      <CompanyFooter company={company} />
    </>
  );
}
