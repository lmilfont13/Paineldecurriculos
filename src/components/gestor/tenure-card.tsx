"use client";

import { AlertTriangle, Building2, CheckCircle2, Clock, History, ShieldAlert, ShieldCheck } from "lucide-react";
import type { TenureAnalysis } from "@/server/models/tenure.model";

export function TenureCard({ tenure }: { tenure: TenureAnalysis | null }) {
  if (!tenure || !tenure.temHistorico) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-[#e4e4e7] bg-[#fafaf9] p-4 text-xs text-[#71717a]">
        <div className="flex items-center gap-2 font-medium text-[#0a0a0a]">
          <History className="size-4 text-[#a1a1aa]" />
          <span>Tempo de permanência nas empresas</span>
        </div>
        <p className="mt-1 text-[11px] text-[#a1a1aa]">
          Sem histórico com datas de entrada e saída detectadas para este candidato. Se o currículo foi enviado anteriormente, use o botão &ldquo;Analisar de novo&rdquo; acima para a IA extrair as empresas e durações.
        </p>
      </div>
    );
  }

  const isHigh = tenure.estabilidade === "ALTA";
  const isLow = tenure.estabilidade === "BAIXA";
  const isMed = tenure.estabilidade === "MEDIA";

  return (
    <div className="mt-6 rounded-2xl border border-[#e4e4e7] bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${
              isHigh
                ? "bg-[#e4f6ec] text-[#1f7a4d]"
                : isLow
                  ? "bg-[#fbeae8] text-[#c23b3b]"
                  : "bg-[#eaf1fb] text-[#2f5fa8]"
            }`}
          >
            {isHigh ? (
              <ShieldCheck className="size-4" />
            ) : isLow ? (
              <ShieldAlert className="size-4" />
            ) : (
              <Clock className="size-4" />
            )}
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-[#0a0a0a]">
              Tempo de permanência nas empresas
            </h3>
            <p className="text-[11px] text-[#71717a]">
              Durabilidade e análise de rotatividade profissional
            </p>
          </div>
        </div>

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
          <span>
            Média de {tenure.tempoMedioFormatado} por empresa
          </span>
        </span>
      </div>

      <div
        className={`mt-4 rounded-xl p-3.5 text-xs leading-relaxed ${
          isLow
            ? "border border-[#f5c6cb] bg-[#fff5f5] text-[#721c24]"
            : isHigh
              ? "border border-[#c3e6cb] bg-[#f4faf6] text-[#155724]"
              : "border border-[#e4e4e7] bg-[#fafaf9] text-[#3f3f46]"
        }`}
      >
        <p className="font-medium">
          {tenure.resumo}
        </p>
        {tenure.temPassagemCurta && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-[#b07818]">
            <AlertTriangle className="size-3 shrink-0" />
            <span>Há experiências com duração inferior a 6 meses no histórico.</span>
          </p>
        )}
      </div>

      <div className="mt-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
          Histórico por empresa ({tenure.empresas.length})
        </p>
        <div className="mt-2.5 space-y-2">
          {tenure.empresas.map((item, idx) => {
            const isShort = item.meses > 0 && item.meses < 6;
            const isLong = item.meses >= 24;

            return (
              <div
                key={`${item.empresa}-${idx}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#f0f0f2] bg-[#fafaf9] px-3.5 py-2.5 transition hover:bg-white hover:border-[#e4e4e7]"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white text-[#71717a] border border-[#e4e4e7]">
                    <Building2 className="size-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-[#0a0a0a]">
                      {item.empresa}
                    </span>
                    <span className="block truncate text-[11px] text-[#71717a]">
                      {item.cargo} · <span className="text-[#a1a1aa]">{item.periodo}</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {item.atual && (
                    <span className="rounded-md bg-[#eaf1fb] px-2 py-0.5 text-[10px] font-medium text-[#2f5fa8]">
                      Atual
                    </span>
                  )}
                  <span
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                      isShort
                        ? "bg-[#fbeae8] text-[#c23b3b]"
                        : isLong
                          ? "bg-[#e4f6ec] text-[#1f7a4d]"
                          : "bg-white text-[#3f3f46] border border-[#e4e4e7]"
                    }`}
                  >
                    {item.duracaoFormatada}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

