import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileText, MapPin, Plus } from "lucide-react";

import { CopyLink } from "@/components/gestor/copy-link";
import { getVagasPageData } from "@/server/controllers/gestor.controller";
import {
  contractLabels,
  formatPublishedAgo,
  getJobAccentTheme,
  jobStatusLabels,
  parseJobTitleAndCity,
  workModeLabels,
} from "@/server/models/job.model";
import { appUrl } from "@/lib/env";

export const metadata: Metadata = { title: "Vagas · Triagem" };

const statusStyles = {
  OPEN: {
    badge: "border-emerald-200/80 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-600",
  },
  PAUSED: {
    badge: "border-amber-200/80 bg-amber-50 text-amber-700",
    dot: "bg-amber-600",
  },
  CLOSED: {
    badge: "border-zinc-200 bg-zinc-100 text-zinc-600",
    dot: "bg-zinc-400",
  },
  DRAFT: {
    badge: "border-zinc-200 bg-zinc-100 text-zinc-600",
    dot: "bg-zinc-400",
  },
} as const;

export default async function VagasPage() {
  const { companySlug, jobs } = await getVagasPageData();
  const openCount = jobs.filter((j) => j.status === "OPEN").length;
  const publicUrl = `${appUrl()}/${companySlug}/vagas`;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0a0a0a]">Vagas</h1>
          <p className="mt-1 text-sm text-[#71717a]">
            {jobs.length === 1 ? "1 vaga cadastrada" : `${jobs.length} vagas cadastradas`} ·{" "}
            <span className="font-medium text-emerald-700">{openCount} abertas</span>
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <CopyLink url={publicUrl} compact />
          <a
            href="/relatorio-geral"
            target="_blank"
            rel="noopener noreferrer"
            title="Relatório em PDF com todas as vagas e o perfil dos candidatos"
            className="flex h-10 items-center gap-1.5 rounded-2xl border border-[#e4e4e7] bg-white px-4 text-[13px] font-medium text-[#0a0a0a] shadow-2xs transition-colors hover:bg-[#fafaf9]"
          >
            <FileText className="size-3.5 text-zinc-500" />
            <span>Relatório geral (PDF)</span>
          </a>
          <Link
            href="/vagas/nova"
            className="flex h-10 items-center gap-1.5 rounded-2xl px-5 text-[13px] font-medium shadow-2xs transition-opacity hover:opacity-90"
            style={{
              backgroundColor: "var(--brand-primary)",
              color: "var(--brand-foreground)",
            }}
          >
            <Plus className="size-4" strokeWidth={2.5} />
            <span>Nova vaga</span>
          </Link>
        </div>
      </div>

      <div className="mt-7 space-y-3.5">
        {jobs.length === 0 && (
          <div className="rounded-3xl border border-dashed border-[#e4e4e7] bg-white p-8 text-center">
            <p className="text-sm font-medium text-[#0a0a0a]">Nenhuma vaga cadastrada ainda.</p>
            <p className="mt-1 text-xs text-[#71717a]">Crie a primeira vaga com &ldquo;+ Nova vaga&rdquo; para começar a receber candidaturas.</p>
          </div>
        )}
        {jobs.map((job, idx) => {
          const theme = getJobAccentTheme(job.id || idx);
          const { role, city } = parseJobTitleAndCity(job.title);
          const style = statusStyles[job.status];
          const metaParts = [
            workModeLabels[job.workMode],
            contractLabels[job.contract],
            formatPublishedAgo(job.createdAt).replace("publicada ", ""),
          ].filter(Boolean);

          return (
            <Link
              key={job.id}
              href={`/vagas/${job.id}`}
              className={`group block rounded-2xl border ${theme.border} bg-white p-4.5 sm:p-5 transition-all hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.06)] hover:border-zinc-300`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Lado Esquerdo: Barra do tema + Código + Cargo + Praça/Cidade em destaque + Status */}
                <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                  <span className={`h-5 w-1.5 shrink-0 rounded-full ${theme.bar}`} aria-hidden />
                  {job.code && (
                    <span className={`rounded-lg px-2.5 py-0.5 text-[11px] font-bold tabular-nums shadow-2xs ${theme.code}`}>
                      #{job.code}
                    </span>
                  )}
                  <h2 className="text-[15px] font-bold tracking-tight text-zinc-900 group-hover:text-[#7c1d3c] transition-colors">
                    {role}
                  </h2>
                  {city && (
                    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide shadow-2xs ${theme.cityTag}`}>
                      <MapPin className="size-3 shrink-0 opacity-80" strokeWidth={2.5} />
                      {city}
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${style.badge}`}
                  >
                    <span className={`size-1.5 rounded-full ${style.dot}`} />
                    {jobStatusLabels[job.status]}
                  </span>
                </div>

                {/* Lado Direito: Ação Abrir */}
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-zinc-600 transition-colors group-hover:text-[#0a0a0a]">
                    <span>Abrir funil</span>
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>

              {/* Linha Inferior: Meta + Contadores de volume e pendência */}
              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-y-2 border-t border-zinc-100 pt-3 text-xs text-[#71717a]">
                <div className="flex flex-wrap items-center gap-2">
                  <span>{metaParts.join(" · ")}</span>
                  {job.location && !city && (
                    <>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" />
                        {job.location}
                      </span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span className="rounded-full border border-zinc-200/80 bg-zinc-50 px-2.5 py-0.5 text-[11px] font-medium text-zinc-700 tabular-nums">
                    {job.applicationCount} {job.applicationCount === 1 ? "candidato" : "candidatos"}
                  </span>

                  {job.pendingCount > 0 ? (
                    <span className="rounded-full border border-amber-200/80 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 tabular-nums">
                      ● {job.pendingCount} esperando resposta
                    </span>
                  ) : (
                    <span className="rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                      ✓ fila em dia
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
