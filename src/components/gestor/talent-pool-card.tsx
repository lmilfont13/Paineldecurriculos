"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { FolderOpen, FolderPlus, Loader2, RefreshCw } from "lucide-react";

import {
  analyzeStandbyForApplicationAction,
  saveToTalentFolderAction,
} from "@/server/controllers/talent.controller";
import { sameFolderName, type TalentFolderSummary } from "@/server/models/talent.model";

export type StandbyMatch = {
  jobId: string;
  jobTitle: string;
  minScore: number;
  score: number | null;
  state: string;
};

/** Nota do stand-by: verde se passa do mínimo da vaga, cinza se não. */
export function MatchScore({ match }: { match: { score: number | null; state: string; minScore: number } }) {
  if (match.state !== "DONE" || match.score === null) {
    const label =
      match.state === "FAILED" ? "falhou" : match.state === "NO_RESUME" ? "sem material" : "analisando…";
    return <span className="shrink-0 text-[11px] text-[#a1a1aa]">{label}</span>;
  }
  const meets = match.score >= match.minScore;
  return (
    <span
      className={
        "shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold " +
        (meets ? "bg-[#e4f6ec] text-[#1f7a4d]" : "bg-[#f4f4f5] text-[#71717a]")
      }
    >
      {match.score}
      {meets ? " · combina" : ""}
    </span>
  );
}

/**
 * Banco de talentos no detalhe do candidato. Quando a nota fica abaixo do
 * mínimo da vaga, o card vem em destaque: não serve para esta vaga, mas pode
 * servir para outra. Guardado, o candidato fica em stand-by e a IA o confere
 * com as vagas abertas parecidas (e com as próximas que forem publicadas).
 */
