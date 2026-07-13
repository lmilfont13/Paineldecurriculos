"use client";

import { useActionState } from "react";

import {
  forgotPasswordAction,
  resetPasswordAction,
  type PasswordFlowState,
} from "@/server/controllers/auth.controller";

const inputClass =
  "h-10 w-full rounded-md border border-[#e4e4e7] bg-white px-3 text-sm text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[#0a0a0a] focus:outline-none";
const buttonClass =
  "h-11 w-full rounded-2xl bg-[#0a0a0a] text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60";

/** CA7/G13 · Pedir o link de recuperação. */
export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<PasswordFlowState, FormData>(
    forgotPasswordAction,
    null
  );

  if (state?.done) {
    return (
      <p className="rounded-md bg-[#f4f4f5] px-4 py-3 text-sm text-[#0a0a0a]">
        Se este e-mail tiver cadastro, você vai receber um link para redefinir
        a senha. Confira também a caixa de spam.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-[#0a0a0a]">
          E-mail da sua conta
        </span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="voce@email.com"
          className={inputClass}
        />
      </label>
      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Enviando…" : "Enviar link de recuperação"}
      </button>
    </form>
  );
}

/** Definir a nova senha (link do e-mail chega com ?code=…). */
export function ResetPasswordForm({ code }: { code: string }) {
  const [state, formAction, pending] = useActionState<PasswordFlowState, FormData>(
    resetPasswordAction,
    null
  );

  if (state?.done) {
    return (
      <div className="space-y-4">
        <p className="rounded-md bg-[#e4f6ec] px-4 py-3 text-sm text-[#1f7a4d]">
          Senha redefinida com sucesso. Você já está conectado(a).
        </p>
        <a
          href="/"
          className="block text-center text-sm font-medium text-[#0a0a0a] hover:underline"
        >
          Continuar ›
        </a>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="code" value={code} />
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-[#0a0a0a]">
          Nova senha
        </span>
        <input
          name="password"
          type="password"
          required
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          className={inputClass}
        />
      </label>
      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Salvando…" : "Redefinir senha"}
      </button>
    </form>
  );
}
