"use client";

import { useState, useTransition } from "react";

import { askAboutCandidateAction } from "@/server/controllers/application.controller";

type Turn = { question: string; answer: string | null; error: string | null };

/** Pergunta livre à IA sobre o candidato. Só esclarece: não muda nota nem etapa. */
export function AskAiBox({ applicationId }: { applicationId: string }) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, startTransition] = useTransition();

  function ask() {
    const q = question.trim();
    if (q.length < 3 || pending) return;
    setQuestion("");
    startTransition(async () => {
      const result = await askAboutCandidateAction(applicationId, q);
      setTurns((t) => [
        { question: q, answer: result.ok ? result.answer : null, error: result.ok ? null : result.error },
        ...t,
      ]);
    });
  }

  return (
    <div>
      <h2 className="text-sm font-semibold text-[#0a0a0a]">Pergunte à IA sobre este candidato</h2>
      <p className="mt-0.5 text-[11px] text-[#a1a1aa]">
        Ela responde com base no currículo e nas respostas. Não muda a nota nem a etapa.
      </p>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={500}
          placeholder="Ex.: Ele já trabalhou com atendimento ao público? Por quanto tempo?"
          className="h-9 min-w-0 flex-1 rounded-lg border border-[#e4e4e7] bg-white px-3 text-[13px] text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[#0a0a0a] focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || question.trim().length < 3}
          className="h-9 shrink-0 rounded-xl px-4 text-[12px] font-semibold disabled:opacity-50"
          style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-foreground)" }}
        >
          {pending ? "Pensando…" : "Perguntar"}
        </button>
      </form>

      {turns.length > 0 && (
        <ul className="mt-4 space-y-3">
          {turns.map((t, i) => (
            <li key={i} className="rounded-xl bg-[#fafaf9] p-3.5 text-[13px] leading-5">
              <p className="font-medium text-[#0a0a0a]">{t.question}</p>
              {t.answer && <p className="mt-1.5 whitespace-pre-line text-[#44403c]">{t.answer}</p>}
              {t.error && (
                <p role="alert" className="mt-1.5 text-[#c23b3b]">
                  {t.error}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
