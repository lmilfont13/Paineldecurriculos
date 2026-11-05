"use client";

import { useEffect, useState, useTransition } from "react";
import {
  BarChart3,
  Clock,
  Loader2,
  TrendingUp,
  Users,
} from "lucide-react";

import { getJobMetricsAction } from "@/server/controllers/referrer.controller";
import { sourceLabel } from "@/server/models/attribution.model";

type Metrics = {
  sourceBreakdown: Record<string, number>;
  statusFunnel: Record<string, number>;
  avgDaysToHire: number | null;
  applicationsTimeline: Record<string, number>;
};

const FUNNEL_ORDER = ["PENDING", "SHORTLISTED", "INTERVIEW", "STANDBY", "APPROVED", "REJECTED"];
const FUNNEL_LABELS: Record<string, string> = {
  PENDING: "Triagem",
  SHORTLISTED: "Pré-selecionado",
  INTERVIEW: "Entrevista",
  STANDBY: "Stand-by",
  APPROVED: "Aprovado",
  REJECTED: "Banco de dados",
};
const FUNNEL_COLORS: Record<string, string> = {
  PENDING: "#b07818",
  SHORTLISTED: "#2f5fa8",
  INTERVIEW: "#7c3aed",
  STANDBY: "#0e7a6b",
  APPROVED: "#1f7a4d",
  REJECTED: "#a1a1aa",
};

/** Barra horizontal proporcional. */
function Bar({
  label,
  count,
  max,
  color,
}: {
  label: string;
  count: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-right text-[11px] text-[#71717a]">
        {label}
      </span>
      <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-[#f4f4f5]">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
          style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-8 shrink-0 text-[12px] font-semibold text-[#0a0a0a]">
        {count}
      </span>
    </div>
  );
}

export function JobMetrics({ jobId }: { jobId: string }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const data = await getJobMetricsAction(jobId);
      setMetrics(data);
    });
  }, [jobId]);

  if (pending && !metrics) {
    return (
      <section className="mt-6 flex items-center gap-2 rounded-xl border border-[#e4e4e7] bg-white p-5 text-[13px] text-[#71717a]">
        <Loader2 className="size-4 animate-spin" /> Carregando indicadores…
      </section>
    );
  }

  if (!metrics) return null;

  const totalApps = Object.values(metrics.statusFunnel).reduce(
    (s, n) => s + n,
    0,
  );

  // Origem: ordenar por contagem desc
  const sourceEntries = Object.entries(metrics.sourceBreakdown).sort(
    (a, b) => b[1] - a[1],
  );
  const maxSource = sourceEntries[0]?.[1] ?? 0;

  // Funil: mostrar etapas com candidaturas e sempre exibir Stand-by no funil
  const funnelEntries = FUNNEL_ORDER.filter(
    (s) => (metrics.statusFunnel[s] ?? 0) > 0 || s === "STANDBY",
  ).map((s) => ({ key: s, count: metrics.statusFunnel[s] ?? 0 }));

  // Timeline: últimos 7 dias com dados
  const timelineEntries = Object.entries(metrics.applicationsTimeline)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-7);
  const maxDay = Math.max(...timelineEntries.map(([, n]) => n), 1);

  return (
    <section className="mt-6 rounded-xl border border-[#e4e4e7] bg-white p-5">
      <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-[#0a0a0a]">
        <BarChart3 className="size-4 text-[#a1a1aa]" aria-hidden />
        Indicadores desta vaga
      </h2>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Origem dos candidatos */}
        <div>
          <h3 className="flex items-center gap-1.5 text-[12px] font-medium text-[#52525b]">
            <Users className="size-3.5" /> De onde vieram
          </h3>
          {sourceEntries.length === 0 ? (
            <p className="mt-2 text-[11px] text-[#a1a1aa]">
              Ainda sem candidaturas com origem rastreada. Divulgue com{" "}
              <code className="rounded bg-[#f4f4f5] px-1">?origem=instagram</code>{" "}
              no link.
            </p>
          ) : (
            <div className="mt-3 space-y-1.5">
              {sourceEntries.map(([source, count]) => (
                <Bar
                  key={source}
                  label={sourceLabel(source)}
                  count={count}
                  max={maxSource}
                  color="#0a0a0a"
                />
              ))}
            </div>
          )}
        </div>

        {/* Funil por status */}
        <div>
          <h3 className="flex items-center gap-1.5 text-[12px] font-medium text-[#52525b]">
            <TrendingUp className="size-3.5" /> Funil
          </h3>
          {funnelEntries.length === 0 ? (
            <p className="mt-2 text-[11px] text-[#a1a1aa]">
              Sem candidaturas ainda.
            </p>
          ) : (
            <div className="mt-3 space-y-1.5">
              {funnelEntries.map((e) => (
                <Bar
                  key={e.key}
                  label={FUNNEL_LABELS[e.key] ?? e.key}
                  count={e.count}
                  max={totalApps}
                  color={FUNNEL_COLORS[e.key] ?? "#71717a"}
                />
              ))}
            </div>
          )}
        </div>

        {/* Tempo e ritmo */}
        <div>
          <h3 className="flex items-center gap-1.5 text-[12px] font-medium text-[#52525b]">
            <Clock className="size-3.5" /> Ritmo
          </h3>
          <div className="mt-3 space-y-3">
            {/* Tempo médio de contratação */}
            <div className="rounded-lg bg-[#fafaf9] p-3">
              <p className="text-[11px] text-[#71717a]">
                Tempo médio até aprovação
              </p>
              <p className="mt-0.5 text-xl font-bold text-[#0a0a0a]">
                {metrics.avgDaysToHire !== null
                  ? `${metrics.avgDaysToHire} ${metrics.avgDaysToHire === 1 ? "dia" : "dias"}`
                  : "—"}
              </p>
              {metrics.avgDaysToHire === null && (
                <p className="text-[10px] text-[#a1a1aa]">
                  Aparece quando houver aprovações
                </p>
              )}
            </div>

            {/* Mini timeline */}
            {timelineEntries.length > 0 && (
              <div>
                <p className="text-[11px] text-[#71717a]">
                  Candidaturas por dia
                </p>
                <div className="mt-2 flex items-end gap-1" style={{ height: 48 }}>
                  {timelineEntries.map(([day, count]) => (
                    <div
                      key={day}
                      className="group relative flex-1"
                      title={`${day}: ${count}`}
                    >
                      <div
                        className="w-full rounded-sm bg-[#0a0a0a] transition-all"
                        style={{
                          height: `${Math.max((count / maxDay) * 48, 3)}px`,
                        }}
                      />
                      <span className="absolute -bottom-4 left-1/2 hidden -translate-x-1/2 text-[9px] text-[#a1a1aa] group-hover:block">
                        {day.slice(5)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex justify-between text-[9px] text-[#a1a1aa]">
                  <span>{timelineEntries[0]?.[0]?.slice(5)}</span>
                  <span>{timelineEntries.at(-1)?.[0]?.slice(5)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
