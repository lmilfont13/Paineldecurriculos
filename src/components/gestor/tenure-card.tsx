"use client";

import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  History,
  Scale,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import type { TenureAnalysis } from "@/server/models/tenure.model";

export function TenureCard({ tenure }: { tenure: TenureAnalysis | null }) {
  if (!tenure || !tenure.temHistorico) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-[#e4e4e7] bg-[#fafaf9] p-4 text-xs text-[#71717a]">
        <div className="flex items-center gap-2 font-medium text-[#0a0a0a]">
          <History className="size-4 text-[#a1a1aa]" />
          <span>Tempo de permanência nas empresas (Média & Mediana)</span>
        </div>
        <p className="mt-1 text-[11px] text-[#a1a1aa]">
          Sem histórico com datas de entrada e saída detectadas para este candidato. Se o currículo possui datas de atuação profissional, clique em &ldquo;Analisar de novo&rdquo; acima para reprocessar o cálculo detalhado de tempo por empresa.
        </p>
      </div>
    );
  }

  const isHigh = tenure.estabilidade === "ALTA";
  const isLow = tenure.estabilidade === "BAIXA";
  const isMed = tenure.estabilidade === "MEDIA";

  const maxMonths = Math.max(1, ...tenure.empresas.map((e) => e.meses));

  return (
    <div className="mt-6 rounded-2xl border border-[#e4e4e7] bg-white p-5 shadow-xs">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
              isHigh
                ? "bg-[#e4f6ec] text-[#1f7a4d]"
                : isLow
                  ? "bg-[#fbeae8] text-[#c23b3b]"
                  : "bg-[#eaf1fb] text-[#2f5fa8]"
            }`}
          >
            {isHigh ? (
              <ShieldCheck className="size-4.5" />
            ) : isLow ? (
              <ShieldAlert className="size-4.5" />
            ) : (
              <Clock className="size-4.5" />
            )}
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-[#0a0a0a]">
              Tempo de permanência nas empresas
            </h3>
            <p className="text-[11px] text-[#71717a]">
              Média e mediana de permanência por empresa e rotatividade
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              isHigh
                ? "bg-[#e4f6ec] text-[#1f7a4d]"
                : isLow
                  ? "bg-[#fbeae8] text-[#c23b3b]"
                  : "bg-[#eaf1fb] text-[#2f5fa8]"
            }`}
          >
            {isHigh && <CheckCircle2 className="size-3.5" />}
            {isLow && <AlertTriangle className="size-3.5" />}
            <span>{tenure.estabilidadeLabel}</span>
          </span>
        </div>
      </div>

      {/* Cards de Métricas: Média, Mediana e Total */}
      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <div className="rounded-xl border border-[#e4e4e7] bg-[#fafaf9] p-3 transition hover:bg-white">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#71717a]">
            <TrendingUp className="size-3.5 text-[#2f5fa8]" />
            <span>Média por empresa</span>
          </div>
          <p className="mt-1 text-base font-bold text-[#0a0a0a]">
            {tenure.tempoMedioFormatado}
          </p>
          <span className="text-[10px] text-[#a1a1aa]">Tempo médio aritmético</span>
        </div>

        <div className="rounded-xl border border-[#e4e4e7] bg-[#fafaf9] p-3 transition hover:bg-white">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#71717a]">
            <Scale className="size-3.5 text-[#b07818]" />
            <span>Mediana nas empresas</span>
          </div>
          <p className="mt-1 text-base font-bold text-[#0a0a0a]">
            {tenure.tempoMedianoFormatado}
          </p>
          <span className="text-[10px] text-[#a1a1aa]">Ponto central sem distorções</span>
        </div>

        <div className="rounded-xl border border-[#e4e4e7] bg-[#fafaf9] p-3 transition hover:bg-white">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#71717a]">
            <Building2 className="size-3.5 text-[#71717a]" />
            <span>Empresas analisadas</span>
          </div>
          <p className="mt-1 text-base font-bold text-[#0a0a0a]">
            {tenure.totalExperiencias} {tenure.totalExperiencias === 1 ? "empresa" : "empresas"}
          </p>
          <span className="text-[10px] text-[#a1a1aa]">Com datas no currículo</span>
        </div>
      </div>

      {/* Resumo da Análise */}
      <div
        className={`mt-3.5 rounded-xl p-3 text-xs leading-relaxed ${
          isLow
            ? "border border-[#f5c6cb] bg-[#fff5f5] text-[#721c24]"
            : isHigh
              ? "border border-[#c3e6cb] bg-[#f4faf6] text-[#155724]"
              : "border border-[#e4e4e7] bg-[#fafaf9] text-[#3f3f46]"
        }`}
      >
        <p className="font-medium">{tenure.resumo}</p>
        {tenure.temPassagemCurta && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-[#b07818]">
            <AlertTriangle className="size-3 shrink-0" />
            <span>Há passagens inferiores a 6 meses registradas no histórico.</span>
          </p>
        )}
      </div>

      {/* Histórico detalhado por empresa: quanto tempo ficou em cada uma */}
      <div className="mt-5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
            Quanto tempo ficou em cada empresa ({tenure.empresas.length})
          </p>
          <span className="text-[10px] text-[#a1a1aa]">Período & Duração</span>
        </div>

        <div className="mt-2.5 space-y-2">
          {tenure.empresas.map((item, idx) => {
            const isShort = item.meses > 0 && item.meses < 6;
            const isLong = item.meses >= 24;
            const barWidth = Math.min(100, Math.max(8, Math.round((item.meses / maxMonths) * 100)));

            return (
              <div
                key={`${item.empresa}-${idx}`}
                className="group relative overflow-hidden rounded-xl border border-[#f0f0f2] bg-[#fafaf9] p-3 transition hover:border-[#e4e4e7] hover:bg-white"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-[#e4e4e7] bg-white text-[#71717a]">
                      <Building2 className="size-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="block truncate text-xs font-semibold text-[#0a0a0a]">
                          {item.empresa}
                        </span>
                        {item.atual && (
                          <span className="rounded-md bg-[#eaf1fb] px-1.5 py-0.2 text-[9px] font-semibold text-[#2f5fa8]">
                            Atual
                          </span>
                        )}
                      </div>
                      <span className="block truncate text-[11px] text-[#71717a]">
                        {item.cargo} · <span className="text-[#a1a1aa]">{item.periodo}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold tabular-nums shadow-2xs ${
                        isShort
                          ? "bg-[#fbeae8] text-[#c23b3b]"
                          : isLong
                            ? "bg-[#e4f6ec] text-[#1f7a4d]"
                            : "border border-[#e4e4e7] bg-white text-[#3f3f46]"
                      }`}
                      title={item.meses > 0 ? `${item.meses} meses no total` : undefined}
                    >
                      {item.duracaoFormatada}
                    </span>
                  </div>
                </div>

                {/* Barra de duração relativa */}
                {item.meses > 0 && (
                  <div className="mt-2.5 h-1.5 w-full rounded-full bg-[#e4e4e7]/60 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isShort
                          ? "bg-[#c23b3b]"
                          : isLong
                            ? "bg-[#1f7a4d]"
                            : "bg-[#2f5fa8]"
                      }`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
