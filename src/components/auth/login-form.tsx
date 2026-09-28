"use client";

import { useActionState } from "react";

import { loginAction, type LoginState } from "@/server/controllers/auth.controller";

export function LoginForm({ branded, slug }: { branded: boolean; slug?: string }) {
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
        defaultValue="ana@technova.com"
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
        defaultValue="triagem123"
        placeholder="••••••••••"
        className="mt-1.5 h-10 w-full rounded-md border border-[#e4e4e7] bg-white px-3 text-sm text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[#0a0a0a] focus:outline-none"
      />

      {state?.error && !state.isCandidate && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {state.error}
        </p>
      )}

      {state?.isCandidate && (
        <div className="mt-4 rounded-xl border border-[#e4e4e7] bg-[#fafaf9] p-4 text-center">
          <p className="text-[13px] font-medium text-[#0a0a0a]">
            Essa conta é de candidato
          </p>
          <p className="mt-1 text-[12px] text-[#71717a]">
            O acesso de candidatos é pela página de vagas da empresa.
          </p>
          {slug ? (
            <a
              href={`/${slug}/vagas`}
              className="mt-3 inline-flex h-9 items-center rounded-2xl px-5 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              Ver vagas e entrar
            </a>
          ) : (
            <a
              href="/login"
              className="mt-3 inline-flex h-9 items-center rounded-2xl bg-[#0a0a0a] px-5 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
            >
              Ir para a página de vagas
            </a>
          )}
        </div>
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
        <a
          href="/recuperar-senha"
          className="mt-4 inline-block text-[13px] font-medium text-[#71717a] hover:text-[#0a0a0a] hover:underline"
        >
          Esqueci minha senha
        </a>
      )}
    </form>
  );
}
