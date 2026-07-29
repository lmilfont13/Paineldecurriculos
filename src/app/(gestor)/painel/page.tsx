import type { Metadata } from "next";
import Link from "next/link";

import { AiScoreChip } from "@/components/gestor/ai-score-chip";
import { CopyLink } from "@/components/gestor/copy-link";
import { getPainelData } from "@/server/controllers/gestor.controller";
import { personInitials } from "@/server/models/dashboard.model";

export const metadata: Metadata = { title: "Painel · Triagem" };

/** E1 · Painel (frame 89:20 do Figma). */
export default async function PainelPage() {
  const { userName, companyName, publicUrl, stats, priority } =
    await getPainelData();
  const firstName = userName.split(" ")[0];

  // Primeiro uso (nenhuma vaga ainda): induz a G4 em vez de mostrar zeros.
  if (stats.totalJobs === 0) {
    return (
      <>
        <h1 className="text-2xl font-bold text-[#0a0a0a]">Olá, {firstName}</h1>
        <p className="mt-2 text-sm text-[#71717a]">
          Vamos colocar a {companyName} para receber candidaturas.
        </p>

        <div className="mt-8 max-w-[560px] rounded-2xl border border-[#e4e4e7] bg-white p-8">
          <span
            className="flex size-11 items-center justify-center rounded-xl text-lg font-bold"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--brand-primary) 12%, transparent)",
              color: "var(--brand-primary)",
            }}
          >
            1
          </span>
          <h2 className="mt-4 text-lg font-semibold text-[#0a0a0a]">
            Publique sua primeira vaga
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-[#71717a]">
            Descreva a vaga, defina os critérios que a IA deve avaliar e
            publique. Em seguida é só divulgar o link e acompanhar as
            candidaturas por aqui.
          </p>
          <Link
            href="/vagas/nova"
            className="mt-6 inline-flex h-11 items-center rounded-2xl px-6 text-sm font-medium transition-opacity hover:opacity-90"
            style={{
              backgroundColor: "var(--brand-primary)",
              color: "var(--brand-foreground)",
            }}
          >
            + Criar vaga
          </Link>

          <div className="mt-8 border-t border-[#e4e4e7] pt-6">
            <p className="text-[13px] font-medium text-[#0a0a0a]">
              Seu link de carreiras
            </p>
            <p className="mb-2 mt-0.5 text-xs text-[#71717a]">
              Compartilhe no LinkedIn, no site ou por WhatsApp — é por aqui que
              os candidatos chegam.
            </p>
            <CopyLink url={publicUrl} />
          </div>
        </div>
      </>
    );
  }

  const cards = [
    {
      value: stats.openJobs,
      label: "Vagas abertas",
      hint: `de ${stats.totalJobs} no total`,
      href: "/vagas",
    },
    {
      value: stats.newApplications7d,
      label: "Candidaturas novas",
      hint: "últimos 7 dias",
      href: "/candidaturas?status=PENDING",
    },
    {
      value: stats.meetingMinimum,
      label: "Atendem o mínimo",
      hint: "sinalizadas pela IA",
      green: true,
      href: "/candidaturas?atende=1",
    },
    {
      value: stats.inInterview,
      label: "Em entrevista",
      hint: "aguardando decisão",
      href: "/candidaturas?status=INTERVIEW",
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0a0a0a]">Olá, {firstName}</h1>
          <p className="mt-2 text-sm text-[#71717a]">
            Resumo do recrutamento da {companyName} hoje.
          </p>
        </div>
        <Link
          href="/vagas/nova"
          className="flex h-10 items-center rounded-2xl px-5 text-[13px] font-medium transition-opacity hover:opacity-90"
          style={{
            backgroundColor: "var(--brand-primary)",
            color: "var(--brand-foreground)",
          }}
        >
          + Nova vaga
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="group rounded-xl border border-[#e4e4e7] bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-[#d4d4d8] hover:shadow-[0px_4px_12px_rgba(0,0,0,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/40"
          >
            <p
              className={
                "text-4xl font-bold " +
                (card.green ? "text-[#1f7a4d]" : "text-[#0a0a0a]")
              }
            >
              {card.value}
            </p>
            <p className="mt-3 flex items-center gap-1 text-sm font-medium text-[#0a0a0a]">
              {card.label}
              <span className="text-[#a1a1aa] opacity-0 transition-opacity group-hover:opacity-100">
                ›
              </span>
            </p>
            <p className="text-[11px] text-[#71717a]">{card.hint}</p>
          </Link>
        ))}
      </div>

      <div className="mt-10 flex items-baseline gap-4">
        <h2 className="text-[15px] font-semibold text-[#0a0a0a]">
          Precisam da sua atenção
        </h2>
        <span className="text-xs text-[#71717a]">Priorizado pela IA</span>
      </div>

      <div className="mt-4 max-w-[848px] overflow-hidden rounded-xl border border-[#e4e4e7] bg-white">
        {priority.length === 0 && (
          <p className="p-6 text-sm text-[#71717a]">
            Nenhuma candidatura pendente no momento.
          </p>
        )}
        {priority.map((app) => (
          <Link
            key={app.id}
            href={`/candidaturas/${app.id}`}
            className="flex items-center gap-3.5 border-b border-[#e4e4e7] px-5 py-4 transition-colors last:border-b-0 hover:bg-[#fafaf9] focus-visible:bg-[#fafaf9] focus-visible:outline-none"
          >
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
            <span
              className="ml-6 text-xs font-medium"
              style={{ color: "var(--brand-primary)" }}
            >
              Abrir ›
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
