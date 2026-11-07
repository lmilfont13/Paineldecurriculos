"use client";

import React, { useState, useEffect } from "react";
import {
  CANDIDATE_EMOJI_KEYS,
  CANDIDATE_EMOJI_DEFINITIONS,
  type CandidateEmojiKey,
} from "@/server/models/candidate-feedback.model";
import { MessageSquareHeart, Check, X, Sparkles, Send } from "lucide-react";

interface CandidateSentimentWidgetProps {
  companySlug: string;
  companyName: string;
  candidateName?: string | null;
}

export function CandidateSentimentWidget({
  companySlug,
  companyName,
  candidateName,
}: CandidateSentimentWidgetProps) {
  const [mounted, setMounted] = useState(false);
  const [alreadyVoted, setAlreadyVoted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState<CandidateEmojiKey | null>(null);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [step, setStep] = useState<"choose" | "comment" | "done">("choose");

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(`triagem:feedback:${companySlug}`);
      if (stored) {
        setAlreadyVoted(true);
      } else {
        // Exibe após 4 segundos de navegação para não incomodar na chegada imediata
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 4000);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, [companySlug]);

  if (!mounted) return null;

  const handleVote = async (emojiKey: CandidateEmojiKey) => {
    setSelectedEmoji(emojiKey);

    // Se for feedback positivo (love ou happy), envia direto e mostra agradecimento
    if (emojiKey === "love" || emojiKey === "happy") {
      await submitFeedback(emojiKey, "");
      setStep("done");
      setShowThankYou(true);
      setTimeout(() => {
        setIsOpen(false);
      }, 3500);
    } else {
      // Se for neutro ou negativo, abre campo empático para sugestão de melhoria
      setStep("comment");
    }
  };

  const submitFeedback = async (emojiKey: CandidateEmojiKey, userComment: string) => {
    setIsSubmitting(true);
    try {
      const path = typeof window !== "undefined" ? window.location.pathname : "/";
      const name =
        candidateName?.trim() ||
        (typeof window !== "undefined" ? localStorage.getItem("triagem:candidate:name") : "") ||
        undefined;

      await fetch("/api/candidate-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: companySlug,
          emoji: emojiKey,
          comment: userComment || undefined,
          path,
          candidateName: name,
        }),
      });

      localStorage.setItem(`triagem:feedback:${companySlug}`, Date.now().toString());
      setAlreadyVoted(true);

      // Dispara evento local para sincronizar se o gestor estiver na mesma janela
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("triagem:feedback-submitted", {
            detail: { emoji: emojiKey, comment: userComment },
          })
        );
      }
    } catch {
      // Falha silenciosa para não travar o candidato
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendComment = async () => {
    if (!selectedEmoji) return;
    await submitFeedback(selectedEmoji, comment);
    setStep("done");
    setShowThankYou(true);
    setTimeout(() => {
      setIsOpen(false);
    }, 3500);
  };

  const handleSkipComment = async () => {
    if (!selectedEmoji) return;
    await submitFeedback(selectedEmoji, "");
    setStep("done");
    setShowThankYou(true);
    setTimeout(() => {
      setIsOpen(false);
    }, 3000);
  };

  // Se já votou e fechou, mostra apenas um micro-botão elegante no rodapé direito
  if (alreadyVoted && !isOpen) {
    return (
      <div className="fixed bottom-24 right-4 z-40">
        <button
          type="button"
          onClick={() => {
            setStep("choose");
            setShowThankYou(false);
            setIsOpen(true);
          }}
          title="Avaliar portal da empresa"
          className="group flex items-center gap-2 rounded-full border border-stone-200/80 bg-white/95 px-3 py-1.5 text-[11px] font-medium text-stone-600 shadow-md backdrop-blur-md transition-all hover:border-amber-400 hover:text-stone-900 hover:shadow-lg"
        >
          <span className="text-sm transition-transform group-hover:scale-125">⭐</span>
          <span className="hidden sm:inline">Avaliar portal</span>
        </button>
      </div>
    );
  }

  if (!isOpen) return null;

  return (
    <aside
      aria-label="Avaliação da experiência do candidato"
      className="fixed bottom-24 right-4 z-40 max-w-[340px] w-[calc(100vw-32px)] rounded-2xl border border-stone-200/90 bg-white/95 p-4 shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-5"
    >
      {/* Botão fechar */}
      <button
        type="button"
        onClick={() => setIsOpen(false)}
        className="absolute top-3 right-3 text-stone-400 hover:text-stone-700 rounded-lg p-1 transition"
        title="Fechar"
      >
        <X className="size-3.5" />
      </button>

      {step === "choose" && (
        <div>
          <div className="flex items-center gap-2 mb-2 pr-6">
            <span className="flex size-7 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60 shadow-2xs">
              <Sparkles className="size-4" />
            </span>
            <div>
              <h4 className="text-xs font-bold text-stone-900">
                Como está sua experiência?
              </h4>
              <p className="text-[10px] text-stone-500">
                Seu feedback ajuda a {companyName} a melhorar
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {CANDIDATE_EMOJI_KEYS.map((key) => {
              const def = CANDIDATE_EMOJI_DEFINITIONS[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleVote(key)}
                  className="group flex flex-col items-center justify-center rounded-xl border border-stone-100 bg-stone-50/70 p-2.5 transition-all hover:scale-105 hover:border-amber-300 hover:bg-amber-50/40 hover:shadow-sm active:scale-95"
                >
                  <span className="text-2xl transition-transform group-hover:scale-125 duration-200">
                    {def.emoji}
                  </span>
                  <span className="mt-1 text-[9px] font-bold text-stone-600 group-hover:text-amber-900 leading-tight text-center">
                    {key === "love" && "Amei"}
                    {key === "happy" && "Muito boa"}
                    {key === "neutral" && "Regular"}
                    {key === "sad" && "Difícil"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === "comment" && (
        <div>
          <div className="flex items-center gap-2 mb-2 pr-6">
            <span className="text-2xl">
              {selectedEmoji && CANDIDATE_EMOJI_DEFINITIONS[selectedEmoji].emoji}
            </span>
            <div>
              <h4 className="text-xs font-bold text-stone-900">
                Quer nos contar o motivo?
              </h4>
              <p className="text-[10px] text-stone-500">
                Sua sugestão de melhoria é super valiosa (opcional)
              </p>
            </div>
          </div>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Ex.: Gostaria de ver o salário antes ou achei o formulário longo..."
            rows={2}
            className="w-full mt-2 rounded-xl border border-stone-200 bg-stone-50/50 p-2 text-xs text-stone-900 placeholder:text-stone-400 focus:border-amber-500 focus:bg-white focus:outline-none transition resize-none"
          />

          <div className="mt-2.5 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleSkipComment}
              disabled={isSubmitting}
              className="text-[11px] font-semibold text-stone-500 hover:text-stone-800 transition px-2 py-1"
            >
              Pular
            </button>
            <button
              type="button"
              onClick={handleSendComment}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-amber-700 active:scale-95 transition disabled:opacity-50"
            >
              <Send className="size-3" />
              <span>{isSubmitting ? "Enviando..." : "Enviar Feedback"}</span>
            </button>
          </div>
        </div>
      )}

      {step === "done" && showThankYou && (
        <div className="py-2 text-center animate-in zoom-in-95 duration-200">
          <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-2">
            <Check className="size-5" />
          </div>
          <h4 className="text-xs font-bold text-stone-900">
            Muito obrigado pela avaliação!
          </h4>
          <p className="mt-1 text-[11px] text-stone-600">
            Desejamos muito sucesso na sua trajetória profissional com a {companyName}! ✨
          </p>
        </div>
      )}
    </aside>
  );
}

