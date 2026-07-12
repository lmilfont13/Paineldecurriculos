"use client";

import { useActionState } from "react";

import { loginAction, type LoginState } from "@/server/controllers/auth.controller";

export function LoginForm({ branded }: { branded: boolean }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    null
  );

  return (
    <form action={formAction} className="mt-8">
      <label
        htmlFor="email"
        className="block text-sm font-medium text-[#0a0a0a]"
      >
        E-mail
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="voce@empresa.com"
        className="mt-1.5 h-10 w-full rounded-md border border-[#e4e4e7] bg-white px-3 text-sm text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[#0a0a0a] focus:outline-none"
      />

      <label
        htmlFor="password"
        className="mt-5 block text-sm font-medium text-[#0a0a0a]"
      >
        Senha
      </label>
      <input
        id="password"
        name="password"
        type="password"
        required
        autoComplete="current-password"
        placeholder="••••••••••"
        className="mt-1.5 h-10 w-full rounded-md border border-[#e4e4e7] bg-white px-3 text-sm text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[#0a0a0a] focus:outline-none"
      />

      {state?.error && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-6 h-11 w-full rounded-2xl text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
        style={
          branded
            ? {
                backgroundColor: "var(--brand-primary)",
                color: "var(--brand-foreground)",
              }
            : { backgroundColor: "#0a0a0a", color: "#ffffff" }
        }
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>

      {branded && (
        <p className="mt-4 text-[13px] font-medium text-[#71717a]">
          Esqueci minha senha
        </p>
      )}
    </form>
  );
}
