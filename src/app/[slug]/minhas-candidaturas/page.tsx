import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  CompanyFooter,
  CompanyHeader,
} from "@/components/public/company-header";
import { getMinhasCandidaturasData } from "@/server/controllers/public.controller";
import {
  formatAppliedAt,
  type AppStatusKey,
} from "@/server/models/application.model";
import { formatInterviewAt } from "@/server/models/interview.model";
import {
  formatNotificationAge,
  whatHappensNow,
} from "@/server/models/notification.model";

export const metadata: Metadata = { title: "Minhas candidaturas · Triagem" };

/** Para o candidato, "reprovado" aparece como processo finalizado. */
const candidateStatus: Record<
  AppStatusKey,
  { label: string; className: string }
> = {
  PENDING: { label: "Em análise", className: "bg-[#f1f0ed] text-[#71717a]" },
  INTERVIEW: { label: "Entrevista", className: "bg-[#f7f0e1] text-[#b07818]" },
  APPROVED: { label: "Aprovado", className: "bg-[#e4f6ec] text-[#1f7a4d]" },
  REJECTED: { label: "Finalizado", className: "bg-[#f1f0ed] text-[#a1a1aa]" },
};

const CLOSED: AppStatusKey[] = ["APPROVED", "REJECTED"];

/**
 * CA4 · A casa do candidato: novidades no topo, processos em andamento no
 * meio — cada um dizendo o que acontece agora, que é a pergunta que traz o
 * candidato de volta — e encerrados recolhidos no fim.
 */
export default async function MinhasCandidaturasPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getMinhasCandidaturasData(slug);
  if (!data) notFound();
  if (!data.candidate) {
    redirect(
      `/${slug}/entrar?next=${encodeURIComponent(`/${slug}/minhas-candidaturas`)}`
    );
  }
  const { company, candidate, applications, unread } = data;
  const running = applications.filter((a) => !CLOSED.includes(a.status));
  const closed = applications.filter((a) => CLOSED.includes(a.status));

  return (
    <>
      <CompanyHeader company={company} candidate={candidate} />
      <main className="mx-auto w-full max-w-[720px] flex-1 px-6 pt-14">
        <h1 className="text-2xl font-bold text-[#0a0a0a]">
          Olá, {candidate.name.split(" ")[0]}
        </h1>
        <p className="mt-2 text-sm text-[#71717a]">
          {running.length === 0
            ? "Você não tem processos em andamento no momento."
            : `Você tem ${running.length} ${running.length === 1 ? "processo em andamento" : "processos em andamento"}.`}
        </p>

        {/* Novidades — o que mudou desde a última vez que você entrou */}
        {unread.length > 0 && (
          <section className="mt-8 rounded-2xl border border-[#f0e3c8] bg-[#fdfaf3] p-5">
            <h2 className="text-[13px] font-semibold text-[#0a0a0a]">
              Novidades
            </h2>
            <ul className="mt-3 space-y-3">
              {unread.map((item) => (
                <li key={item.id}>
                  <Link
                    href={
                      item.application
                        ? `/${slug}/minhas-candidaturas/${item.application.id}`
                        : `/${slug}/notificacoes`
                    }
                    className="block"
                  >
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[13px] font-medium text-[#0a0a0a] hover:underline">
                        {item.title}
                      </span>
                      <span className="text-[11px] text-[#a1a1aa]">
                        {formatNotificationAge(item.createdAt)}
                      </span>
                    </span>
                    {item.body && (
                      <span className="mt-0.5 block text-[12px] leading-5 text-[#71717a]">
                        {item.body}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href={`/${slug}/notificacoes`}
              className="mt-3 inline-block text-[12px] font-medium"
              style={{ color: "var(--brand-primary)" }}
            >
              Ver todas as novidades ›
            </Link>
          </section>
        )}

        {/* Em andamento — com a expectativa explícita de cada etapa */}
        <h2 className="mt-10 text-[15px] font-semibold text-[#0a0a0a]">
          Em andamento
        </h2>
        <div className="mt-4 space-y-3">
          {running.length === 0 && (
            <p className="rounded-xl border border-[#e4e4e7] bg-white p-6 text-sm text-[#71717a]">
              Nenhum processo aberto.{" "}
              <Link
                href={`/${slug}/vagas`}
                className="font-medium hover:underline"
                style={{ color: "var(--brand-primary)" }}
              >
                Ver vagas abertas ›
              </Link>
            </p>
          )}
          {running.map((app) => {
            const status = candidateStatus[app.status];
            return (
              <Link
                key={app.id}
                href={`/${slug}/minhas-candidaturas/${app.id}`}
                className="block rounded-xl border border-[#e4e4e7] bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-[#d4d4d8] hover:shadow-[0px_4px_12px_rgba(0,0,0,0.06)]"
              >
                <span className="flex flex-wrap items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-[#0a0a0a]">
                      {app.job.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-[#71717a]">
                      {app.company.name} · enviada em{" "}
                      {formatAppliedAt(app.createdAt)}
                    </span>
                  </span>
                  <span
                    className={`flex h-6 shrink-0 items-center gap-1.5 rounded-full px-3 text-[11px] font-medium ${status.className}`}
                  >
                    <span className="size-1.5 rounded-full bg-current" />
                    {status.label}
                  </span>
                </span>
                <span className="mt-3 block border-t border-[#f1f0ed] pt-3 text-[12px] leading-5 text-[#71717a]">
                  {whatHappensNow(
                    app.status,
                    app.company.name,
                    app.interviewAt ? formatInterviewAt(app.interviewAt) : null
                  )}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Encerrados — presentes, sem ocupar o primeiro plano */}
        {closed.length > 0 && (
          <details className="mt-8 rounded-xl border border-[#e4e4e7] bg-white">
            <summary className="cursor-pointer px-5 py-4 text-[13px] font-medium text-[#71717a] hover:text-[#0a0a0a]">
              Processos encerrados ({closed.length})
            </summary>
            <div className="divide-y divide-[#f1f0ed] border-t border-[#e4e4e7]">
              {closed.map((app) => {
                const status = candidateStatus[app.status];
                return (
                  <Link
                    key={app.id}
                    href={`/${slug}/minhas-candidaturas/${app.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[#fafaf9]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-[#0a0a0a]">
                        {app.job.title}
                      </span>
                      <span className="block text-[11px] text-[#a1a1aa]">
                        {app.company.name} · {formatAppliedAt(app.createdAt)}
                      </span>
                    </span>
                    <span
                      className={`flex h-6 shrink-0 items-center rounded-full px-3 text-[11px] font-medium ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </details>
        )}

        {/* Perfil incompleto: serve às duas pontas — menos atrito, melhor dado */}
        {!candidate.resumeUrl && (
          <p className="mt-8 rounded-xl border border-[#e4e4e7] bg-[#fafaf9] p-4 text-[13px] leading-5 text-[#71717a]">
            Você ainda não tem currículo salvo no perfil.{" "}
            <Link
              href={`/${slug}/perfil`}
              className="font-medium hover:underline"
              style={{ color: "var(--brand-primary)" }}
            >
              Adicione o seu
            </Link>{" "}
            e a próxima candidatura leva um clique.
          </p>
        )}
      </main>
      <CompanyFooter company={company} />
    </>
  );
}
