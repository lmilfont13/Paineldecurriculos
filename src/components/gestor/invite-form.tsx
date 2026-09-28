"use client";

import { useActionState, useTransition } from "react";

import {
  inviteManagerAction,
  removeManagerAction,
  updateProfileAction,
  type UserActionState,
} from "@/server/controllers/user.controller";

function Form() {
  const [state, action, pending] = useActionState<UserActionState, FormData>(
    inviteManagerAction,
    null
  );

  const success = state !== null && "ok" in state;

  return (
    <form action={action} className="mt-3 space-y-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="invite-name" className="text-[12px] font-medium text-[#71717a]">
          Nome completo
        </label>
        <input
          id="invite-name"
          name="name"
          type="text"
          required
          placeholder="Ex: Maria Silva"
          className="h-9 rounded-lg border border-[#e4e4e7] bg-white px-3 text-[13px] text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[#0a0a0a] focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="invite-email" className="text-[12px] font-medium text-[#71717a]">
          E-mail
        </label>
        <input
          id="invite-email"
          name="email"
          type="email"
          required
          placeholder="maria@suaempresa.com"
          className="h-9 rounded-lg border border-[#e4e4e7] bg-white px-3 text-[13px] text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[#0a0a0a] focus:outline-none"
        />
      </div>

      {"error" in (state ?? {}) && (
        <p className="text-[12px] text-red-600">{(state as { error: string }).error}</p>
      )}
      {success && (
        <p className="text-[12px] text-[#1f7a4d]">
          {"message" in state ? state.message : "Convite enviado."}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-9 rounded-2xl px-5 text-[13px] font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-foreground)" }}
      >
        {pending ? "Enviando convite…" : "Convidar"}
      </button>
    </form>
  );
}

function RemoveButton({ userId, isSelf }: { userId: string; isSelf: boolean }) {
  const [, startTransition] = useTransition();

  if (isSelf) return null;

  function handleRemove() {
    if (!confirm("Remover o acesso deste usuário?")) return;
    startTransition(async () => {
      await removeManagerAction(userId);
    });
  }

  return (
    <button
      type="button"
      onClick={handleRemove}
      className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-medium text-[#71717a] hover:bg-[#f4f4f5] hover:text-red-600"
    >
      Remover
    </button>
  );
}

function ProfileForm({ currentName, currentEmail }: { currentName: string | null; currentEmail: string }) {
  const [state, action, pending] = useActionState<UserActionState, FormData>(
    updateProfileAction,
    null
  );
  const success = state !== null && "ok" in state;

  return (
    <form action={action} className="mt-3 space-y-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="profile-name" className="text-[12px] font-medium text-[#71717a]">
          Nome completo
        </label>
        <input
          id="profile-name"
          name="name"
          type="text"
          required
          defaultValue={currentName ?? ""}
          placeholder="Seu nome"
          className="h-9 rounded-lg border border-[#e4e4e7] bg-white px-3 text-[13px] text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[#0a0a0a] focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="profile-email" className="text-[12px] font-medium text-[#71717a]">
          E-mail (usado para entrar no painel)
        </label>
        <input
          id="profile-email"
          name="email"
          type="email"
          required
          defaultValue={currentEmail}
          className="h-9 rounded-lg border border-[#e4e4e7] bg-white px-3 text-[13px] text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[#0a0a0a] focus:outline-none"
        />
      </div>

      {"error" in (state ?? {}) && (
        <p className="text-[12px] text-red-600">{(state as { error: string }).error}</p>
      )}
      {success && (
        <p className="text-[12px] text-[#1f7a4d]">
          {"message" in state ? state.message : "Salvo."}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-9 rounded-2xl px-5 text-[13px] font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-foreground)" }}
      >
        {pending ? "Salvando…" : "Salvar alterações"}
      </button>
    </form>
  );
}

export { Form as InviteForm, RemoveButton as RemoveManagerButton, ProfileForm };
