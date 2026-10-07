"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { FolderOpen, FolderPlus, Loader2 } from "lucide-react";

import { JobFromFolderButton } from "@/components/gestor/job-from-folder-button";
import { saveToTalentFolderAction } from "@/server/controllers/talent.controller";
import { sameFolderName, type TalentFolderSummary } from "@/server/models/talent.model";

/**
 * Banco de talentos no detalhe do candidato. Quando a nota fica abaixo do
 * mínimo da vaga, o card vem em destaque: não serve para esta vaga, mas pode
 * servir para outra. A pasta nova já vem com o perfil resumido pela IA.
 */
export function TalentPoolCard({
  applicationId,
  folders,
  inFolders,
  suggestedName,
  level,
  highlight,
}: {
  applicationId: string;
  folders: TalentFolderSummary[];
  inFolders: string[];
  suggestedName: string;
  level: string | null;
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
      setMessage(`Guardado na pasta “${result.folderName}”.`);
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
          Ficou abaixo do mínimo desta vaga. Se o perfil é bom para outras vagas, guarde numa pasta de potenciais candidatos e, se fizer sentido, abra uma vaga para esse perfil.
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
              <div className="mt-2">
                <JobFromFolderButton folderId={f.id} jobId={f.jobId} variant="subtle" />
              </div>
            </li>
          ))}
        </ul>
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
              Guardar
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
        Não muda a etapa e o candidato não é avisado.
      </p>
    </section>
  );
}
