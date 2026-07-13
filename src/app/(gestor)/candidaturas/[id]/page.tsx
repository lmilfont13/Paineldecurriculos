import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LiveRefresh } from "@/components/gestor/live-refresh";
import {
  DecisionButtons,
  StatusSegment,
} from "@/components/gestor/status-segment";
import { getCandidaturaDetail } from "@/server/controllers/gestor.controller";
import { formatAppliedAt } from "@/server/models/application.model";
import { personInitials } from "@/server/models/dashboard.model";

export const metadata: Metadata = { title: "Candidatura · Triagem" };

/** E4 · Detalhe da candidatura com bloco de IA (frame 89:325 do Figma). */
export default async function CandidaturaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const app = await getCandidaturaDetail(id);
  if (!app) notFound();

  const meets = app.aiScore !== null && app.aiScore >= app.job.aiMinScore;
  const coreAnswers = app.answers.filter((a) => a.field.isCore);
  const customAnswers = app.answers.filter((a) => !a.field.isCore);
  const infoPairs: [string, string][] = [
    ["E-mail", app.email],
    ["Telefone", app.phone ?? "—"],
    ...coreAnswers.map(
      (a) => [a.field.label, a.value] as [string, string]
    ),
    ...customAnswers.map(
      (a) => [a.field.label, a.value] as [string, string]
    ),
  ];

  const analyzing = app.aiState === "WAITING" || app.aiState === "PROCESSING";

  return (
    <div className="mx-auto max-w-[640px] rounded-2xl border border-[#e4e4e7] bg-white p-8 shadow-sm">
      <LiveRefresh active={analyzing} />
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.6px] text-[#a1a1aa]">
          Candidatura · {app.job.title}
        </p>
        <Link
          href="/candidaturas"
          aria-label="Fechar"
          className="text-sm text-[#a1a1aa] hover:text-[#0a0a0a]"
        >
          ✕
        </Link>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <span className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-[#1c1917] text-[15px] font-bold text-white">
          {personInitials(app.name)}
        </span>
        <div>
          <h1 className="text-xl font-bold text-[#0a0a0a]">{app.name}</h1>
          <p className="mt-0.5 text-xs text-[#71717a]">
            Candidatou-se em {formatAppliedAt(app.createdAt, true)}
          </p>
        </div>
      </div>

      {/* Bloco de IA — só leitura; nunca muda o status (regra 2) */}
      <section className="mt-6 rounded-xl border border-[#e4e4e7] bg-[#fafaf9] p-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.6px] text-[#a1a1aa]">
          Análise de aderência · IA
        </p>
        {app.aiState === "DONE" && app.aiScore !== null ? (
          <>
            <div className="mt-2 flex items-center gap-4">
              <p className="text-5xl font-bold text-[#0a0a0a]">
                {app.aiScore}
                <span className="ml-1 text-sm font-normal text-[#a1a1aa]">
                  /100
                </span>
              </p>
              <div>
                <span
                  className={
                    "inline-flex h-[30px] items-center gap-2 rounded-lg px-3.5 text-xs font-semibold " +
                    (meets
                      ? "bg-[#e4f6ec] text-[#1f7a4d]"
                      : "bg-[#fbeae8] text-[#c23b3b]")
                  }
                >
                  <span className="size-1.5 rounded-full bg-current" />
                  {meets ? "Atende" : "Não atende"}
                </span>
                <p className="mt-1.5 text-[11px] text-[#71717a]">
                  score mínimo: {app.job.aiMinScore}
                </p>
              </div>
            </div>
            {app.aiReasoning && (
              <p className="mt-4 text-xs leading-[18px] text-[#0a0a0a]">
                {app.aiReasoning}
              </p>
            )}
          </>
        ) : (
          <div className="mt-3 flex items-center gap-2 text-sm text-[#71717a]">
            {analyzing && (
              <span className="size-2 animate-pulse rounded-full bg-[#8a8781]" />
            )}
            {app.aiState === "NO_RESUME"
              ? "Sem currículo — candidatura não analisada pela IA."
              : app.aiState === "FAILED"
                ? "A análise falhou. Será tentada novamente automaticamente."
                : "Analisando o currículo… o resultado aparece aqui em instantes."}
          </div>
        )}

        {/* H6: os critérios que a IA usou, à vista, sem exigir memória */}
        {app.job.aiCriteria.length > 0 && (
          <div className="mt-4 border-t border-[#e4e4e7] pt-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.6px] text-[#a1a1aa]">
              Critérios avaliados
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {app.job.aiCriteria.map((criterion) => (
                <span
                  key={criterion}
                  className="rounded-full bg-white px-2.5 py-1 text-[11px] text-[#0a0a0a] ring-1 ring-[#e4e4e7]"
                >
                  {criterion}
                </span>
              ))}
            </div>
          </div>
        )}

        <p className="mt-4 rounded-md bg-[#f4f4f5] px-3.5 py-2 text-[11px] text-[#71717a]">
          Apoio à decisão. A decisão final é sua.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-[#0a0a0a]">
          Status do processo
        </h2>
        <div className="mt-3">
          <StatusSegment applicationId={app.id} status={app.status} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-[#0a0a0a]">
          Respostas do formulário
        </h2>
        <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          {infoPairs.map(([label, value]) => (
            <div key={label}>
              <dt className="text-[11px] text-[#71717a]">{label}</dt>
              <dd className="mt-0.5 break-words text-[13px] text-[#0a0a0a]">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-8 flex items-center gap-4 rounded-lg border border-[#e4e4e7] bg-[#fafaf9] px-4 py-3">
        {app.resumeUrl ? (
          <>
            <span className="rounded-[5px] bg-[#e4f6ec] px-2 py-2 text-[8px] font-bold text-[#1f7a4d]">
              PDF
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-[#0a0a0a]">
                Currículo de {app.name.split(" ")[0]}
              </span>
              <span className="block text-[11px] text-[#71717a]">
                PDF no Storage
              </span>
            </span>
            <a
              href={`/candidaturas/${app.id}/cv`}
              className="flex h-[34px] items-center rounded-2xl px-5 text-xs font-medium hover:opacity-90"
              style={{
                backgroundColor: "var(--brand-primary)",
                color: "var(--brand-foreground)",
              }}
            >
              Baixar
            </a>
          </>
        ) : (
          <span className="text-[13px] text-[#71717a]">
            Nenhum currículo enviado.
          </span>
        )}
      </section>

      <footer className="mt-8 border-t border-[#e4e4e7] pt-6">
        <DecisionButtons applicationId={app.id} status={app.status} />
      </footer>
    </div>
  );
}
