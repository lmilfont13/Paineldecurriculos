import type { Metadata } from "next";
import Link from "next/link";

import { AiScoreChip } from "@/components/gestor/ai-score-chip";
import { getCandidaturasPageData } from "@/server/controllers/gestor.controller";
import {
  appStatusLabels,
  formatAppliedAt,
  type AppStatusKey,
} from "@/server/models/application.model";
import { personInitials } from "@/server/models/dashboard.model";

export const metadata: Metadata = { title: "Candidaturas · Triagem" };

const statusPill: Record<AppStatusKey, string> = {
  PENDING: "bg-[#f1f0ed] text-[#a1a1aa]",
  INTERVIEW: "bg-[#f7f0e1] text-[#b07818]",
  APPROVED: "bg-[#e4f6ec] text-[#1f7a4d]",
  REJECTED: "bg-[#fbeae8] text-[#c23b3b]",
};

/** E3 · Candidaturas (frame 89:193 do Figma), com filtro por vaga (E9). */
export default async function CandidaturasPage({
  searchParams,
}: {
  searchParams: Promise<{ vaga?: string }>;
}) {
  const { vaga } = await searchParams;
  const { applications, jobs } = await getCandidaturasPageData(vaga);

  return (
    <>
      <h1 className="text-2xl font-bold text-[#0a0a0a]">Candidaturas</h1>

      {/* Filtro por vaga (GET) */}
      <form method="GET" className="mt-6 flex items-center gap-3">
        <select
          name="vaga"
          defaultValue={vaga ?? ""}
          className="h-10 w-[300px] rounded-lg border border-[#e4e4e7] bg-white px-3 text-[13px] text-[#0a0a0a] focus:border-[#0a0a0a] focus:outline-none"
        >
          <option value="">Vaga · Todas</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              Vaga · {job.title}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-10 rounded-lg bg-[#e7e5e4] px-4 text-[13px] font-medium text-[#0a0a0a] hover:bg-[#dedcda]"
        >
          Filtrar
        </button>
        <span className="ml-auto text-[13px] text-[#71717a]">
          Ordenado por maior score IA
        </span>
      </form>

      <div className="mt-6 overflow-hidden rounded-xl border border-[#e4e4e7] bg-white">
        <div className="grid grid-cols-[minmax(200px,2fr)_170px_140px_60px_90px] items-center gap-4 border-b border-[#e4e4e7] px-5 py-3.5">
          {["CANDIDATO", "ADERÊNCIA · IA", "STATUS", "CV", ""].map((h, i) => (
            <span
              key={i}
              className="text-[11px] font-medium tracking-[0.6px] text-[#a1a1aa]"
            >
              {h}
            </span>
          ))}
        </div>
        {applications.length === 0 && (
          <p className="p-6 text-sm text-[#71717a]">
            Nenhuma candidatura {vaga ? "para esta vaga" : "ainda"}.
          </p>
        )}
        {applications.map((app) => (
          <div
            key={app.id}
            className="grid grid-cols-[minmax(200px,2fr)_170px_140px_60px_90px] items-center gap-4 border-b border-[#e4e4e7] px-5 py-4 last:border-b-0"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1c1917] text-[10px] font-bold text-white">
                {personInitials(app.name)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-[#0a0a0a]">
                  {app.name}
                </span>
                <span className="block truncate text-[11px] text-[#a1a1aa]">
                  candidatou-se em {formatAppliedAt(app.createdAt)} ·{" "}
                  {app.job.title}
                </span>
              </span>
            </div>
            <AiScoreChip
              aiScore={app.aiScore}
              aiState={app.aiState}
              meetsMinimum={
                app.aiScore !== null && app.aiScore >= app.job.aiMinScore
              }
            />
            <span
              className={`inline-flex h-6 w-fit items-center gap-1.5 rounded-full px-3 text-[11px] font-medium ${statusPill[app.status]}`}
            >
              <span className="size-1.5 rounded-full bg-current" />
              {appStatusLabels[app.status]}
            </span>
            {app.resumeUrl ? (
              <a
                href={`/candidaturas/${app.id}/cv`}
                className="text-sm text-[#71717a] hover:text-[#0a0a0a]"
                title="Baixar currículo"
              >
                ↓
              </a>
            ) : (
              <span className="text-sm text-[#e4e4e7]">—</span>
            )}
            <Link
              href={`/candidaturas/${app.id}`}
              className="text-right text-xs font-medium hover:underline"
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
