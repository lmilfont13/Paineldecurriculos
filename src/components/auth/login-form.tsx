"use client";

import { useActionState } from "react";

import { loginAction, type LoginState } from "@/server/controllers/auth.controller";

export function LoginForm({
  branded,
  slug,
  dark,
}: {
  branded: boolean;
  slug?: string;
  dark?: boolean;
}) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    null
  );

  const inputStyle = dark
    ? {
        background: "#1d1614",
        border: "1px solid rgba(255,255,255,0.13)",
        color: "#ede8e5",
      }
    : {
        borderColor: "#e4e4e7",
        background: "white",
        color: "#0a0a0a",
      };

  const text = dark
    ? { label: "#7e706e", input: "#ede8e5", placeholder: "#5c4f4c" }
    : { label: "#57534e", input: "#1c1917", placeholder: "#b8b2ac" };

  return (
    <form action={formAction} className="mt-5">
      <label
        htmlFor="email"
        className="block text-[11.5px] font-semibold"
        style={{ color: text.label }}
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
        className="mt-1.5 h-11 w-full rounded-xl border px-3.5 text-[13.5px] outline-none transition-all focus:border-[var(--brand-primary,#811201)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--brand-primary,#811201)_10%,transparent)]"
        style={{ ...inputStyle, color: text.input }}
      />

      <label
        htmlFor="password"
        className="mt-4 block text-[11.5px] font-semibold"
        style={{ color: text.label }}
      >
        Senha
      </label>
      <input
        id="password"
        name="password"
        type="password"
        required
        autoComplete="current-password"
        placeholder="Sua senha"
        className="mt-1.5 h-11 w-full rounded-xl border px-3.5 text-[13.5px] outline-none transition-all focus:border-[var(--brand-primary,#811201)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--brand-primary,#811201)_10%,transparent)]"
        style={{ ...inputStyle, color: text.input }}
      />

      {state?.error && !state.isCandidate && (
        <p
          role="alert"
          className="mt-4 text-[13px]"
          style={{ color: dark ? "#f87171" : "#dc2626" }}
        >
          {state.error}
        </p>
      )}

      {state?.isCandidate && (
        <div
          className="mt-4 rounded-xl p-4 text-center"
          style={
            dark
              ? {
                  background: "#1d1614",
                  border: "1px solid rgba(255,255,255,0.1)",
                }
              : {
                  border: "1px solid #e4e4e7",
                  background: "#fafaf9",
                }
          }
        >
          <p
            className="text-[13px] font-medium"
            style={{ color: dark ? "#ede8e5" : "#0a0a0a" }}
          >
            Essa conta é de candidato
          </p>
          <p
            className="mt-1 text-[12px]"
            style={{ color: dark ? "#7e706e" : "#71717a" }}
          >
            O acesso de candidatos é pela página de vagas da empresa.
          </p>
          {slug ? (
            <a
              href={`/${slug}/vagas`}
              className="mt-3 inline-flex h-9 items-center rounded-xl px-5 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--brand-primary, #811201)" }}
            >
              Ver vagas e entrar
            </a>
          ) : (
            <a
              href="/login"
              className="mt-3 inline-flex h-9 items-center rounded-xl px-5 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: dark ? "#811201" : "#0a0a0a" }}
            >
              Ir para a página de vagas
            </a>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 h-11 w-full rounded-xl text-[14px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:translate-y-0 disabled:opacity-60"
        style={{
          backgroundColor: branded
            ? "var(--brand-primary, #811201)"
            : dark
              ? "#811201"
              : "#1c1917",
        }}
      >
        {pending ? "Entrando…" : "Entrar no painel"}
      </button>

      {branded && (
        <a
          href="/recuperar-senha"
          className="mt-4 inline-block text-[12px] transition-colors hover:underline"
          style={{ color: dark ? "#3c3230" : "#78716c" }}
        >
          Esqueci minha senha
        </a>
      )}
    </form>
  );
}