export function TalentPoolCard({
  applicationId,
  folders,
  inFolders,
  suggestedName,
  level,
  matches,
  highlight,
}: {
  applicationId: string;
  folders: TalentFolderSummary[];
  inFolders: string[];
  suggestedName: string;
  level: string | null;
  matches: StandbyMatch[];
  highlight: boolean;
}) {
  const saved = folders.filter((f) => inFolders.includes(f.id));
  const available = folders.filter((f) => !inFolders.includes(f.id));
  const [open, setOpen] = useState(false);
  // Já existe pasta com o perfil sugerido? Ela vem marcada; senão, pasta nova.
  const matching = suggestedName ? available.find((f) => sameFolderName(f.name, suggestedName)) : undefined;
  const [choice, setChoice] = useState<string>(
    matching?.id ?? (suggestedName || available.length === 0 ? "new" : available[0].id)
  );
  const [newName, setNewName] = useState(suggestedName);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveToTalentFolderAction(
        applicationId,
        choice === "new" ? { newName } : { folderId: choice }
      );
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setOpen(false);
      setMessage(
        result.analyzed > 0
          ? `Guardado em “${result.folderName}” e conferido com ${result.analyzed} ${result.analyzed === 1 ? "vaga aberta" : "vagas abertas"}.`
          : `Guardado em “${result.folderName}”. Fica em stand-by até abrir uma vaga parecida.`
      );
    });
  }

  function recheck() {
    setMessage(null);
    startTransition(async () => {
      const { analyzed } = await analyzeStandbyForApplicationAction(applicationId);
      setMessage(
        analyzed > 0
          ? `Conferido com ${analyzed} ${analyzed === 1 ? "vaga aberta" : "vagas abertas"}.`
          : "Nenhuma outra vaga aberta para conferir agora."
      );
    });
  }

  return (
    <section
      className={
        "rounded-2xl border p-5 shadow-sm " +
        (highlight && saved.length === 0 ? "border-[#fde68a] bg-[#fffbeb]" : "border-[#e4e4e7] bg-white")
      }
    >
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.6px] text-[#a1a1aa]">
        <FolderOpen className="size-3.5" aria-hidden /> Banco de talentos
      </p>

      {suggestedName && (
        <p className="mt-3 text-[12px] text-[#52525b]">
          Perfil do currículo: <strong className="font-semibold text-[#0a0a0a]">{suggestedName}</strong>
          {level ? ` · ${level}` : ""}
        </p>
      )}

      {highlight && saved.length === 0 && !open && (
        <p className="mt-2 text-[12px] leading-5 text-[#78350f]">
          Ficou abaixo do mínimo desta vaga. Se o perfil é bom para outras vagas, guarde numa pasta: ele fica em stand-by e a IA confere com as vagas parecidas.
        </p>
      )}

      {saved.length > 0 && (
        <ul className="mt-3 space-y-2.5">
          {saved.map((f) => (
            <li key={f.id} className="rounded-xl bg-[#fafaf9] px-3 py-2.5 ring-1 ring-[#f4f4f5]">
              <Link
                href={`/talentos/${f.id}`}
                className="block truncate text-[12px] font-semibold text-[#0a0a0a] hover:underline"
              >
                {f.name}
              </Link>
              <span className="text-[11px] text-[#a1a1aa]">
                {f.count} {f.count === 1 ? "candidato" : "candidatos"} nesta pasta
              </span>
            </li>
          ))}
        </ul>
      )}

      {saved.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-[#0a0a0a]">
              Em stand-by · vagas abertas parecidas
            </p>
            <button
              type="button"
              onClick={recheck}
              disabled={pending}
              aria-label="Conferir de novo com as vagas abertas"
              title="Conferir de novo com as vagas abertas"
              className="rounded-md p-1 text-[#a1a1aa] hover:bg-[#f4f4f5] hover:text-[#0a0a0a] disabled:opacity-50"
            >
              <RefreshCw className={"size-3.5" + (pending ? " animate-spin" : "")} />
            </button>
          </div>
          {matches.length === 0 ? (
            <p className="mt-1.5 text-[11px] leading-4 text-[#71717a]">
              Nenhuma vaga aberta parecida ainda. Quando você publicar uma vaga, a IA confere quem está em stand-by.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {matches.map((m) => (
                <li key={m.jobId} className="flex items-center justify-between gap-2 text-[12px]">
                  <Link href={`/vagas/${m.jobId}`} className="min-w-0 truncate text-[#0a0a0a] hover:underline">
                    {m.jobTitle}
                  </Link>
                  <MatchScore match={m} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {open ? (
        <div className="mt-4 space-y-2">
          {available.map((f) => (
            <label key={f.id} className="flex cursor-pointer items-center gap-2 text-[12px] text-[#0a0a0a]">
              <input
                type="radio"
                name="talent-folder"
                checked={choice === f.id}
                onChange={() => setChoice(f.id)}
                className="accent-[var(--brand-primary)]"
              />
              <span className="flex-1">{f.name}</span>
              <span className="text-[10px] text-[#a1a1aa]">{f.count}</span>
            </label>
          ))}
          <label className="flex cursor-pointer items-center gap-2 text-[12px] text-[#0a0a0a]">
            <input
              type="radio"
              name="talent-folder"
              checked={choice === "new"}
              onChange={() => setChoice("new")}
              className="accent-[var(--brand-primary)]"
            />
            Nova pasta
          </label>
          {choice === "new" && (
            <div>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex.: Motorista e entregador"
                maxLength={60}
                autoFocus
                className="h-9 w-full rounded-lg border border-[#e4e4e7] bg-white px-3 text-[12px] outline-none focus:border-[#a1a1aa]"
              />
              {suggestedName && (
                <p className="mt-1 text-[10px] text-[#a1a1aa]">Nome sugerido pelo perfil do currículo. Pode mudar.</p>
              )}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={save}
              disabled={pending || (choice === "new" && !newName.trim())}
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl text-[12px] font-semibold disabled:opacity-50"
              style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-foreground)" }}
            >
              {pending && <Loader2 className="size-3.5 animate-spin" />}
              {pending ? "Guardando e analisando…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-9 rounded-xl px-3 text-[12px] text-[#52525b] hover:bg-[#f4f4f5]"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setMessage(null);
          }}
          className="mt-4 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-[#e4e4e7] bg-white text-[12px] font-semibold text-[#0a0a0a] hover:bg-[#fafafa]"
        >
          <FolderPlus className="size-3.5" />
          {saved.length > 0 ? "Guardar em outra pasta" : "Guardar em uma pasta"}
        </button>
      )}

      {message && (
        <p className="mt-2 text-[11px] text-[#52525b]" role="status">
          {message}
        </p>
      )}
      <p className="mt-2 text-[10px] leading-4 text-[#a1a1aa]">
        Não muda a etapa nem a nota desta vaga, e o candidato não é avisado.
      </p>
    </section>
  );
}
