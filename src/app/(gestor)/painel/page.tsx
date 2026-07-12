import type { Metadata } from "next";
import Link from "next/link";

import { AiScoreChip } from "@/components/gestor/ai-score-chip";
import { getPainelData } from "@/server/controllers/gestor.controller";
import { personInitials } from "@/server/models/dashboard.model";

export const metadata: Metadata = { title: "Painel · Triagem" };

/** E1 · Painel (frame 89:20 do Figma). */
export default async function PainelPage() {
  const { userName, companyName, stats, priority } = await getPainelData();
  const firstName = userName.split(" ")[0];

  const cards = [
    {
      value: stats.openJobs,
      label: "Vagas abertas",
      hint: `de ${stats.totalJobs} no total`,
    },
    {
      value: stats.newApplications7d,
      label: "Candidaturas novas",
      hint: "últimos 7 dias",
    },
    {
      value: stats.meetingMinimum,
      label: "Atendem o mínimo",
      hint: "sinalizadas pela IA",
      green: true,
    },
    {
      value: stats.inInterview,
      label: "Em entrevista",
      hint: "aguardando decisão",
    },
  ];

  return (
    <>
      <h1 className="text-2xl font-bold text-[#0a0a0a]">Olá, {firstName}</h1>
      <p className="mt-2 text-sm text-[#71717a]">
        Resumo do recrutamento da {companyName} hoje.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-[#e4e4e7] bg-white p-5"
          >
            <p
              className={
                "text-4xl font-bold " +
                (card.green ? "text-[#1f7a4d]" : "text-[#0a0a0a]")
              }
            >
              {card.value}
            </p>
            <p className="mt-3 text-sm font-medium text-[#0a0a0a]">
              {card.label}
            </p>
            <p className="text-[11px] text-[#71717a]">{card.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 flex items-baseline gap-4">
        <h2 className="text-[15px] font-semibold text-[#0a0a0a]">
          Precisam da sua atenção
        </h2>
        <span className="text-xs text-[#71717a]">Priorizado pela IA</span>
      </div>

      <div className="mt-4 max-w-[848px] divide-y divide-[#e4e4e7] rounded-xl border border-[#e4e4e7] bg-white">
        {priority.length === 0 && (
          <p className="p-6 text-sm text-[#71717a]">
            Nenhuma candidatura pendente no momento.
          </p>
        )}
        {priority.map((app) => (
          <div key={app.id} className="flex items-center gap-3.5 px-5 py-4">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1c1917] text-[10px] font-bold text-white">
              {personInitials(app.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-[#0a0a0a]">
                {app.name}
              </span>
              <span className="block truncate text-[11px] text-[#71717a]">
                {app.jobTitle}
              </span>
            </span>
            <AiScoreChip
              aiScore={app.aiScore}
              aiState={app.aiState}
              meetsMinimum={app.meetsMinimum}
            />
            <Link
              href={`/candidaturas/${app.id}`}
              className="ml-6 text-xs font-medium hover:underline"
              style={{ color: "var(--brand-primary)" }}
            >
              Abrir ›
            </Link>
          </div>
        ))}
      </div>
    </>
  );
}
