"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { FolderOpen, Loader2, MessageCircle, RefreshCw } from "lucide-react";

import { CandidateAvatar } from "@/components/gestor/candidate-avatar";
import { MatchScore } from "@/components/gestor/talent-pool-card";
import { analyzeStandbyForJobAction } from "@/server/controllers/talent.controller";
import { whatsappInvite } from "@/server/models/standby.model";

export type StandbyPerson = {
  id: string;
  name: string;
  phone: string | null;
  aiProfile: string | null;
  aiLevel: string | null;
  photoUrl: string | null;
  originalJobTitle: string;
  folders: { id: string; name: string }[];
  score: number | null;
  reasoning: string | null;
  state: string;
};

/**
 * Hub da vaga · banco de talentos: quem está em stand-by com perfil parecido,
 * com a nota contra ESTA vaga e o convite pelo WhatsApp. Ninguém vira
 * candidato desta vaga sem se candidatar pelo link.
 */
export function StandbySection({
  jobId,
  jobTitle,
  minScore,
  isOpen,
  publicUrl,
  companyName,
  people,
  poolSize,
}: {
  jobId: string;
  jobTitle: string;
  minScore: number;
  isOpen: boolean;
  publicUrl: string;
  companyName: string;
  people: StandbyPerson[];
  poolSize: number;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function analyze() {
    setMessage(null);
    startTransition(async () => {
      const { analyzed } = await analyzeStandbyForJobAction(jobId);
      setMessage(
        analyzed > 0
          ? `${analyzed} ${analyzed === 1 ? "candidato conferido" : "candidatos conferidos"} com esta vaga.`
          : "Ninguém do banco de talentos tem perfil parecido com esta vaga."
      );
    });
  }

  const good = people.filter((p) => p.state === "DONE" && p.score !== null && p.score >= minScore).length;

  return (
    <section className="mt-4 rounded-xl border border-[#e4e4e7] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-[#0a0a0a]">
            <FolderOpen className="size-4 text-[#a1a1aa]" aria-hidden /> Banco de talentos em stand-by
          </h2>
          <p className="mt-0.5 text-[12px] text-[#71717a]">
            {poolSize === 0
              ? "Ninguém guardado ainda. Na tela de um candidato, use “Guardar em uma pasta”."
              : people.length === 0
                ? `${poolSize} ${poolSize === 1 ? "pessoa guardada" : "pessoas guardadas"}. Confira quem tem perfil parecido com esta vaga.`
                : `${good} de ${people.length} conferidos combinam com esta vaga (mínimo ${minScore}).`}
          </p>
        </div>
        {poolSize > 0 && (
          <button
            type="button"
            onClick={analyze}
            disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#e4e4e7] bg-white px-3 text-[12px] font-medium text-[#0a0a0a] hover:bg-[#fafafa] disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            {pending ? "Conferindo…" : people.length === 0 ? "Conferir banco de talentos" : "Conferir de novo"}
          </button>
        )}
      </div>

      {message && (
        <p className="mt-2 text-[11px] text-[#52525b]" role="status">
          {message}
        </p>
      )}

      {people.length > 0 && (
        <ul className="mt-4 divide-y divide-[#f4f4f5]">
          {people.map((p) => {
            const invite = isOpen
              ? whatsappInvite({ phone: p.phone, name: p.name, company: companyName, jobTitle, url: publicUrl })
              : null;
            return (
              <li key={p.id} className="flex flex-wrap items-start gap-3 py-3 sm:flex-nowrap">
                <CandidateAvatar
                  name={p.name}
                  photoUrl={p.photoUrl}
                  className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1c1917] text-[10px] font-bold text-white"
                />
                <div className="min-w-0 flex-1">
                  <Link href={`/candidaturas/${p.id}`} className="text-[13px] font-medium text-[#0a0a0a] hover:underline">
                    {p.name}
                  </Link>
                  <p className="truncate text-[11px] text-[#71717a]">
                    {[p.aiProfile, p.aiLevel].filter(Boolean).join(" · ")}
                    {p.aiProfile || p.aiLevel ? " · " : ""}se inscreveu em {p.originalJobTitle}
                    {p.folders[0] ? ` · pasta ${p.folders[0].name}` : ""}
                  </p>
                  {p.reasoning && <p className="mt-1 text-[12px] leading-5 text-[#52525b]">{p.reasoning}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <MatchScore match={{ score: p.score, state: p.state, minScore }} />
                  {invite && (
                    <a
                      href={invite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-[#1f7a4d] ring-1 ring-[#c6ecd6] hover:bg-[#e7f9f0]"
                    >
                      <MessageCircle className="size-3.5" /> Convidar
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {people.length > 0 && (
        <p className="mt-3 text-[11px] text-[#a1a1aa]">
          {isOpen
            ? "“Convidar” abre o WhatsApp com a mensagem e o link desta vaga. A pessoa só entra no funil quando se candidatar."
            : "Publique a vaga para poder convidar pelo WhatsApp."}
        </p>
      )}
    </section>
  );
}
