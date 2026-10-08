import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DecisionBlock } from "@/components/gestor/decision-block";
import { DeleteApplicationButton } from "@/components/gestor/delete-application-button";
import { LiveRefresh } from "@/components/gestor/live-refresh";
import { MessageBox } from "@/components/gestor/message-box";
import { NotesForm } from "@/components/gestor/notes-form";
import { ReanalyzeButton } from "@/components/gestor/reanalyze-button";
import { CareerCard } from "@/components/gestor/career-card";
import { TalentPoolCard } from "@/components/gestor/talent-pool-card";
import { readCareer } from "@/server/models/career.model";
import { loadApplicationTalentInfo } from "@/server/controllers/talent.controller";
import { suggestTalentPool } from "@/server/models/talent.model";
import { readChecklist } from "@/server/models/ai.model";
import { getCandidaturaDetail } from "@/server/controllers/gestor.controller";
import {
  appStatusLabels,
  formatAppliedAt,
  formatWaiting,
  type AppStatusKey,
} from "@/server/models/application.model";
import { CandidateAvatar } from "@/components/gestor/candidate-avatar";
import {
  interviewSummary,
  isPastInterview,
} from "@/server/models/interview.model";

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

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

// Banco de talentos (até 5 vagas) e análise de perfil (até 3) rodam na hora.
export const maxDuration = 60;

