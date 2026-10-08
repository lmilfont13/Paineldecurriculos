import type { Metadata } from "next";
import Link from "next/link";

import { IntakeForm } from "@/components/gestor/intake-form";
import { getVagasPageData } from "@/server/controllers/gestor.controller";

export const metadata: Metadata = { title: "Adicionar candidatos · Triagem" };

/**
 * Cadastro rápido: o gestor cola os e-mails (de quem mandou currículo por
 * e-mail, WhatsApp, indicação…) e as candidaturas já ficam no funil. Cada
 * pessoa completa depois pelo link da vaga.
 */
export default async function NovoCandidatoPage({
  searchParams,
}: {
  searchParams: Promise<{ vaga?: string }>;
}) {
  const { vaga } = await searchParams;
  const { jobs } = await getVagasPageData();
  const openJobs = jobs.filter((j) => j.status === "OPEN").map((j) => ({ id: j.id, title: j.title }));

  return (
    <div className="mx-auto w-full max-w-[720px]">
      <Link href="/candidaturas" className="text-[13px] text-[#71717a] hover:text-[#0a0a0a]">
        ← Candidatos
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-[#0a0a0a]">Adicionar candidatos por e-mail</h1>
      <p className="mt-2 text-sm text-[#71717a]">
        Para quem ainda não entrou no site: coloque o e-mail e a pessoa já entra no funil da vaga como{" "}
        <strong className="font-medium text-[#a16207]">cadastro incompleto</strong>. Depois ela completa pelo link,
        criando a senha com o mesmo e-mail. Se você tiver o currículo, anexe na tela do candidato e a IA já analisa.
      </p>
      {openJobs.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-[#e4e4e7] bg-white p-6 text-sm text-[#71717a]">
          Nenhuma vaga aberta. Publique uma vaga primeiro.
        </p>
      ) : (
        <IntakeForm jobs={openJobs} initialJobId={vaga && openJobs.some((j) => j.id === vaga) ? vaga : openJobs[0].id} />
      )}
    </div>
  );
}
