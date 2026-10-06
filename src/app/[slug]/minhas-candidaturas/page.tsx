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
    <div className="min-h-screen bg-[#faf9f7]">
      <CompanyHeader company={company} candidate={candidate} />

      <main className="mx-auto w-full max-w-[960px] px-5 pb-16 pt-10 md:px-8 md:pt-12">
        <section
          className="relative overflow-hidden rounded-3xl p-7 text-white md:p-9"
          style={{
            background:
              "linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-deep) 100%)",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-28 size-72 rounded-full bg-white/10 blur-3xl"
          />
          <div className="relative">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
              Área do candidato
            </p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-5">
              <div>
                <h1 className="text-3xl font-bold tracking-[-0.7px] md:text-4xl">
                  Olá, {candidate.name.split(" ")[0]}
                </h1>
                <p className="mt-2 max-w-[560px] text-sm leading-6 text-white/70">
                  {running.length === 0
                    ? "Acompanhe suas candidaturas por aqui e veja novas oportunidades."
                    : `Você tem ${running.length} ${running.length === 1 ? "processo em andamento" : "processos em andamento"}.`}
                </p>
              </div>
              <Link
                href={`/${slug}/vagas`}
                className="inline-flex h-10 items-center rounded-xl bg-white px-4 text-[13px] font-semibold transition-opacity hover:opacity-90"
                style={{ color: "var(--brand-primary)" }}
              >
                Ver vagas abertas
              </Link>
            </div>
          </div>
        </section>

        {unread.length > 0 && (
          <section className="mt-7 rounded-2xl border border-[#eadfca] bg-[#fffaf0] p-5 md:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a17a35]">
                  Novidades
                </p>
                <h2 className="mt-1 text-[15px] font-semibold text-[#1c1917]">
                  O que mudou desde sua última visita
                </h2>
              </div>
              <Link
                href={`/${slug}/notificacoes`}
                className="text-[12px] font-medium"
                style={{ color: "var(--brand-primary)" }}
              >
                Ver todas
              </Link>
            </div>
            <ul className="mt-4 divide-y divide-[#efe4d0]">
              {unread.slice(0, 3).map((item) => (
                <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                  <Link
                    href={
                      item.application
                        ? `/${slug}/minhas-candidaturas/${item.application.id}`
                        : `/${slug}/notificacoes`
                    }
                    className="flex flex-wrap items-baseline justify-between gap-2"
                  >
                    <span className="text-[13px] font-medium text-[#1c1917] hover:underline">
                      {item.title}
                    </span>
                    <span className="text-[11px] text-[#a1a1aa]">
                      {formatNotificationAge(item.createdAt)}
                    </span>
                    {item.body && (
                      <span className="basis-full text-[12px] leading-5 text-[#78716c]">
                        {item.body}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-9 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a8a29e]">
              Seus processos
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.25px] text-[#1c1917]">
              Em andamento
            </h2>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#78716c] ring-1 ring-[#e5e0db]">
            {running.length}
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {running.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#d9d3cd] bg-white p-8 text-center md:p-10">
              <div
                className="mx-auto flex size-12 items-center justify-center rounded-2xl text-lg font-bold"
                style={{
                  backgroundColor: "var(--brand-tint)",
                  color: "var(--brand-primary)",
                }}
              >
                +
              </div>
              <h3 className="mt-4 text-[15px] font-semibold text-[#1c1917]">
                Nenhuma candidatura em andamento
              </h3>
              <p className="mx-auto mt-1.5 max-w-[440px] text-[13px] leading-5 text-[#78716c]">
                Explore as vagas abertas da {company.name} e encontre sua próxima oportunidade.
              </p>
              <Link
                href={`/${slug}/vagas`}
                className="mt-5 inline-flex h-10 items-center rounded-xl px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--brand-primary)" }}
              >
                Explorar vagas
              </Link>
            </div>
          )}

          {running.map((app) => {
            const status = candidateStatus[app.status];
            return (
              <Link
                key={app.id}
                href={`/${slug}/minhas-candidaturas/${app.id}`}
                className="group block rounded-2xl border border-[#e8e3de] bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-[#d6d0ca] hover:shadow-[0_8px_24px_rgba(28,25,23,0.06)] md:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold text-[#1c1917] group-hover:text-[var(--brand-primary)]">
                      {app.job.title}
                    </span>
                    <span className="mt-1 block text-xs text-[#8a847e]">
                      {app.company.name} · enviada em {formatAppliedAt(app.createdAt)}
                    </span>
                  </div>
                  <span
                    className={`flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold ${status.className}`}
                  >
                    <span className="size-1.5 rounded-full bg-current" />
                    {status.label}
                  </span>
                </div>
                <div className="mt-4 border-t border-[#f0ece8] pt-4">
                  <p className="text-[12px] font-medium uppercase tracking-[0.1em] text-[#aaa39c]">
                    Próximo passo
                  </p>
                  <p className="mt-1 text-[13px] leading-6 text-[#57534e]">
                    {whatHappensNow(
                      app.status,
                      app.company.name,
                      app.interviewAt ? formatInterviewAt(app.interviewAt) : null
                    )}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        {closed.length > 0 && (
          <details className="mt-7 overflow-hidden rounded-2xl border border-[#e8e3de] bg-white">
            <summary className="cursor-pointer px-5 py-4 text-[13px] font-semibold text-[#57534e] hover:text-[#1c1917]">
              Processos encerrados ({closed.length})
            </summary>
            <div className="divide-y divide-[#f1f0ed] border-t border-[#e8e3de]">
              {closed.map((app) => {
                const status = candidateStatus[app.status];
                return (
                  <Link
                    key={app.id}
                    href={`/${slug}/minhas-candidaturas/${app.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[#faf9f7]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-[#1c1917]">
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

        {!candidate.resumeUrl && (
          <section className="mt-7 flex flex-col gap-4 rounded-2xl border border-[#e8e3de] bg-white p-5 md:flex-row md:items-center md:justify-between md:p-6">
            <div>
              <p className="text-[13px] font-semibold text-[#1c1917]">
                Deixe seu perfil pronto para a próxima vaga
              </p>
              <p className="mt-1 text-[12px] leading-5 text-[#78716c]">
                Salve seu currículo e candidate-se mais rápido.
              </p>
            </div>
            <Link
              href={`/${slug}/perfil`}
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl px-4 text-[12px] font-semibold text-white"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              Adicionar currículo
            </Link>
          </section>
        )}
      </main>

      <CompanyFooter company={company} />
    </div>
  );
}