export default async function CandidaturaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const app = await getCandidaturaDetail(id);
  const talent = app ? await loadApplicationTalentInfo(app.id) : null;
  if (!app) notFound();

  const meets = app.aiScore !== null && app.aiScore >= app.job.aiMinScore;
  const coreAnswers = app.answers.filter((a) => a.field.isCore);
  const customAnswers = app.answers.filter((a) => !a.field.isCore);
  const infoPairs: [string, string][] = [
    ["E-mail", app.email],
    ["Telefone", app.phone ?? "—"],
    ...coreAnswers.map((a) => [a.field.label, a.value] as [string, string]),
    ...customAnswers.map((a) => [a.field.label, a.value] as [string, string]),
  ];
  const analyzing = app.aiState === "WAITING" || app.aiState === "PROCESSING";
  const checklist = readChecklist(app.aiChecklist);

  const interview = app.interviewAt
    ? {
        at: toLocalInput(app.interviewAt),
        summary: interviewSummary(app.interviewAt, app.interviewMode),
        mode: app.interviewMode ?? "Videochamada",
        location: app.interviewLocation ?? "",
        past: isPastInterview(app.interviewAt),
      }
    : null;

  return (
    <div className="mx-auto w-full max-w-[1080px]">
      <LiveRefresh active={analyzing} applicationIds={[app.id]} />

      <div className="mb-5 flex items-center justify-between gap-4">
        <Link
          href="/candidaturas"
          className="text-[13px] font-medium text-[#71717a] hover:text-[#0a0a0a]"
        >
          ← Voltar para candidatos
        </Link>
        <span className="text-[10px] font-semibold uppercase tracking-[0.7px] text-[#a1a1aa]">
          Detalhe da candidatura
        </span>
      </div>

      <header className="rounded-2xl border border-[#e4e4e7] bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.7px] text-[#a1a1aa]">
              Candidatura · {app.job.title}
            </p>
            <div className="mt-5 flex items-center gap-4">
              <CandidateAvatar
                name={app.name}
                photoUrl={app.photoUrl}
                className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#1c1917] text-base font-bold text-white shadow-sm"
              />
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#0a0a0a]">
                  {app.name}
                  {app.isDemo && (
                    <span className="ml-2 rounded-full bg-[#f5f3ff] px-2 py-0.5 align-middle text-[11px] font-medium text-[#6d28d9]">
                      Demonstração
                    </span>
                  )}
                </h1>
                <p className="mt-1 text-xs text-[#71717a]">
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
          </div>
          <Link
            href="/candidaturas"
            aria-label="Fechar"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[#a1a1aa] hover:bg-[#f4f4f5] hover:text-[#0a0a0a]"
          >
            ✕
          </Link>
        </div>
      </header>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <main className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-[#e4e4e7] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.6px] text-[#a1a1aa]">
                  Leitura da IA
                </p>
                <h2 className="mt-1 text-base font-semibold text-[#0a0a0a]">
                  Apoio à decisão
                </h2>
              </div>
              <span className="rounded-full bg-[#f4f4f5] px-2.5 py-1 text-[10px] font-medium text-[#71717a]">
                A decisão é sua
              </span>
            </div>

            {app.aiState === "DONE" && app.aiScore !== null ? (
              <>
                {app.aiReasoning && (
                  <p className="mt-5 text-[15px] leading-6 text-[#0a0a0a]">
                    {app.aiReasoning}
                  </p>
                )}
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <span
                    className={
                      "inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-xs font-bold " +
                      (meets
                        ? "bg-[#e4f6ec] text-[#1f7a4d]"
                        : "bg-[#f1f0ed] text-[#71717a]")
                    }
                  >
                    <span className="size-1.5 rounded-full bg-current" />
                    {app.aiScore} / 100
                  </span>
                  <span className="text-xs text-[#71717a]">
                    {meets
                      ? `Acima do mínimo da vaga (${app.job.aiMinScore})`
                      : `Abaixo do mínimo da vaga (${app.job.aiMinScore})`}
                  </span>
                </div>
                {app.aiModel && (
                  <p className="mt-3 text-[11px] text-[#a1a1aa]">
                    Analisado por {app.aiModel.replace(/^groq:/, "")}
                    {app.resumeUrl ? "" : ", só com as respostas do formulário"}
                  </p>
                )}
              </>
            ) : (
              <div className="mt-5 rounded-xl bg-[#fafaf9] p-4 text-sm text-[#71717a]">
                <div className="flex items-center gap-2">
                  {analyzing && (
                    <span className="size-2 animate-pulse rounded-full bg-[#8a8781]" />
                  )}
                  {app.aiState === "NO_RESUME"
                    ? "Não havia material para a IA ler (sem PDF legível e sem respostas). Avalie pelo que está abaixo."
                    : app.aiState === "FAILED"
                      ? "A análise falhou. Você pode pedir uma nova tentativa."
                      : "Analisando o currículo… o resultado aparece aqui em instantes."}
                </div>
              </div>
            )}

            {(app.aiState === "FAILED" || app.aiState === "NO_RESUME") && (
              <div className="mt-4">
                <ReanalyzeButton applicationId={app.id} />
              </div>
            )}

            {checklist.length > 0 ? (
              <div className="mt-6 border-t border-[#e4e4e7] pt-5">
                <h3 className="text-[13px] font-semibold text-[#0a0a0a]">
                  Critério por critério
                </h3>
                <p className="mt-0.5 text-[11px] text-[#a1a1aa]">
                  Explica a nota; não muda o cálculo dela.
                </p>
                <ul className="mt-3 space-y-2.5">
                  {checklist.map((item) => (
                    <li key={item.criterion} className="flex gap-2.5 text-[12px] leading-5">
                      <span
                        aria-hidden
                        className={
                          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold " +
                          (item.met === "sim"
                            ? "bg-[#e4f6ec] text-[#1f7a4d]"
                            : item.met === "parcial"
                              ? "bg-[#fff7e6] text-[#a16207]"
                              : "bg-[#f4f4f5] text-[#a1a1aa]")
                        }
                      >
                        {item.met === "sim" ? "✓" : item.met === "parcial" ? "~" : "–"}
                      </span>
                      <span className="min-w-0">
                        <span className="font-medium text-[#0a0a0a]">{item.criterion}</span>
                        <span className="sr-only">: {item.met === "sim" ? "atende" : item.met === "parcial" ? "atende em parte" : "não encontrado"}</span>
                        {item.evidence && (
                          <span className="block text-[#71717a]">{item.evidence}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : app.job.aiCriteria.length > 0 && (
              <div className="mt-6 border-t border-[#e4e4e7] pt-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[#a1a1aa]">
                  Critérios avaliados
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {app.job.aiCriteria.map((criterion) => (
                    <span
                      key={criterion}
                      className="rounded-full bg-[#fafaf9] px-3 py-1.5 text-[11px] text-[#0a0a0a] ring-1 ring-[#e4e4e7]"
                    >
                      {criterion}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          <CareerCard
            applicationId={app.id}
            career={readCareer(app.aiCareer)}
            matches={talent?.matches ?? []}
          />

          <section className="rounded-2xl border border-[#e4e4e7] bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-sm font-semibold text-[#0a0a0a]">
              Histórico do processo
            </h2>
            {app.statusEvents.length > 0 ? (
              <ol className="mt-4 space-y-3">
                {app.statusEvents.map((event) => (
                  <li key={event.id} className="flex gap-3 text-[12px]">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#a1a1aa]" />
                    <div>
                      <span className="text-[#0a0a0a]">
                        {historyLine(event.from, event.to, event.actor)}
                      </span>
                      <span className="ml-2 text-[#a1a1aa]">
                        {formatAppliedAt(event.createdAt, true)}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-xs text-[#71717a]">
                Ainda não há movimentações registradas.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-[#e4e4e7] bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-sm font-semibold text-[#0a0a0a]">
              Recado para o candidato
            </h2>
            <p className="mt-1 text-[11px] text-[#a1a1aa]">
              {app.name.split(" ")[0]} recebe por e-mail e nas novidades da área dele.
            </p>
            <MessageBox
              applicationId={app.id}
              candidateName={app.name}
              candidatePhone={app.phone ?? undefined}
            />
          </section>

          <section className="rounded-2xl border border-[#e4e4e7] bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-sm font-semibold text-[#0a0a0a]">Notas internas</h2>
            <p className="mt-1 text-[11px] text-[#a1a1aa]">
              Visível só para sua equipe. O candidato nunca vê.
            </p>
            <div className="mt-4">
              <NotesForm applicationId={app.id} notes={app.managerNotes} />
            </div>
          </section>

          <section className="rounded-2xl border border-[#e4e4e7] bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-sm font-semibold text-[#0a0a0a]">
              Respostas do formulário
            </h2>
            <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
              {infoPairs.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[11px] font-medium text-[#71717a]">{label}</dt>
                  <dd className="mt-1 break-words text-[13px] leading-5 text-[#0a0a0a]">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </main>

        <aside className="min-w-0 space-y-5 lg:sticky lg:top-5">
          <DecisionBlock
            applicationId={app.id}
            status={app.status}
            candidateName={app.name}
            interview={interview}
          />

          {talent && (
            <TalentPoolCard
              applicationId={app.id}
              folders={talent.folders}
              inFolders={talent.inFolders}
              suggestedName={talent.suggestedName}
              level={talent.level}
              matches={talent.matches}
              highlight={suggestTalentPool({
                aiState: app.aiState,
                aiScore: app.aiScore,
                minScore: app.job.aiMinScore,
              })}
            />
          )}

          <section className="rounded-2xl border border-[#e4e4e7] bg-white p-5 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[#a1a1aa]">
              Currículo
            </p>
            {app.resumeUrl ? (
              <div className="mt-4 flex items-center gap-3">
                <span className="rounded-lg bg-[#e4f6ec] px-2.5 py-2 text-[9px] font-bold text-[#1f7a4d]">
                  PDF
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-[#0a0a0a]">
                    Currículo de {app.name.split(" ")[0]}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-[#71717a]">
                    Documento enviado na candidatura
                  </span>
                </span>
              </div>
            ) : (
              <p className="mt-3 text-xs text-[#71717a]">
                Nenhum currículo enviado.
              </p>
            )}
            {app.resumeUrl && (
              <a
                href={`/candidaturas/${app.id}/cv`}
                className="mt-4 flex h-10 w-full items-center justify-center rounded-xl px-5 text-xs font-semibold hover:opacity-90"
                style={{
                  backgroundColor: "var(--brand-primary)",
                  color: "var(--brand-foreground)",
                }}
              >
                Abrir currículo
              </a>
            )}
          </section>

          <div className="flex justify-center pt-1">
            <DeleteApplicationButton
              applicationId={app.id}
              candidateName={app.name}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
