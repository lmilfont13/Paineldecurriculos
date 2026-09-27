import type { Metadata } from "next";
import Link from "next/link";

import { AiScoreChip } from "@/components/gestor/ai-score-chip";
import { CopyLink } from "@/components/gestor/copy-link";
import { getPainelData } from "@/server/controllers/gestor.controller";
import { formatWaiting } from "@/server/models/application.model";
import { personInitials } from "@/server/models/dashboard.model";
import { jobStatusLabels } from "@/server/models/job.model";

export const metadata: Metadata = { title: "Painel · Triagem" };

/** Barra do funil: proporção de cada etapa, sem números competindo por espaço. */
function FunnelBar({
  pending,
  interview,
  approved,
  rejected,
}: {
  pending: number;
  interview: number;
  approved: number;
  rejected: number;
}) {
  const total = pending + interview + approved + rejected;
  if (total === 0) {
    return <span className="block h-1.5 rounded-full bg-[#f1f0ed]" />;
  }
  const parts = [
    { value: pending, color: "#e0a83a" },
    { value: interview, color: "#b07818" },
    { value: approved, color: "#1f7a4d" },
    { value: rejected, color: "#e4e4e7" },
  ];
  return (
    <span className="flex h-1.5 overflow-hidden rounded-full bg-[#f1f0ed]">
      {parts.map((part, i) =>
        part.value > 0 ? (
          <span
            key={i}
            style={{
              width: `${(part.value / total) * 100}%`,
              backgroundColor: part.color,
            }}
          />
        ) : null,
      )}
    </span>
  );
}

/**
 * E1 · Painel como fila de trabalho. Os quatro contadores de volume saíram:
 * a tela agora abre pela única pergunta que importa no dia a dia — quem está
 * esperando resposta e há quanto tempo.
 */
