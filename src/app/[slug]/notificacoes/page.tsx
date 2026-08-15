import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  CompanyFooter,
  CompanyHeader,
} from "@/components/public/company-header";
import { markNotificationsReadAction } from "@/server/controllers/candidate.controller";
import { getNotificacoesData } from "@/server/controllers/public.controller";
import { formatNotificationAge } from "@/server/models/notification.model";

export const metadata: Metadata = { title: "Novidades · Triagem" };

/** Marcador de cada tipo — cor conta a natureza da novidade sem depender de texto. */
const TONE: Record<string, string> = {
  APPLICATION_RECEIVED: "bg-[#a1a1aa]",
  STAGE_CHANGED: "bg-[#b07818]",
  INTERVIEW_SCHEDULED: "bg-[#b07818]",
  MANAGER_MESSAGE: "bg-[#0a0a0a]",
  RESULT: "bg-[#1f7a4d]",
  NEW_JOB: "bg-[#1f7a4d]",
};

/** Histórico de novidades do candidato — abrir a página é ler. */
export default async function NotificacoesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getNotificacoesData(slug);
  if (!data) notFound();
  if (!data.candidate) {
    redirect(
      `/${slug}/entrar?next=${encodeURIComponent(`/${slug}/notificacoes`)}`
    );
  }
  const { company, candidate, notifications } = data;
  const unreadIds = notifications.filter((n) => !n.readAt).map((n) => n.id);

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

        <h1 className="mt-5 text-2xl font-bold text-[#0a0a0a]">Novidades</h1>
        <p className="mt-2 text-sm text-[#71717a]">
          Tudo que aconteceu nos seus processos, do mais recente para o mais
          antigo.
        </p>

        <div className="mt-8 divide-y divide-[#e4e4e7] rounded-xl border border-[#e4e4e7] bg-white">
          {notifications.length === 0 && (
            <p className="p-6 text-sm text-[#71717a]">
              Nada por aqui ainda. Assim que houver movimento em alguma
              candidatura sua, a novidade aparece nesta página.
            </p>
          )}
          {notifications.map((item) => {
            const inner = (
              <>
                <span
                  aria-hidden
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${TONE[item.type] ?? "bg-[#a1a1aa]"}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-medium text-[#0a0a0a]">
                      {item.title}
                    </span>
                    {!item.readAt && (
                      <span
                        className="rounded-full px-1.5 text-[10px] font-bold text-white"
                        style={{ backgroundColor: "var(--brand-primary)" }}
                      >
                        novo
                      </span>
                    )}
                    <span className="text-[11px] text-[#a1a1aa]">
                      {formatNotificationAge(item.createdAt)}
                    </span>
                  </span>
                  {item.body && (
                    <span className="mt-1 block text-[13px] leading-5 text-[#71717a]">
                      {item.body}
                    </span>
                  )}
                </span>
              </>
            );

            return item.application ? (
              <Link
                key={item.id}
                href={`/${slug}/minhas-candidaturas/${item.application.id}`}
                className="flex gap-3 px-5 py-4 transition-colors hover:bg-[#fafaf9]"
              >
                {inner}
                <span aria-hidden className="self-center text-[#a1a1aa]">
                  ›
                </span>
              </Link>
            ) : (
              <div key={item.id} className="flex gap-3 px-5 py-4">
                {inner}
              </div>
            );
          })}
        </div>

        {/* Abrir a página é ler: o contador zera ao sair desta tela. */}
        {unreadIds.length > 0 && (
          <form action={markNotificationsReadAction.bind(null, slug)}>
            <button
              type="submit"
              className="mt-5 h-9 rounded-2xl border border-[#e4e4e7] bg-white px-4 text-xs font-medium text-[#71717a] hover:text-[#0a0a0a]"
            >
              Marcar todas como lidas
            </button>
          </form>
        )}
      </main>
      <CompanyFooter company={company} />
    </>
  );
}
