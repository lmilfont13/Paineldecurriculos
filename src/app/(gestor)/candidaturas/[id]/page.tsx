import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DecisionBlock } from "@/components/gestor/decision-block";
import { LiveRefresh } from "@/components/gestor/live-refresh";
import { MessageBox } from "@/components/gestor/message-box";
import { NotesForm } from "@/components/gestor/notes-form";
import { ReanalyzeButton } from "@/components/gestor/reanalyze-button";
import { getCandidaturaDetail } from "@/server/controllers/gestor.controller";
import {
  appStatusLabels,
  formatAppliedAt,
  formatWaiting,
  type AppStatusKey,
} from "@/server/models/application.model";
import { personInitials } from "@/server/models/dashboard.model";
import {
  interviewSummary,
  isPastInterview,
} from "@/server/models/interview.model";

/** Date → valor de `datetime-local`, no fuso do servidor. */
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Linha do histórico na voz do gestor. */
function historyLine(
  from: AppStatusKey | null,
  to: AppStatusKey,
  actor: string
): string {
  if (from === null) return "Candidatura enviada pelo candidato";
  const who = actor === "gestor" ? "Você" : "O sistema";
  return `${who} moveu de "${appStatusLabels[from]}" para "${appStatusLabels[to]}"`;
}

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
    <div className="mx-auto w-full max-w-[1080px]">
      <LiveRefresh active={analyzing} />
      <div className="flex items-start justify-between rounded-2xl border border-[#e7e5e4] bg-white p-5 shadow-sm sm:p-7">
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
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#1c1917] text-base font-bold text-white shadow-sm">
          {personInitials(app.name)}
        </span>
        <div>
          <h1 className="text-xl font-bold text-[#0a0a0a]">{app.name}</h1>
          <p className="mt-0.5 text-xs text-[#71717a]">
            Candidatou-se em {formatAppliedAt(app.createdAt, true)}
            {app.status === "PENDING" && (
              <>
                {" · "}
                <span className="font-medium text-[#b07818]">
                  esperando resposta {formatWaiting(app.createdAt)}
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">\n        <div>\n      {/* Bloco de IA — só leitura; nunca muda o status (regra 2) */}
      <section className="mt-6 rounded-xl border border-[#e4e4e7] bg-[#fafaf9] p-6">
        {/* A ressalva vem antes do dado, não depois: quem lê já lê enquadrado. */}
        <p className="text-[11px] font-medium uppercase tracking-[0.6px] text-[#a1a1aa]">
          Leitura da IA · apoio à decisão, a escolha é sua
        </p>
        {app.aiState === "DONE" && app.aiScore !== null ? (
          <>
            {/* O raciocínio é o que informa; o número é só o resumo dele. */}
            {app.aiReasoning && (
              <p className="mt-3 text-[15px] leading-6 text-[#0a0a0a]">
                {app.aiReasoning}
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span
                className={
                  "inline-flex h-7 items-center gap-2 rounded-lg px-3 text-xs font-semibold " +
                  (meets
                    ? "bg-[#e4f6ec] text-[#1f7a4d]"
                    : "bg-[#f1f0ed] text-[#71717a]")
                }
              >
                <span className="size-1.5 rounded-full bg-current" />
                {app.aiScore} de 100
              </span>
              <span className="text-[11px] text-[#71717a]">
                {meets
                  ? `acima do mínimo definido para a vaga (${app.job.aiMinScore})`
                  : `abaixo do mínimo definido para a vaga (${app.job.aiMinScore})`}
              </span>
            </div>
          </>
        ) : (
          <div className="mt-3 flex items-center gap-2 text-sm text-[#71717a]">
            {analyzing && (
              <span className="size-2 animate-pulse rounded-full bg-[#8a8781]" />
            )}
            {app.aiState === "NO_RESUME"
              ? "Sem currículo, então a IA não fez a leitura. Avalie pelas respostas abaixo."
              : app.aiState === "FAILED"
                ? "A análise falhou. Você pode pedir uma nova tentativa."
                : "Analisando o currículo… o resultado aparece aqui em instantes."}
          </div>
        )}
        {app.aiState === "FAILED" && app.resumeUrl && (
          <ReanalyzeButton applicationId={app.id} />
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

      </section>

      {/* Uma decisão, um lugar (antes eram dois controles para a mesma ação) */}
      <DecisionBlock
        applicationId={app.id}
        status={app.status}
        candidateName={app.name}
        interview={
          app.interviewAt
            ? {
                at: toLocalInput(app.interviewAt),
                summary: interviewSummary(app.interviewAt, app.interviewMode),
                mode: app.interviewMode ?? "Videochamada",
                location: app.interviewLocation ?? "",
                past: isPastInterview(app.interviewAt),
              }
            : null
        }
      />

      <section className="mt-8">
        <h2 className="text-sm font-medium text-[#0a0a0a]">
          Histórico do processo
        </h2>

        {/* H1: histórico visível — quem moveu o quê, e quando */}
        {app.statusEvents.length > 0 && (
          <ol className="mt-3 space-y-2">
            {app.statusEvents.map((event) => (
              <li
                key={event.id}
                className="flex items-baseline gap-2 text-[12px]"
              >
                <span className="text-[#0a0a0a]">
                  {historyLine(event.from, event.to, event.actor)}
                </span>
                <span className="text-[#a1a1aa]">
                  · {formatAppliedAt(event.createdAt, true)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Falar com o candidato — sai do sistema, chega como novidade e e-mail */}
      <section className="mt-8">
        <h2 className="text-sm font-medium text-[#0a0a0a]">
          Recado para o candidato
        </h2>
        <p className="mt-1 text-[11px] text-[#a1a1aa]">
          {app.name.split(" ")[0]} recebe por e-mail e nas novidades da área
          dele.
        </p>
        <MessageBox
          applicationId={app.id}
          candidateName={app.name}
          candidatePhone={app.phone ?? undefined}
        />
      </section>

      {/* Notas internas — memória do processo entre gestores */}
      <section className="mt-8">
        <h2 className="text-sm font-medium text-[#0a0a0a]">Notas internas</h2>
        <p className="mt-1 text-[11px] text-[#a1a1aa]">
          Visível só para a sua equipe. O candidato nunca vê.
        </p>
        <div className="mt-3">
          <NotesForm applicationId={app.id} notes={app.managerNotes} />
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

      </section>\n      </div>\n\n      <section className="mt-5 flex items-center gap-4 rounded-xl border border-[#e4e4e7] bg-[#fafaf9] px-4 py-3">
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
    </div>
  );
}
