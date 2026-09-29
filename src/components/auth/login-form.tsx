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

  return (
    <form action={formAction} className="mt-5">
      <label
        htmlFor="email"
        className="block text-[11.5px] font-semibold"
        style={{ color: dark ? "#7e706e" : "#0a0a0a" }}
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
        className="mt-1.5 h-[42px] w-full rounded-lg border px-3.5 text-[13.5px] outline-none transition-colors focus:border-[#9e1802]"
        style={inputStyle}
      />

      <label
        htmlFor="password"
        className="mt-4 block text-[11.5px] font-semibold"
        style={{ color: dark ? "#7e706e" : "#0a0a0a" }}
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
        placeholder="••••••••"
        className="mt-1.5 h-[42px] w-full rounded-lg border px-3.5 text-[13.5px] outline-none transition-colors focus:border-[#9e1802]"
        style={inputStyle}
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
              className="mt-3 inline-flex h-9 items-center rounded-2xl px-5 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--brand-primary, #811201)" }}
            >
              Ver vagas e entrar
            </a>
          ) : (
            <a
              href="/login"
              className="mt-3 inline-flex h-9 items-center rounded-2xl px-5 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
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
        className="mt-4 h-11 w-full rounded-lg text-[14px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
        style={
          branded
            ? {
                backgroundColor: "var(--brand-primary, #811201)",
                color: "var(--brand-foreground, #ffffff)",
              }
            : {
                backgroundColor: dark ? "#811201" : "#0a0a0a",
                color: "#ffffff",
              }
        }
      >
        {pending ? "Entrando…" : "Entrar no painel"}
      </button>

      {branded && (
        <a
          href="/recuperar-senha"
          className="mt-3 inline-block text-[12px] transition-colors"
          style={{ color: dark ? "#3c3230" : "#71717a" }}
        >
          Esqueci minha senha
        </a>
      )}
    </form>
  );
}