export default async function PainelPage() {
  const { userName, companyName, publicUrl, stats, priority, jobs } =
    await getPainelData();
  const firstName = userName.split(" ")[0];

  // Primeiro uso (nenhuma vaga ainda): induz a criar a vaga, sem mostrar zeros.
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
              Mande no WhatsApp, poste no Instagram ou onde seus candidatos
              estão. É por esse link que eles chegam.
            </p>
            <CopyLink url={publicUrl} />
          </div>
        </div>
      </>
    );
  }

  const clear = stats.waiting === 0;
  const nobodyYet = stats.totalApplications === 0;
  const drafts = jobs.filter((j) => j.status === "DRAFT");

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0a0a0a]">
            Olá, {firstName}
          </h1>
          <p className="mt-2 text-sm text-[#71717a]">
            {nobodyYet
              ? `Painel de recrutamento da ${companyName}.`
              : `${stats.newApplications7d} candidatura${stats.newApplications7d === 1 ? "" : "s"} e ${stats.decided7d} ${stats.decided7d === 1 ? "decisão" : "decisões"} nos últimos 7 dias.`}
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

      {drafts.length > 0 && (
        <Link
          href={`/vagas/${drafts[0].id}`}
          className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-6 transition-colors"
          style={{
            borderColor:
              "color-mix(in srgb, var(--brand-primary) 25%, transparent)",
            backgroundColor: "var(--brand-tint)",
          }}
        >
          <span>
            <span className="block text-[15px] font-semibold text-[#0a0a0a]">
              {drafts.length === 1
                ? `${drafts[0].title} está em rascunho`
                : `${drafts.length} vagas em rascunho`}
            </span>
            <span className="mt-1 block text-sm text-[#57534e]">
              Revise o texto e publique. Só depois disso a vaga aparece para os
              candidatos.
            </span>
          </span>
          <span
            className="flex h-10 items-center rounded-2xl px-5 text-[13px] font-medium"
            style={{
              backgroundColor: "var(--brand-primary)",
              color: "var(--brand-foreground)",
            }}
          >
            Revisar e publicar
          </span>
        </Link>
      )}

      {/* A fila: o único número que muda o que o gestor faz agora */}
      <section
        className={
          "mt-8 flex flex-wrap items-center justify-between gap-6 rounded-2xl border p-7 " +
          (clear
            ? "border-[#e4e4e7] bg-white"
            : "border-[#f0e3c8] bg-[#fdfaf3]")
        }
      >
        <div>
          <p className="flex items-baseline gap-3">
            <span
              className={
                "text-5xl font-bold " +
                (nobodyYet
                  ? "text-[#a1a1aa]"
                  : clear
                    ? "text-[#1f7a4d]"
                    : "text-[#b07818]")
              }
            >
              {clear ? "0" : stats.waiting}
            </span>
            <span className="text-lg font-medium text-[#0a0a0a]">
              {nobodyYet
                ? "candidaturas por enquanto"
                : clear
                  ? "ninguém esperando resposta"
                  : `${stats.waiting === 1 ? "candidato" : "candidatos"} esperando sua resposta`}
            </span>
          </p>
          <p className="mt-2 text-sm text-[#71717a]">
            {nobodyYet
              ? stats.openJobs > 0
                ? "Divulgue o link das vagas no WhatsApp e no Instagram. Cada candidatura nova aparece aqui."
                : "Publique uma vaga para começar a receber candidatos."
              : clear
                ? "Fila limpa. Todo mundo que se candidatou já teve um retorno seu."
                : stats.oldestWaitingAt
                  ? `O mais antigo se candidatou ${formatWaiting(stats.oldestWaitingAt)} e ainda não teve retorno.`
                  : ""}
          </p>
        </div>
        {!clear && (
          <Link
            href="/candidaturas?status=PENDING"
            className="flex h-11 items-center rounded-2xl px-6 text-sm font-medium transition-opacity hover:opacity-90"
            style={{
              backgroundColor: "var(--brand-primary)",
              color: "var(--brand-foreground)",
            }}
          >
            Começar a triagem
          </Link>
        )}
      </section>

      {/* Fila priorizada — e a linha diz por que a pessoa está aí */}
      {priority.length > 0 && (
        <>
          <div className="mt-10 flex items-baseline gap-4">
            <h2 className="text-[15px] font-semibold text-[#0a0a0a]">
              Quem está esperando há mais tempo
            </h2>
          </div>

          <div className="mt-4 max-w-[848px] overflow-hidden rounded-xl border border-[#e4e4e7] bg-white">
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
                    {app.jobTitle} · espera{" "}
                    <span className="font-medium text-[#b07818]">
                      {formatWaiting(app.createdAt)}
                    </span>
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
      )}

      {/* Andamento por processo — a vaga é a unidade de trabalho */}
      {jobs.length > 0 && (
        <>
          <h2 className="mt-10 text-[15px] font-semibold text-[#0a0a0a]">
            Seus processos
          </h2>
          <div className="mt-4 grid max-w-[848px] grid-cols-1 gap-4 sm:grid-cols-2">
            {jobs.map((job) => (
              <Link
                key={job.id}
                href={`/vagas/${job.id}`}
                className="rounded-xl border border-[#e4e4e7] bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-[#d4d4d8] hover:shadow-[0px_4px_12px_rgba(0,0,0,0.06)]"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium text-[#0a0a0a]">
                    {job.title}
                  </span>
                  {job.status !== "OPEN" && (
                    <span className="shrink-0 text-[10px] font-medium text-[#b07818]">
                      {jobStatusLabels[job.status]}
                    </span>
                  )}
                </span>
                <span className="mt-3 block">
                  <FunnelBar
                    pending={job.pending}
                    interview={job.interview}
                    approved={job.approved}
                    rejected={job.rejected}
                  />
                </span>
                <span className="mt-2.5 block text-[11px] text-[#71717a]">
                  {job.status === "DRAFT" ? (
                    <span
                      className="font-medium"
                      style={{ color: "var(--brand-primary)" }}
                    >
                      Revisar e publicar ›
                    </span>
                  ) : (
                    <>
                      {job.total} candidato{job.total === 1 ? "" : "s"}
                      {job.pending > 0 && (
                        <>
                          {" · "}
                          <span className="font-medium text-[#b07818]">
                            {job.pending} esperando
                          </span>
                        </>
                      )}
                      {job.interview > 0 && ` · ${job.interview} em entrevista`}
                    </>
                  )}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
