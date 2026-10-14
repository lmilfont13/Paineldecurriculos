import type { Metadata } from "next";
import Link from "next/link";

import { BatchResumeForm } from "@/components/gestor/batch-resume-form";
import { IntakeForm } from "@/components/gestor/intake-form";
import { getVagasPageData } from "@/server/controllers/gestor.controller";

export const metadata: Metadata = { title: "Adicionar candidatos · Triagem" };

// Cada PDF do lote é lido (e o contato extraído) numa chamada própria.
export const maxDuration = 60;

/**
 * Pré-cadastro pelo gestor, de dois jeitos: vários currículos em PDF de uma
 * vez (o sistema lê nome, e-mail e telefone e já manda para a IA) ou só a
 * lista de e-mails. Cada pessoa entra como "cadastro incompleto" e completa
 * depois pelo link da vaga.
 */
export default async function NovoCandidatoPage({
  searchParams,
}: {
  searchParams: Promise<{ vaga?: string; modo?: string }>;
}) {
  const { vaga, modo } = await searchParams;
  const { jobs } = await getVagasPageData();
  const openJobs = jobs.filter((j) => j.status === "OPEN").map((j) => ({ id: j.id, title: j.title }));
  const initialJobId = vaga && openJobs.some((j) => j.id === vaga) ? vaga : openJobs[0]?.id;
  const byEmail = modo === "email";
  const tab = (active: boolean) =>
    "rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors " +
    (active ? "bg-white text-[#0a0a0a] shadow-sm" : "text-[#71717a] hover:text-[#0a0a0a]");
  const qs = vaga ? `&vaga=${vaga}` : "";

  return (
    <div className="mx-auto w-full max-w-[760px]">
      <Link href="/candidaturas" className="text-[13px] text-[#71717a] hover:text-[#0a0a0a]">
        ← Candidatos
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-[#0a0a0a]">Adicionar candidatos</h1>
      <p className="mt-2 text-sm text-[#71717a]">
        Para quem mandou currículo por fora (e-mail, WhatsApp, indicação). Cada pessoa entra no funil da vaga como{" "}
        <strong className="font-medium text-[#a16207]">cadastro incompleto</strong> e completa depois pelo link,
        criando a senha com o mesmo e-mail.
      </p>

      <div role="tablist" className="mt-5 inline-flex rounded-xl bg-[#f4f4f5] p-1">
        <Link href={`/candidaturas/novo?modo=pdf${qs}`} role="tab" aria-selected={!byEmail} className={tab(!byEmail)}>
          Vários currículos (PDF)
        </Link>
        <Link href={`/candidaturas/novo?modo=email${qs}`} role="tab" aria-selected={byEmail} className={tab(byEmail)}>
          Só e-mails
        </Link>
      </div>

      {!initialJobId ? (
        <p className="mt-6 rounded-xl border border-dashed border-[#e4e4e7] bg-white p-6 text-sm text-[#71717a]">
          Nenhuma vaga aberta. Publique uma vaga primeiro.
        </p>
      ) : byEmail ? (
        <IntakeForm jobs={openJobs} initialJobId={initialJobId} />
      ) : (
        <>
          <p className="mt-4 text-[12px] text-[#71717a]">
            O sistema lê cada PDF, preenche nome, e-mail e telefone, faz o pré-cadastro e a IA já analisa o currículo
            para a vaga. Se o PDF não tiver e-mail, você digita na hora.
          </p>
          <BatchResumeForm jobs={openJobs} initialJobId={initialJobId} />
        </>
      )}
    </div>
  );
}
