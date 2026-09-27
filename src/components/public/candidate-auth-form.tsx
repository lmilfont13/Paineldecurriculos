"use client";

import { useActionState, useState } from "react";

import {
  loginCandidateAction,
  signupCandidateAction,
  type CandidateAuthState,
} from "@/server/controllers/candidate.controller";

const inputClass =
  "h-10 w-full rounded-md border border-[#e4e4e7] bg-white px-3 text-sm text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[#0a0a0a] focus:outline-none";

/** CA1 · Criar conta / entrar como candidato, com a marca da empresa. */
export function CandidateAuthForm({
  next,
  initialMode = "signup",
}: {
  next: string;
  initialMode?: "signup" | "login";
}) {
  const [mode, setMode] = useState<"signup" | "login">(initialMode);
  const [signupState, signupAction, signupPending] = useActionState<
    CandidateAuthState,
    FormData
  >(signupCandidateAction, null);
  const [loginState, loginAction, loginPending] = useActionState<
    CandidateAuthState,
    FormData
  >(loginCandidateAction, null);

  const pending = signupPending || loginPending;
  const error = mode === "signup" ? signupState?.error : loginState?.error;

  return (
    <div className="rounded-3xl border border-[#e4e4e7] bg-white p-6 shadow-[0px_4px_6px_rgba(0,0,0,0.07)]">
      <div className="flex gap-1 rounded-lg bg-[#f4f4f5] p-1">
        {(
          [
            ["signup", "Criar conta"],
            ["login", "Entrar"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={
              "h-8 flex-1 rounded-md text-[13px] transition-colors " +
              (mode === value
                ? "bg-white font-medium text-[#0a0a0a] shadow-sm"
                : "text-[#71717a] hover:text-[#0a0a0a]")
            }
          >
            {label}
          </button>
        ))}
      </div>

      <form
        action={mode === "signup" ? signupAction : loginAction}
        className="mt-6 space-y-4"
      >
        <input type="hidden" name="next" value={next} />

        {mode === "signup" && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#0a0a0a]">
              Nome completo
            </span>
            <input
              name="name"
              required
              autoComplete="name"
              placeholder="Como você quer ser chamado(a)"
              className={inputClass}
            />
          </label>
        )}
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[#0a0a0a]">
            E-mail
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
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[#0a0a0a]">
            Senha
          </span>
          <input
            name="password"
            type="password"
            required
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            placeholder={mode === "signup" ? "Mínimo 8 caracteres" : "••••••••••"}
            className={inputClass}
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="h-11 w-full rounded-2xl text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{
            backgroundColor: "var(--brand-primary)",
            color: "var(--brand-foreground)",
          }}
        >
          {pending
            ? "Aguarde…"
            : mode === "signup"
              ? "Criar conta e continuar"
              : "Entrar e continuar"}
        </button>

        <p className="text-center text-xs text-[#a1a1aa]">
          Seus dados ficam salvos para as próximas candidaturas.
        </p>
        {mode === "login" && (
          <a
            href="/recuperar-senha"
            className="block text-center text-xs font-medium text-[#71717a] hover:text-[#0a0a0a] hover:underline"
          >
            Esqueci minha senha
          </a>
        )}
      </form>
    </div>
  );
}
