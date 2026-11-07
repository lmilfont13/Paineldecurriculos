"use client";

import React, { useEffect, useState } from "react";
import {
  CANDIDATE_EMOJI_KEYS,
  CANDIDATE_EMOJI_DEFINITIONS,
  type CandidateSentimentSummary,
} from "@/server/models/candidate-feedback.model";
import { HeartHandshake, MessageSquare, ThumbsUp, Sparkles, RefreshCw } from "lucide-react";

interface CandidateSentimentCardProps {
  companySlug?: string;
  initialSummary?: CandidateSentimentSummary | null;
  compact?: boolean;
}

export function CandidateSentimentCard({
  companySlug,
  initialSummary,
  compact = false,
}: CandidateSentimentCardProps) {
  const [summary, setSummary] = useState<CandidateSentimentSummary | null>(initialSummary || null);
  const [loading, setLoading] = useState(!initialSummary);

  const fetchSummary = async () => {
    try {
      const url = companySlug
        ? `/api/candidate-feedback?slug=${encodeURIComponent(companySlug)}`
        : `/api/candidate-feedback`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch {
      // Ignora erro
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();

    const handleNewFeedback = () => {
      fetchSummary();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("triagem:feedback-submitted", handleNewFeedback);
      return () => {
        window.removeEventListener("triagem:feedback-submitted", handleNewFeedback);
      };
    }
  }, [companySlug]);

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center p-6 text-xs text-stone-400">
        <RefreshCw className="size-4 animate-spin mr-2" />
        Carregando termômetro de satisfação...
      </div>
    );
  }

  const csat = summary?.csatScore ?? 100;
  const total = summary?.total ?? 0;
  const counts = summary?.counts ?? { love: 0, happy: 0, neutral: 0, sad: 0 };
  const percentages = summary?.percentages ?? { love: 0, happy: 0, neutral: 0, sad: 0 };
  const recentComments = summary?.recentComments ?? [];

  const getCsatBadge = (score: number) => {
    if (score >= 85) return { label: "Nível Michelin", bg: "bg-emerald-100 text-emerald-800 border-emerald-300" };
    if (score >= 70) return { label: "Muito Bom", bg: "bg-blue-100 text-blue-800 border-blue-300" };
    if (score >= 50) return { label: "Regular", bg: "bg-amber-100 text-amber-800 border-amber-300" };
    return { label: "Atenção", bg: "bg-rose-100 text-rose-800 border-rose-300" };
  };

  const badge = getCsatBadge(csat);

  if (compact) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-base">⭐</span>
            <span className="text-xs font-bold text-stone-900">Satisfação dos Candidatos</span>
          </div>
          <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${badge.bg}`}>
            {csat}% CSAT
          </span>
        </div>

        {/* Barra de Progresso Segmentada */}
        <div className="mt-2.5 flex h-2 w-full overflow-hidden rounded-full bg-stone-100">
          <div style={{ width: `${percentages.love}%` }} className="bg-emerald-500 transition-all duration-500" title={`Amei: ${percentages.love}%`} />
          <div style={{ width: `${percentages.happy}%` }} className="bg-blue-500 transition-all duration-500" title={`Muito Bom: ${percentages.happy}%`} />
          <div style={{ width: `${percentages.neutral}%` }} className="bg-amber-400 transition-all duration-500" title={`Regular: ${percentages.neutral}%`} />
          <div style={{ width: `${percentages.sad}%` }} className="bg-rose-500 transition-all duration-500" title={`Difícil: ${percentages.sad}%`} />
        </div>

        <div className="mt-2 grid grid-cols-4 text-center text-[10px]">
          <div><span className="font-bold text-emerald-700">{percentages.love}%</span> <span className="text-stone-500">😍</span></div>
          <div><span className="font-bold text-blue-700">{percentages.happy}%</span> <span className="text-stone-500">😊</span></div>
          <div><span className="font-bold text-amber-700">{percentages.neutral}%</span> <span className="text-stone-500">😐</span></div>
          <div><span className="font-bold text-rose-700">{percentages.sad}%</span> <span className="text-stone-500">😕</span></div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs space-y-4">
      {/* Topo com CSAT Score & Indicador */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
              <Sparkles className="size-4" />
            </span>
            <h3 className="text-sm font-bold text-stone-900">
              Termômetro de Experiência dos Candidatos
            </h3>
          </div>
          <p className="mt-0.5 text-xs text-stone-500">
            Avaliações em tempo real registradas nas páginas públicas da empresa
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <span className="text-xl font-black text-stone-900">{csat}%</span>
            <span className="block text-[10px] font-semibold text-stone-400">Score de Aprovação</span>
          </div>
          <span className={`rounded-xl border px-2.5 py-1 text-xs font-bold ${badge.bg}`}>
            {badge.label}
          </span>
        </div>
      </div>

      {/* Barra de Distribuição Segmentada */}
      <div>
        <div className="flex items-center justify-between text-xs font-medium text-stone-600 mb-1.5">
          <span>Distribuição de Sentimento</span>
          <span className="text-stone-400 font-normal">{total} {total === 1 ? "voto" : "votos contabilizados"}</span>
        </div>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-stone-100 p-0.5 shadow-inner">
          <div
            style={{ width: `${percentages.love}%` }}
            className="bg-emerald-500 rounded-l-full transition-all duration-700 hover:brightness-110"
            title={`😍 Amei: ${percentages.love}% (${counts.love} votos)`}
          />
          <div
            style={{ width: `${percentages.happy}%` }}
            className="bg-blue-500 transition-all duration-700 hover:brightness-110"
            title={`😊 Muito Bom: ${percentages.happy}% (${counts.happy} votos)`}
          />
          <div
            style={{ width: `${percentages.neutral}%` }}
            className="bg-amber-400 transition-all duration-700 hover:brightness-110"
            title={`😐 Regular: ${percentages.neutral}% (${counts.neutral} votos)`}
          />
          <div
            style={{ width: `${percentages.sad}%` }}
            className="bg-rose-500 rounded-r-full transition-all duration-700 hover:brightness-110"
            title={`😕 Difícil: ${percentages.sad}% (${counts.sad} votos)`}
          />
        </div>
      </div>

      {/* Grid com os 4 Emojis detalhados */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {CANDIDATE_EMOJI_KEYS.map((key) => {
          const def = CANDIDATE_EMOJI_DEFINITIONS[key];
          const count = counts[key];
          const pct = percentages[key];

          return (
            <div
              key={key}
              className="flex items-center gap-3 rounded-xl border border-stone-100 bg-stone-50/60 p-2.5 transition hover:bg-stone-50 hover:border-stone-200"
            >
              <span className="text-2xl">{def.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-xs font-extrabold text-stone-900">{pct}%</span>
                  <span className="text-[10px] text-stone-400 font-medium">({count})</span>
                </div>
                <p className="text-[10px] text-stone-500 truncate">{def.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Comentários e Sugestões Recentes */}
      {recentComments.length > 0 && (
        <div className="pt-2">
          <h4 className="text-xs font-bold text-stone-900 mb-2 flex items-center gap-1.5">
            <MessageSquare className="size-3.5 text-stone-400" />
            Sugestões & Elogios Recentes dos Candidatos ({recentComments.length})
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {recentComments.map((comment) => {
              const def = CANDIDATE_EMOJI_DEFINITIONS[comment.emoji];
              return (
                <div
                  key={comment.id}
                  className="rounded-xl border border-stone-100 bg-[#fafaf9] p-3 text-xs"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="flex items-center gap-1.5 font-bold text-stone-800 text-[11px]">
                      <span>{def.emoji}</span>
                      <span>{comment.candidateName || "Candidato Anônimo"}</span>
                    </span>
                    <span className="text-[10px] text-stone-400">
                      {comment.path ? `em ${comment.path}` : "No portal"}
                    </span>
                  </div>
                  <p className="text-stone-700 italic text-[11px]">
                    "{comment.comment}"
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
