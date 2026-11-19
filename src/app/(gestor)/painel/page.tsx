import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";

import { AiScoreChip } from "@/components/gestor/ai-score-chip";
import { CopyLink } from "@/components/gestor/copy-link";
import { getPainelData } from "@/server/controllers/gestor.controller";
import { formatWaiting } from "@/server/models/application.model";
import { CandidateAvatar } from "@/components/gestor/candidate-avatar";
import { getJobAccentTheme, jobStatusLabels, parseJobTitleAndCity } from "@/server/models/job.model";

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
  const { userName, companyName, publicUrl, stats, priority, jobs, analytics } =
    await getPainelData();
  const firstName = userName.split(" ")[0];

  // Primeiro uso (nenhuma vaga ainda): induz a criar a vaga, sem mostrar zeros.
  if (stats.totalJobs === 0) {
    return (
      <>
        <div className="flex items-center gap-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/tarhget-icon.png"
            alt={companyName}
            className="size-11 object-contain shrink-0"
          />
          <div>
            <h1 className="text-2xl font-bold text-[#0a0a0a]">Olá, {firstName}</h1>
            <p className="mt-1 text-sm text-[#71717a]">
              Vamos colocar a {companyName} para receber candidaturas.
            </p>
          </div>
        </div>

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
        <div className="flex items-center gap-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/tarhget-icon.png"
            alt={companyName}
            className="size-11 object-contain shrink-0"
          />
          <div>
            <h1 className="text-2xl font-bold text-[#0a0a0a]">
              Olá, {firstName}
            </h1>
            <p className="mt-1 text-sm text-[#71717a]">
              {nobodyYet
                ? `Painel de recrutamento da ${companyName}.`
                : `${stats.newApplications7d} candidatura${stats.newApplications7d === 1 ? "" : "s"} e ${stats.decided7d} ${stats.decided7d === 1 ? "decisão" : "decisões"} nos últimos 7 dias.`}
            </p>
          </div>
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

      {/* Micro-Dashboard Executivo Discreto: Cadastrados + Por Dia, Top Vagas, Homens x Mulheres, Qualidade IA & Funil */}
      {analytics.totalRegistrations > 0 && (
        <section
          aria-label="Resumo analítico da base"
          className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          {/* Card 1: Total de Cadastrados + Cadastros por Dia (7 dias) */}
          <div className="flex flex-col justify-between rounded-2xl border border-[#e4e4e7] bg-white p-4 shadow-2xs">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[#71717a]">
                  Cadastrados
                </span>
                <span
                  className={
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums " +
                    (analytics.todayRegistrations > 0
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-[#f4f4f5] text-[#71717a]")
                  }
                >
                  +{analytics.todayRegistrations} hoje
                </span>
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <Link
                  href="/buscar-cvs"
                  className="text-2xl font-bold tracking-[-0.02em] text-[#0a0a0a] tabular-nums hover:underline"
                >
                  {analytics.uniquePeople}
                </Link>
                <span className="text-xs text-[#71717a]">
                  pessoas ({analytics.totalRegistrations} candidaturas)
                </span>
              </div>
            </div>

            {/* Mini gráfico de barras: cadastros por dia nos últimos 7 dias */}
            <div className="mt-3.5 border-t border-[#f4f4f5] pt-2.5">
              <div className="mb-1.5 flex items-center justify-between text-[10px] text-[#71717a]">
                <span>Cadastros por dia (7d)</span>
                <span className="font-medium text-[#52525b] tabular-nums">
                  {analytics.last7DaysTotal} na semana
                </span>
              </div>
              {(() => {
                const maxDay = Math.max(
                  1,
                  ...analytics.dailyRegistrations.map((d) => d.count)
                );
                return (
                  <div className="grid grid-cols-7 items-end gap-1.5 pt-1">
                    {analytics.dailyRegistrations.map((d) => {
                      const heightPx =
                        d.count === 0
                          ? 3
                          : Math.max(6, Math.round((d.count / maxDay) * 26));
                      return (
                        <div
                          key={d.dateKey}
                          className="flex flex-col items-center gap-1"
                          title={`${d.dayMonth} (${d.weekday}): ${d.count} cadastro${d.count === 1 ? "" : "s"}`}
                        >
                          <span
                            className={
                              "text-[9px] font-semibold leading-none tabular-nums " +
                              (d.isToday
                                ? "text-[#0a0a0a]"
                                : d.count > 0
                                  ? "text-[#52525b]"
                                  : "text-[#d4d4d8]")
                            }
                          >
                            {d.count}
                          </span>
                          <div className="flex h-7 w-full items-end justify-center">
                            <span
                              className={
                                "w-full max-w-[18px] rounded-t-sm transition-all " +
                                (d.isToday
                                  ? "bg-[#0a0a0a]"
                                  : d.count > 0
                                    ? "bg-[#a1a1aa]/70"
                                    : "bg-[#f4f4f5]")
                              }
                              style={{
                                height: `${heightPx}px`,
                                ...(d.isToday && d.count > 0
                                  ? { backgroundColor: "var(--brand-primary)" }
                                  : {}),
                              }}
                            />
                          </div>
                          <span
                            className={
                              "text-[9px] leading-none " +
                              (d.isToday
                                ? "font-bold text-[#0a0a0a]"
                                : "text-[#71717a]")
                            }
                          >
                            {d.weekday}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Card 2: Vaga com Mais Cadastros (Top Vagas) */}
          <div className="flex flex-col justify-between rounded-2xl border border-[#e4e4e7] bg-white p-4 shadow-2xs">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[#71717a]">
                  Vaga com mais cadastros
                </span>
                {analytics.topJobs[0] && (
                  <span className="rounded-full bg-[#f4f4f5] px-2 py-0.5 text-[10px] font-semibold text-[#52525b] tabular-nums">
                    {analytics.topJobs[0].pct}% do total
                  </span>
                )}
              </div>

              {analytics.topJobs[0] ? (
                <Link
                  href={`/vagas/${analytics.topJobs[0].id}`}
                  className="mt-1.5 block group"
                >
                  <p className="truncate text-xs font-bold text-[#0a0a0a] group-hover:underline">
                    {analytics.topJobs[0].code != null
                      ? `#${analytics.topJobs[0].code} `
                      : ""}
                    {analytics.topJobs[0].title}
                  </p>
                  <p className="mt-0.5 flex items-baseline gap-1.5">
                    <span className="text-xl font-bold tracking-[-0.02em] text-[#0a0a0a] tabular-nums">
                      {analytics.topJobs[0].count}
                    </span>
                    <span className="text-[11px] text-[#71717a]">
                      inscrito{analytics.topJobs[0].count === 1 ? "" : "s"}
                    </span>
                  </p>
                </Link>
              ) : (
                <p className="mt-2 text-xs text-[#71717a]">Sem vagas com inscritos</p>
              )}
            </div>

            {analytics.topJobs.length > 1 && (
              <div className="mt-3 space-y-1.5 border-t border-[#f4f4f5] pt-2.5">
                {analytics.topJobs.slice(1, 3).map((j) => {
                  const maxCount = Math.max(1, analytics.topJobs[0]?.count ?? 1);
                  const barW = Math.max(8, Math.round((j.count / maxCount) * 100));
                  return (
                    <Link
                      key={j.id}
                      href={`/vagas/${j.id}`}
                      className="block group"
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="truncate text-[#52525b] group-hover:text-[#0a0a0a]">
                          {j.code != null ? `#${j.code} ` : ""}
                          {j.title}
                        </span>
                        <span className="shrink-0 font-semibold text-[#0a0a0a] tabular-nums">
                          {j.count}
                        </span>
                      </div>
                      <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-[#f4f4f5]">
                        <div
                          className="h-full rounded-full bg-[#a1a1aa]"
                          style={{ width: `${barW}%` }}
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Card 3: Homens × Mulheres (Demografia) */}
          <div className="flex flex-col justify-between rounded-2xl border border-[#e4e4e7] bg-white p-4 shadow-2xs">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[#71717a]">
                  Homens e Mulheres
                </span>
                <span className="text-[10px] font-medium text-[#71717a] tabular-nums">
                  {analytics.uniquePeople} únicos
                </span>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-[#f4f4f5] px-2.5 py-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#3f3f46]">
                    <span className="size-1.5 rounded-full bg-[var(--brand-primary)]" />
                    <span>Mulheres</span>
                  </div>
                  <p className="mt-0.5 flex items-baseline gap-1">
                    <span className="text-lg font-bold text-[#0a0a0a] tabular-nums">
                      {analytics.gender.femaleCount}
                    </span>
                    <span className="text-[11px] font-semibold text-[#52525b] tabular-nums">
                      {analytics.gender.femalePct}%
                    </span>
                  </p>
                </div>

                <div className="rounded-xl bg-[#f4f4f5] px-2.5 py-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#3f3f46]">
                    <span className="size-1.5 rounded-full bg-[#a1a1aa]" />
                    <span>Homens</span>
                  </div>
                  <p className="mt-0.5 flex items-baseline gap-1">
                    <span className="text-lg font-bold text-[#0a0a0a] tabular-nums">
                      {analytics.gender.maleCount}
                    </span>
                    <span className="text-[11px] font-semibold text-[#52525b] tabular-nums">
                      {analytics.gender.malePct}%
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 border-t border-[#f4f4f5] pt-2.5">
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-[#f4f4f5]">
                {analytics.gender.femalePct > 0 && (
                  <span
                    className="h-full bg-[var(--brand-primary)] transition-all"
                    style={{ width: `${analytics.gender.femalePct}%` }}
                  />
                )}
                {analytics.gender.malePct > 0 && (
                  <span
                    className="h-full bg-[#a1a1aa] transition-all"
                    style={{ width: `${analytics.gender.malePct}%` }}
                  />
                )}
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-[#71717a]">
                <span>Proporção estimada na base</span>
                {analytics.gender.unspecifiedCount > 0 && (
                  <span>{analytics.gender.unspecifiedCount} não id.</span>
                )}
              </div>
            </div>
          </div>

          {/* Card 4: Qualidade IA, Top Áreas e Funil */}
          <div className="flex flex-col justify-between rounded-2xl border border-[#e4e4e7] bg-white p-4 shadow-2xs">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[#71717a]">
                  Qualidade IA & Funil
                </span>
                {analytics.quality.avgScore !== null && (
                  <span className="rounded-full bg-[#e4f6ec] px-2 py-0.5 text-[10px] font-bold text-[#1f7a4d] tabular-nums">
                    Média {analytics.quality.avgScore} pts
                  </span>
                )}
              </div>

              <div className="mt-1.5 flex items-baseline gap-2">
                <Link
                  href="/candidaturas"
                  className="text-2xl font-bold tracking-[-0.02em] text-[#0a0a0a] tabular-nums hover:underline"
                >
                  {analytics.quality.aboveCutoffCount}
                </Link>
                <span className="text-xs text-[#71717a]">
                  acima do corte ({analytics.quality.aboveCutoffPct}%)
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-[#71717a]">
                <strong className="font-semibold text-[#0a0a0a]">
                  {analytics.quality.topMatchCount}
                </strong>{" "}
                Top Match (nota ≥ 80)
              </p>
            </div>

            <div className="mt-3 border-t border-[#f4f4f5] pt-2.5">
              {analytics.topAreas.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  {analytics.topAreas.map((area) => (
                    <span
                      key={area.label}
                      className="rounded-md bg-[#f4f4f5] px-1.5 py-0.5 text-[10px] font-medium text-[#52525b] tabular-nums"
                    >
                      {area.label} ({area.count})
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-[#71717a] tabular-nums">
                <span>
                  Análise:{" "}
                  <strong className="text-[#0a0a0a]">
                    {analytics.funnel.shortlisted}
                  </strong>
                </span>
                <span>·</span>
                <span>
                  Entrevista:{" "}
                  <strong className="text-[#0a0a0a]">
                    {analytics.funnel.interview}
                  </strong>
                </span>
                <span>·</span>
                <span>
                  Aprovados:{" "}
                  <strong className="text-emerald-700">
                    {analytics.funnel.approved}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* Card 5: Principais Funções / Cargos na Base */}
          <div className="flex flex-col justify-between rounded-2xl border border-[#e4e4e7] bg-white p-4 shadow-2xs">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[#71717a]">
                  Principais funções
                </span>
                {analytics.topRoles[0] && (
                  <span className="rounded-full bg-[#f4f4f5] px-2 py-0.5 text-[10px] font-semibold text-[#52525b] tabular-nums">
                    {analytics.topRoles[0].pct}% líder
                  </span>
                )}
              </div>

              {analytics.topRoles.length > 0 ? (
                <div className="mt-2.5 space-y-2">
                  {analytics.topRoles.slice(0, 3).map((role) => (
                    <div key={role.label}>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate font-medium text-[#0a0a0a]">
                          {role.label}
                        </span>
                        <span className="shrink-0 text-[11px] font-semibold text-[#52525b] tabular-nums">
                          {role.count} ({role.pct}%)
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#f4f4f5]">
                        <div
                          className="h-full rounded-full bg-[#0a0a0a]/80"
                          style={{ width: `${Math.max(8, role.pct)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-[#71717a]">
                  Aguardando leitura de perfis pela IA
                </p>
              )}
            </div>

            <div className="mt-3 border-t border-[#f4f4f5] pt-2 text-[10px] text-[#71717a]">
              <Link href="/buscar-cvs" className="font-medium text-[#52525b] hover:text-[#0a0a0a] hover:underline">
                Filtrar por função na busca de CVs →
              </Link>
            </div>
          </div>

          {/* Card 6: Cidades / Regiões & Mobilidade */}
          <div className="flex flex-col justify-between rounded-2xl border border-[#e4e4e7] bg-white p-4 shadow-2xs">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[#71717a]">
                  Cidades & Mobilidade
                </span>
                {analytics.topCities[0] && (
                  <span className="rounded-full bg-[#f4f4f5] px-2 py-0.5 text-[10px] font-semibold text-[#52525b] tabular-nums">
                    {analytics.topCities[0].label}
                  </span>
                )}
              </div>

              {analytics.topCities.length > 0 ? (
                <div className="mt-2.5 space-y-1.5">
                  {analytics.topCities.slice(0, 3).map((city) => (
                    <div
                      key={city.label}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="truncate text-[#3f3f46]">{city.label}</span>
                      <span className="shrink-0 font-semibold text-[#0a0a0a] tabular-nums">
                        {city.count}{" "}
                        <span className="text-[10px] font-normal text-[#71717a]">
                          ({city.pct}%)
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-[#71717a]">
                  Localidades em preenchimento
                </p>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#f4f4f5] pt-2.5 text-[10px] text-[#71717a] tabular-nums">
              <span>
                Com CNH:{" "}
                <strong className="text-[#0a0a0a]">
                  {analytics.readiness.withCnhCount}
                </strong>
              </span>
              <span>·</span>
              <span>
                Início imediato:{" "}
                <strong className="text-emerald-700">
                  {analytics.readiness.immediateCount}
                </strong>
              </span>
            </div>
          </div>

          {/* Card 7: Faixa Etária da Base */}
          <div className="flex flex-col justify-between rounded-2xl border border-[#e4e4e7] bg-white p-4 shadow-2xs">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[#71717a]">
                  Faixa etária
                </span>
                {analytics.ageSummary.avgAge !== null && (
                  <span className="rounded-full bg-[#f4f4f5] px-2 py-0.5 text-[10px] font-semibold text-[#0a0a0a] tabular-nums">
                    Média {analytics.ageSummary.avgAge} anos
                  </span>
                )}
              </div>

              <div className="mt-2.5 space-y-1.5">
                {analytics.ageSummary.brackets.map((b) => (
                  <div key={b.label} className="flex items-center gap-2 text-[11px]">
                    <span className="w-16 shrink-0 text-[#52525b]">{b.label}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#f4f4f5]">
                      <div
                        className="h-full rounded-full bg-[#52525b]"
                        style={{ width: `${b.count > 0 ? Math.max(8, b.pct) : 0}%` }}
                      />
                    </div>
                    <span className="w-12 shrink-0 text-right font-semibold text-[#0a0a0a] tabular-nums">
                      {b.count}{" "}
                      <span className="text-[10px] font-normal text-[#71717a]">
                        ({b.pct}%)
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3 border-t border-[#f4f4f5] pt-2 text-[10px] text-[#71717a]">
              Informativo demográfico (não altera nota da IA)
            </div>
          </div>

          {/* Card 8: Senioridade & Prontidão para Avançar */}
          <div className="flex flex-col justify-between rounded-2xl border border-[#e4e4e7] bg-white p-4 shadow-2xs">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[#71717a]">
                  Senioridade & Prontidão
                </span>
                <span className="rounded-full bg-[#f4f4f5] px-2 py-0.5 text-[10px] font-semibold text-[#52525b] tabular-nums">
                  Stand-by: {analytics.funnel.standby}
                </span>
              </div>

              {analytics.levels.length > 0 ? (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {analytics.levels.map((lvl) => (
                    <span
                      key={lvl.label}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#e4e4e7] bg-[#fafaf9] px-2 py-1 text-[11px] font-medium text-[#0a0a0a] tabular-nums"
                    >
                      <span>{lvl.label}</span>
                      <span className="text-[10px] font-bold text-[#71717a]">
                        {lvl.count} ({lvl.pct}%)
                      </span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-[#71717a]">
                  Senioridade calculada na triagem
                </p>
              )}
            </div>

            <div className="mt-3 border-t border-[#f4f4f5] pt-2.5">
              <Link
                href="/candidaturas"
                className="flex items-center justify-between text-[11px] font-semibold text-[#0a0a0a] hover:underline"
              >
                <span>Prontos p/ avançar na triagem</span>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 tabular-nums">
                  {analytics.readiness.readyToAdvanceCount} acima do corte →
                </span>
              </Link>
            </div>
          </div>
        </section>
      )}

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
                  ? "text-[#71717a]"
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
            href={priority[0] ? `/candidaturas/${priority[0].id}` : "/candidaturas?status=PENDING"}
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

          <div className="mt-4 max-w-[848px] overflow-hidden rounded-2xl border border-[#e4e4e7] bg-white shadow-2xs">
            {priority.map((app) => {
              const { role, city } = parseJobTitleAndCity(app.jobTitle);
              return (
                <Link
                  key={app.id}
                  href={`/candidaturas/${app.id}`}
                  className="flex items-center gap-3.5 border-b border-[#e4e4e7] px-5 py-4 transition-colors last:border-b-0 hover:bg-[#fafaf9] focus-visible:bg-[#fafaf9] focus-visible:outline-none"
                >
                  <CandidateAvatar
                    name={app.name}
                    photoUrl={app.photoUrl}
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1c1917] text-[10px] font-bold text-white"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 truncate text-[13px] font-medium text-[#0a0a0a]">
                      <span className="truncate">{app.name}</span>
                      {app.hasImpediment && (
                        <span
                          className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-zinc-200/80 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-600"
                          title={app.impedimentReason ? `Motivo: ${app.impedimentReason}` : "Impedimento de contratação ativo"}
                        >
                          <span className="size-1.5 rounded-full bg-rose-500/80" />
                          <span>Tarja preta</span>
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 truncate text-[11px] text-[#71717a]">
                      <span className="font-medium text-zinc-800">{role}</span>
                      {city && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.2 text-[10px] font-bold uppercase text-zinc-700">
                          <MapPin className="size-2.5 opacity-70" strokeWidth={2.5} />
                          {city}
                        </span>
                      )}
                      <span>·</span>
                      <span>espera{" "}
                        <span className="font-medium text-[#b07818]">
                          {formatWaiting(app.createdAt)}
                        </span>
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
              );
            })}
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
            {jobs.map((job, idx) => {
              const theme = getJobAccentTheme(job.id || idx);
              const { role, city } = parseJobTitleAndCity(job.title);
              return (
                <Link
                  key={job.id}
                  href={`/vagas/${job.id}`}
                  className={`group rounded-2xl border ${theme.border} bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0px_4px_16px_rgba(0,0,0,0.06)]`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className={`h-4 w-1.5 shrink-0 rounded-full ${theme.bar}`} aria-hidden />
                      <span className="truncate text-sm font-bold text-[#0a0a0a] group-hover:text-[#7c1d3c] transition-colors">
                        {role}
                      </span>
                      {city && (
                        <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-2xs ${theme.cityTag}`}>
                          <MapPin className="size-2.5 opacity-80" strokeWidth={2.5} />
                          {city}
                        </span>
                      )}
                    </div>
                    {job.status !== "OPEN" && (
                      <span className="shrink-0 rounded-full border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                        {jobStatusLabels[job.status]}
                      </span>
                    )}
                  </div>
                  <span className="mt-3.5 block">
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
                        <span className="font-semibold text-zinc-800">{job.total}</span> candidato{job.total === 1 ? "" : "s"}
                        {job.pending > 0 && (
                          <>
                            {" · "}
                            <span className="font-semibold text-[#b07818]">
                              {job.pending} esperando
                            </span>
                          </>
                        )}
                        {job.interview > 0 && ` · ${job.interview} em entrevista`}
                      </>
                    )}
                  </span>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
