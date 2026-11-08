import type { Metadata } from "next";
import Link from "next/link";
import { Cake, Calendar, ChevronRight, MessageCircle, PartyPopper, Phone, Sparkles, User, Users } from "lucide-react";
import { getCompanyBirthdaysAction } from "@/server/controllers/birthday.controller";
import { ZoomableCandidateAvatar } from "@/components/gestor/zoomable-candidate-avatar";

export const metadata: Metadata = {
  title: "Aniversariantes · Triagem",
  description: "Central de lembretes e mensagens de felicitação para aniversariantes da base de talentos.",
};

export default async function AniversariantesPage() {
  const data = await getCompanyBirthdaysAction();

  const today = data?.today ?? [];
  const thisWeek = data?.thisWeek ?? [];
  const thisMonth = data?.thisMonth ?? [];
  const totalWithBirthday = data?.totalWithBirthday ?? 0;

  return (
    <div className="space-y-6">
      {/* Topo / Cabeçalho */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Cake className="size-4" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
              Gestão Humanizada & Relacionamento
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#0a0a0a] flex items-center gap-2">
            Central de Aniversariantes
            {today.length > 0 && (
              <span className="rounded-full bg-amber-500 text-white px-2.5 py-0.5 text-xs font-bold animate-pulse">
                {today.length} hoje! 🎉
              </span>
            )}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#71717a] max-w-2xl leading-relaxed">
            Lembre-se do dia especial de candidatos e talentos da sua base. Envie mensagens calorosas e
            personalizadas de parabéns pelo WhatsApp com um único clique.
          </p>
        </div>

        <Link
          href="/candidaturas"
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#e4e4e7] bg-white px-3.5 text-xs font-semibold text-[#0a0a0a] shadow-2xs hover:bg-[#fafaf9] transition self-start sm:self-auto"
        >
          <span>Ver todas as candidaturas</span>
          <ChevronRight className="size-3.5 text-[#a1a1aa]" />
        </Link>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className={`rounded-2xl border p-4 shadow-xs transition ${
          today.length > 0
            ? "border-amber-300 bg-linear-to-b from-amber-50 to-orange-50/60 ring-2 ring-amber-300/50"
            : "border-[#e4e4e7] bg-white"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
              Hoje 🎉
            </span>
            <Cake className="size-4 text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[#0a0a0a]">{today.length}</p>
          <p className="text-[11px] text-[#71717a] mt-0.5">
            {today.length === 1 ? "Aniversariante hoje" : "Aniversariantes hoje"}
          </p>
        </div>

        <div className="rounded-2xl border border-[#e4e4e7] bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#71717a]">
              Próximos 7 Dias
            </span>
            <Calendar className="size-4 text-[#71717a]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[#0a0a0a]">{thisWeek.length}</p>
          <p className="text-[11px] text-[#71717a] mt-0.5">Nesta semana</p>
        </div>

        <div className="rounded-2xl border border-[#e4e4e7] bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#71717a]">
              Neste Mês
            </span>
            <PartyPopper className="size-4 text-[#71717a]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[#0a0a0a]">{thisMonth.length}</p>
          <p className="text-[11px] text-[#71717a] mt-0.5">Mês vigente</p>
        </div>

        <div className="rounded-2xl border border-[#e4e4e7] bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#71717a]">
              Base Cadastrada
            </span>
            <Users className="size-4 text-[#71717a]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[#0a0a0a]">{totalWithBirthday}</p>
          <p className="text-[11px] text-[#71717a] mt-0.5">Com data de nascimento</p>
        </div>
      </div>

      {/* SEÇÃO 1: ANIVERSARIANTES DE HOJE */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[#0a0a0a]">
              Aniversariantes de Hoje
            </h2>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">
              {today.length}
            </span>
          </div>
        </div>

        {today.length > 0 ? (
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {today.map((candidate) => (
              <div
                key={candidate.id}
                className="relative flex flex-col justify-between rounded-2xl border-2 border-amber-300 bg-linear-to-b from-amber-50/70 via-white to-amber-50/30 p-5 shadow-sm transition hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <ZoomableCandidateAvatar
                        applicationId={candidate.id}
                        name={candidate.name}
                        photoUrl={candidate.photoUrl}
                        className="size-12 shrink-0 rounded-xl bg-amber-900 text-sm font-bold text-white shadow-xs"
                      />
                      <div className="min-w-0">
                        <Link
                          href={`/candidaturas/${candidate.id}`}
                          className="font-bold text-sm text-[#0a0a0a] hover:underline truncate block"
                        >
                          {candidate.name}
                        </Link>
                        <p className="text-xs text-[#71717a] truncate mt-0.5">
                          {candidate.jobTitle}
                        </p>
                      </div>
                    </div>

                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-sm">
                      🎂
                    </span>
                  </div>

                  <div className="mt-3.5 rounded-xl border border-amber-200/80 bg-white/90 p-3">
                    <p className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <Sparkles className="size-3.5 text-amber-600" />
                      Completando {candidate.turningAge} anos hoje!
                    </p>
                    <p className="text-[11px] text-[#71717a] mt-1 flex items-center gap-1.5">
                      <Phone className="size-3 text-[#a1a1aa]" />
                      {candidate.phoneFormatted}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-amber-200/60 flex items-center gap-2">
                  {candidate.whatsappUrl ? (
                    <a
                      href={candidate.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-95 transition"
                    >
                      <MessageCircle className="size-4" />
                      <span>Parabenizar no WhatsApp</span>
                    </a>
                  ) : (
                    <span className="flex-1 text-center text-xs text-[#a1a1aa] py-1.5">
                      Telefone não informado
                    </span>
                  )}
                  <Link
                    href={`/candidaturas/${candidate.id}`}
                    className="inline-flex h-9 items-center justify-center rounded-xl border border-[#e4e4e7] bg-white px-3 text-xs font-semibold text-[#0a0a0a] hover:bg-[#fafaf9] transition"
                  >
                    Ver ficha
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#e4e4e7] bg-[#fafaf9] p-8 text-center">
            <span className="text-3xl block mb-2">🎈</span>
            <p className="text-sm font-semibold text-[#0a0a0a]">
              Nenhum aniversariante cadastrado para o dia de hoje
            </p>
            <p className="mt-1 text-xs text-[#71717a] max-w-md mx-auto">
              Quando algum candidato fizer aniversário, ele aparecerá em destaque aqui com o botão direto para enviar a mensagem de parabéns.
            </p>
          </div>
        )}
      </section>

      {/* SEÇÃO 2: PRÓXIMOS 7 DIAS */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-[#0a0a0a]">
            Próximos Aniversariantes (Próximos 7 Dias)
          </h2>
          <span className="rounded-full bg-[#f4f4f5] px-2 py-0.5 text-xs font-bold text-[#71717a]">
            {thisWeek.length}
          </span>
        </div>

        {thisWeek.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {thisWeek.map((candidate) => (
              <div
                key={candidate.id}
                className="flex flex-col justify-between rounded-2xl border border-[#e4e4e7] bg-white p-4 shadow-2xs hover:border-[#d4d4d8] transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ZoomableCandidateAvatar
                        applicationId={candidate.id}
                        name={candidate.name}
                        photoUrl={candidate.photoUrl}
                        className="size-10 shrink-0 rounded-xl bg-[#1c1917] text-xs font-bold text-white shadow-2xs"
                      />
                      <div className="min-w-0">
                        <Link
                          href={`/candidaturas/${candidate.id}`}
                          className="font-semibold text-xs text-[#0a0a0a] hover:underline truncate block"
                        >
                          {candidate.name}
                        </Link>
                        <p className="text-[11px] text-[#71717a] truncate">
                          {candidate.jobTitle}
                        </p>
                      </div>
                    </div>

                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 shrink-0">
                      Em {candidate.daysUntil} dia{candidate.daysUntil > 1 ? "s" : ""}
                    </span>
                  </div>

                  <p className="mt-3 text-xs text-[#52525b]">
                    📅 <strong>{candidate.dayMonthFormatted}</strong> · fará <strong>{candidate.turningAge} anos</strong>
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-[#f4f4f5] flex items-center justify-between">
                  <span className="text-[11px] text-[#71717a]">
                    {candidate.phoneFormatted}
                  </span>
                  {candidate.whatsappUrl && (
                    <a
                      href={candidate.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                    >
                      <MessageCircle className="size-3.5" />
                      <span>WhatsApp</span>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-[#e4e4e7] bg-white p-6 text-center text-xs text-[#71717a]">
            Nenhum aniversário previsto para os próximos 7 dias.
          </div>
        )}
      </section>

      {/* SEÇÃO 3: ANIVERSARIANTES DESTE MÊS */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-[#0a0a0a]">
            Todos os Aniversariantes Deste Mês
          </h2>
          <span className="rounded-full bg-[#f4f4f5] px-2 py-0.5 text-xs font-bold text-[#71717a]">
            {thisMonth.length}
          </span>
        </div>

        {thisMonth.length > 0 ? (
          <div className="rounded-2xl border border-[#e4e4e7] bg-white shadow-2xs overflow-hidden">
            <div className="divide-y divide-[#f4f4f5]">
              {thisMonth.map((candidate) => (
                <div
                  key={candidate.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-[#fafaf9] transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ZoomableCandidateAvatar
                      applicationId={candidate.id}
                      name={candidate.name}
                      photoUrl={candidate.photoUrl}
                      className="size-9 shrink-0 rounded-xl bg-[#1c1917] text-xs font-bold text-white"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/candidaturas/${candidate.id}`}
                          className="font-bold text-xs sm:text-sm text-[#0a0a0a] hover:underline truncate"
                        >
                          {candidate.name}
                        </Link>
                        {candidate.isToday && (
                          <span className="rounded-full bg-amber-500 text-white px-2 py-0.2 text-[9px] font-bold">
                            Hoje! 🎉
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#71717a] truncate mt-0.5">
                        {candidate.jobTitle} · {candidate.phoneFormatted}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                    <div className="text-right">
                      <p className="text-xs font-bold text-[#0a0a0a]">
                        {candidate.dayMonthFormatted}
                      </p>
                      <p className="text-[11px] text-[#71717a]">
                        {candidate.turningAge} anos
                      </p>
                    </div>

                    {candidate.whatsappUrl && (
                      <a
                        href={candidate.whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 text-xs font-semibold text-emerald-900 shadow-2xs hover:bg-emerald-100 transition"
                      >
                        <MessageCircle className="size-3.5 text-emerald-700" />
                        <span>Felicitar</span>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-[#e4e4e7] bg-white p-6 text-center text-xs text-[#71717a]">
            Nenhum aniversário cadastrado para este mês.
          </div>
        )}
      </section>
    </div>
  );
}

