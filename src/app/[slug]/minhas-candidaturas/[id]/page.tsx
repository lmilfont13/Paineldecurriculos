import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  CompanyFooter,
  CompanyHeader,
} from "@/components/public/company-header";
import { WithdrawButton } from "@/components/public/withdraw-button";
import { getMinhaCandidaturaData } from "@/server/controllers/public.controller";
import { formatAppliedAt } from "@/server/models/application.model";
import { formatInterviewLong } from "@/server/models/interview.model";
import { formatNotificationAge } from "@/server/models/notification.model";

export const metadata: Metadata = { title: "Minha candidatura · Triagem" };

/** Rótulos da timeline na voz do candidato. */
function eventLabel(
  from: string | null,
  to: string
): { label: string; tone: "neutral" | "good" | "end" } {
  if (from === null) return { label: "Candidatura enviada", tone: "neutral" };
  switch (to) {
    case "INTERVIEW":
      return { label: "Você avançou para a entrevista", tone: "good" };
    case "PENDING":
      return { label: "Voltou para análise", tone: "neutral" };
    case "APPROVED":
      return { label: "Você foi aprovado(a) 🎉", tone: "good" };
    case "REJECTED":
      return { label: "Processo finalizado", tone: "end" };
    default:
      return { label: "Voltou para análise", tone: "neutral" };
  }
}

/** Detalhe da candidatura para o candidato: timeline, respostas e CV. */
export default async function MinhaCandidaturaPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const data = await getMinhaCandidaturaData(slug, id);
  if (!data) notFound();
  if (!data.candidate) {
    redirect(
      `/${slug}/entrar?next=${encodeURIComponent(`/${slug}/minhas-candidaturas/${id}`)}`
    );
  }
  const { company, candidate, application } = data;
  if (!application) notFound();

  return (
    <>
      <CompanyHeader company={company} candidate={candidate} />
      <main className="mx-auto w-full max-w-[640px] flex-1 px-6 pt-12">
        <Link
          href={`/${slug}/minhas-candidaturas`}
          className="text-[13px] font-medium text-[#71717a] hover:text-[#0a0a0a]"
        >
          ← Minhas candidaturas
        </Link>

        <h1 className="mt-5 text-2xl font-bold text-[#0a0a0a]">
          {application.job.title}
        </h1>
        <p className="mt-1 text-sm text-[#71717a]">
          {application.company.name} · enviada em{" "}
          {formatAppliedAt(application.createdAt)}
        </p>

        {/* A conversa combinada — a informação mais acionável da tela */}
        {application.interviewAt && application.status === "INTERVIEW" && (
          <section className="mt-8 rounded-2xl border border-[#f0e3c8] bg-[#fdfaf3] p-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.6px] text-[#b07818]">
              Sua entrevista
            </p>
            <p className="mt-2 text-lg font-semibold text-[#0a0a0a]">
              {formatInterviewLong(application.interviewAt)}
            </p>
            <p className="mt-1 text-sm text-[#71717a]">
              {application.interviewMode ?? "A combinar"}
              {application.interviewLocation && (
                <>
                  {" · "}
                  {/^https?:\/\//.test(application.interviewLocation) ? (
                    <a
                      href={application.interviewLocation}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium underline"
                      style={{ color: "var(--brand-primary)" }}
                    >
                      abrir link da chamada
                    </a>
                  ) : (
                    application.interviewLocation
                  )}
                </>
              )}
            </p>
            <p className="mt-3 text-[12px] leading-5 text-[#71717a]">
              Se esse horário não funcionar, responda o e-mail que a{" "}
              {application.company.name} enviou.
            </p>
          </section>
        )}

        {/* Recados da empresa */}
        {application.notifications.length > 0 && (
          <section className="mt-6 rounded-2xl border border-[#e4e4e7] bg-white p-6">
            <h2 className="text-sm font-semibold text-[#0a0a0a]">
              Recados da {application.company.name}
            </h2>
            <ul className="mt-4 space-y-4">
              {application.notifications.map((message) => (
                <li key={message.id}>
                  <p className="text-[13px] leading-5 text-[#0a0a0a]">
                    {message.body}
                  </p>
                  <p className="mt-1 text-[11px] text-[#a1a1aa]">
                    {formatNotificationAge(message.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Linha do tempo */}
        <section className="mt-8 rounded-2xl border border-[#e4e4e7] bg-white p-6">
          <h2 className="text-sm font-semibold text-[#0a0a0a]">
            Andamento do processo
          </h2>
          <ol className="mt-5 space-y-0">
            {application.statusEvents.map((event, i) => {
              const { label, tone } = eventLabel(event.from, event.to);
              const isLast = i === application.statusEvents.length - 1;
              return (
                <li key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
                  {!isLast && (
                    <span
                      aria-hidden
                      className="absolute left-[7px] top-5 h-full w-px bg-[#e4e4e7]"
                    />
                  )}
                  <span
                    aria-hidden
                    className={
                      "mt-1 size-[15px] shrink-0 rounded-full border-2 border-white shadow-[0_0_0_1px_#e4e4e7] " +
                      (tone === "good"
                        ? "bg-[#1f7a4d]"
                        : tone === "end"
                          ? "bg-[#a1a1aa]"
                          : "")
                    }
                    style={
                      tone === "neutral"
                        ? { backgroundColor: "var(--brand-primary)" }
                        : undefined
                    }
                  />
                  <span>
                    <span
                      className={
                        "block text-sm " +
                        (isLast
                          ? "font-semibold text-[#0a0a0a]"
                          : "font-medium text-[#0a0a0a]")
                      }
                    >
                      {label}
                    </span>
                    <span className="block text-xs text-[#71717a]">
                      {formatAppliedAt(event.createdAt, true)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        {/* O que você enviou */}
        <section className="mt-6 rounded-2xl border border-[#e4e4e7] bg-white p-6">
          <h2 className="text-sm font-semibold text-[#0a0a0a]">
            O que você enviou
          </h2>
          <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] text-[#71717a]">Nome</dt>
              <dd className="mt-0.5 text-[13px] text-[#0a0a0a]">
                {application.name}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-[#71717a]">Telefone</dt>
              <dd className="mt-0.5 text-[13px] text-[#0a0a0a]">
                {application.phone ?? "—"}
              </dd>
            </div>
            {application.answers.map((answer) => (
              <div key={answer.id}>
                <dt className="text-[11px] text-[#71717a]">
                  {answer.field.label}
                </dt>
                <dd className="mt-0.5 break-words text-[13px] text-[#0a0a0a]">
                  {answer.value}
                </dd>
              </div>
            ))}
          </dl>
          {application.resumeUrl && (
            <a
              href={`/${slug}/minhas-candidaturas/${application.id}/cv`}
              className="mt-5 inline-flex h-9 items-center rounded-2xl border border-[#0a0a0a]/85 bg-white px-4 text-xs font-medium text-[#0a0a0a] hover:bg-[#fafaf9]"
            >
              Baixar currículo enviado ↓
            </a>
          )}
        </section>

        {/* Retirar candidatura — só faz sentido em processo aberto */}
        {application.status !== "REJECTED" &&
          application.status !== "APPROVED" && (
            <div className="mt-6">
              <WithdrawButton
                slug={slug}
                applicationId={application.id}
                jobTitle={application.job.title}
              />
            </div>
          )}
      </main>
      <CompanyFooter company={company} />
    </>
  );
}
