"use client";

import { useTransition } from "react";
import { Pencil, Trash2, X } from "lucide-react";

import {
  deleteTalentFolderAction,
  removeFromTalentFolderAction,
  renameTalentFolderAction,
} from "@/server/controllers/talent.controller";

/** Renomear e apagar pasta (na lista do banco de talentos). */
export function TalentFolderActions({ folderId, name }: { folderId: string; name: string }) {
  const [pending, startTransition] = useTransition();

  function rename() {
    const next = window.prompt("Novo nome da pasta", name);
    if (!next || next.trim() === name) return;
    startTransition(async () => {
      const result = await renameTalentFolderAction(folderId, next);
      if (!result.ok) window.alert(result.error);
    });
  }

  function remove() {
    if (!window.confirm(`Apagar a pasta “${name}”? Os candidatos continuam no sistema; só a pasta sai.`)) return;
    startTransition(async () => {
      await deleteTalentFolderAction(folderId);
    });
  }

  return (
    <span className="flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        onClick={rename}
        disabled={pending}
        aria-label={`Renomear a pasta ${name}`}
        className="rounded-md p-1.5 text-[#a1a1aa] hover:bg-[#f4f4f5] hover:text-[#0a0a0a] disabled:opacity-50"
      >
        <Pencil className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        aria-label={`Apagar a pasta ${name}`}
        className="rounded-md p-1.5 text-[#a1a1aa] hover:bg-[#fef2f2] hover:text-[#c23b3b] disabled:opacity-50"
      >
        <Trash2 className="size-3.5" />
      </button>
    </span>
  );
}

/** Tirar um candidato da pasta (a candidatura continua no sistema). */
export function RemoveFromFolderButton({
  folderId,
  applicationId,
  name,
}: {
  folderId: string;
  applicationId: string;
  name: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => removeFromTalentFolderAction(folderId, applicationId))}
      aria-label={`Tirar ${name} desta pasta`}
      title="Tirar desta pasta"
      className="rounded-md p-1.5 text-[#a1a1aa] hover:bg-[#f4f4f5] hover:text-[#0a0a0a] disabled:opacity-50"
    >
      <X className="size-4" />
    </button>
  );
}
