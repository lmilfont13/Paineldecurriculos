"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { askAboutCandidateAction, askAcrossCandidatesAction } from "@/server/controllers/application.controller";

type Mode = "one" | "all";
type Turn = {
  question: string;
  mode: Mode;
  answer: string | null;
  error: string | null;
  mentioned: { id: string; name: string }[];
  scope: string | null;
};

/**
 * Pergunta livre à IA. "Em todas as candidaturas" olha o banco inteiro da empresa
 * (ex.: tenho opções melhores para esta vaga?); "Sobre este candidato" olha só o
 * currículo dele. Só esclarece: não muda nota nem etapa.
 */
export function AskAiBox({ applicationId, jobId }: { applicationId?: string; jobId?: string }) {
  const [mode, setMode] = useState<Mode>(applicationId ? "one" : "all");
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, startTransition] = useTransition();

  function ask() {
    const q = question.trim();
    if (q.length < 3 || pending) return;
    setQuestion("");
    startTransition(async () => {
      let turn: Turn;
      if (mode === "one" && applicationId) {
        const r = await askAboutCandidateAction(applicationId, q);
        turn = { question: q, mode, answer: r.ok ? r.answer : null, error: r.ok ? null : r.error, mentioned: [], scope: null };
      } else {
        const r = await askAcrossCandidatesAction(jobId ?? null, q);
        turn = {
          question: q,
          mode,
          answer: r.ok ? r.answer : null,
          error: r.ok ? null : r.error,
          mentioned: r.ok ? r.mentioned : [],
          scope: r.ok ? `Li ${r.analyzed} de ${r.total} candidaturas ativas da empresa.` : null,
        };
      }
      setTurns((t) => [turn, ...t]);
    });
  }

  const tab = (value: Mode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      aria-pressed={mode === value}
      className={
        "h-8 rounded-lg px-3 text-[12px] font-medium " +
        (mode === value ? "bg-[#0a0a0a] text-white" : "bg-[#f4f4f5] text-[#57534e] hover:bg-[#ebebed]")
      }
    >
      {label}
    </button>
  );

  return (
    <div>
      <h2 className="text-sm font-semibold text-[#0a0a0a]">Pergunte à IA</h2>
      <p className="mt-0.5 text-[11px] text-[#a1a1aa]">
        {mode === "all"
          ? "Ela busca em todas as candidaturas da empresa para responder. Não muda a nota nem a etapa."
          : "Ela responde com base no currículo e nas respostas deste candidato. Não muda a nota nem a etapa."}
      </p>

      {applicationId && (
        <div className="mt-3 flex flex-wrap gap-2">
          {tab("one", "Sobre este candidato")}
          {tab("all", "Em todas as candidaturas")}
        </div>
      )}

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
          placeholder={
            mode === "all"
              ? "Ex.: Tenho opções melhores para esta vaga entre os outros candidatos?"
              : "Ex.: Ele já trabalhou com atendimento ao público? Por quanto tempo?"
          }
          className="h-9 min-w-0 flex-1 rounded-lg border border-[#e4e4e7] bg-white px-3 text-[13px] text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[#0a0a0a] focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || question.trim().length < 3}
          className="h-9 shrink-0 rounded-xl px-4 text-[12px] font-semibold disabled:opacity-50"
          style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-foreground)" }}
        >
          {pending ? "Buscando…" : "Perguntar"}
        </button>
      </form>

      {turns.length > 0 && (
        <ul className="mt-4 space-y-3">
          {turns.map((t, i) => (
            <li key={i} className="rounded-xl bg-[#fafaf9] p-3.5 text-[13px] leading-5">
              <p className="font-medium text-[#0a0a0a]">
                <span className="mr-2 rounded-full bg-[#ececea] px-2 py-0.5 text-[10px] font-medium text-[#71717a]">
                  {t.mode === "all" ? "todas as candidaturas" : "este candidato"}
                </span>
                {t.question}
              </p>
              {t.answer && <p className="mt-1.5 whitespace-pre-line text-[#44403c]">{t.answer}</p>}
              {t.mentioned.length > 0 && (
                <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]">
                  <span className="text-[#a1a1aa]">Abrir:</span>
                  {t.mentioned.map((m) => (
                    <Link
                      key={m.id}
                      href={`/candidaturas/${m.id}`}
                      className="rounded-full bg-white px-2.5 py-1 font-medium text-[#0a0a0a] ring-1 ring-[#e4e4e7] hover:ring-[#0a0a0a]"
                    >
                      {m.name}
                    </Link>
                  ))}
                </p>
              )}
              {t.scope && <p className="mt-1.5 text-[11px] text-[#a1a1aa]">{t.scope}</p>}
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
