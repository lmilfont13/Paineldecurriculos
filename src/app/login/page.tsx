import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type React from "react";

import { GraphCanvas } from "@/components/auth/graph-canvas";
import { LoginForm } from "@/components/auth/login-form";
import { brandCssVars } from "@/server/models/company.model";
import {
  getDefaultCompanySlug,
  getPublicCompanyBySlug,
  listPublicCompanies,
} from "@/server/services/company.service";
import { getSessionUser, isAdmin } from "@/server/services/auth.service";

export const metadata: Metadata = { title: "Entrar" };

/**
 * Login unificado. Sem parâmetros → bifurcação candidato/equipe.
 * Com `?empresa=<slug>` → login da equipe com marca da empresa.
 * Com `?empresa=plataforma` → console admin neutro.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect(isAdmin(user) ? "/admin/empresas" : "/painel");

  const { empresa } = await searchParams;

  const slug =
    empresa === "plataforma"
      ? null
      : (empresa ?? (await getDefaultCompanySlug()));

  const [company, companies] = await Promise.all([
    slug ? getPublicCompanyBySlug(slug) : null,
    listPublicCompanies(),
  ]);

  return (
    <main
      className="flex min-h-screen"
      style={{
        background: "#0c0807",
        color: "#ede8e5",
        ...(company ? (brandCssVars(company) as React.CSSProperties) : {}),
      }}
    >
      {/* ── LEFT: visual stage (desktop only) ── */}
      <div
        className="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex"
        style={{ flex: "0 0 58%" }}
      >
        {/* Warm radial flush behind headline */}
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 right-0"
          style={{
            height: "55%",
            background:
              "radial-gradient(ellipse at 30% 110%, rgba(129,18,1,0.09) 0%, transparent 65%)",
          }}
        />
        {/* Right edge fade */}
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-0 top-0"
          style={{
            width: 120,
            background: "linear-gradient(to right, transparent, #0c0807)",
          }}
        />

        <GraphCanvas />

        {/* Wordmark */}
        <span
          className="relative z-10 flex items-center gap-2 text-[13px] font-semibold"
          style={{ color: "#7e706e" }}
        >
          <span
            aria-hidden
            className="inline-block size-[7px] shrink-0 rounded-full"
            style={{ background: "#9e1802" }}
          />
          Triagem
        </span>

        {/* Headline */}
        <div className="relative z-10 max-w-[480px]">
          <h1
            className="mb-3 text-balance leading-[1.08] tracking-[-0.025em]"
            style={{ fontSize: "clamp(28px,3.5vw,50px)", fontWeight: 700 }}
          >
            {company
              ? "Encontre quem vai fazer a diferença."
              : "Console da plataforma Triagem."}
          </h1>
          <p className="text-[15px] leading-relaxed" style={{ color: "#7e706e" }}>
            {company
              ? `Painel de recrutamento da ${company.name} — triagem, entrevistas e decisões num único lugar.`
              : "Cadastro de empresas, identidade visual e formulários dos clientes."}
          </p>
        </div>
      </div>

      {/* ── RIGHT: action panel ── */}
      <section
        className="flex flex-1 flex-col justify-center overflow-y-auto px-6 py-12 sm:px-12"
        style={{
          background: "#141010",
          borderLeft: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div className="mx-auto w-full max-w-[360px]">

          {/* Mobile wordmark */}
          <span
            className="mb-8 flex items-center gap-2 text-[13px] font-semibold lg:hidden"
            style={{ color: "#7e706e" }}
          >
            <span
              aria-hidden
              className="inline-block size-[7px] shrink-0 rounded-full"
              style={{ background: "#9e1802" }}
            />
            Triagem
          </span>

          {/* Candidate path */}
          {companies.length > 0 && (
            <div className="mb-7">
              <p
                className="mb-1 text-[17px] font-bold"
                style={{ color: "#ede8e5" }}
              >
                Procurando vagas?
              </p>
              <p className="mb-4 text-[13px]" style={{ color: "#7e706e" }}>
                Veja as oportunidades abertas e candidate-se em minutos.
              </p>
              <ul className="flex flex-col gap-1.5">
                {companies.map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={`/${c.slug}/vagas`}
                      className="flex items-center gap-3 rounded-[10px] px-3.5 py-3 transition-colors hover:bg-[#1d1614]"
                      style={{
                        border: "1px solid rgba(255,255,255,0.12)",
                        color: "inherit",
                        textDecoration: "none",
                      }}
                    >
                      <span
                        className="flex size-[34px] shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white"
                        style={{ background: c.primaryColor ?? "#811201" }}
                      >
                        {c.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.logoUrl}
                            alt=""
                            className="size-[34px] rounded-lg object-cover"
                          />
                        ) : (
                          c.name.slice(0, 2).toUpperCase()
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className="block truncate text-[13.5px] font-semibold"
                          style={{ color: "#ede8e5" }}
                        >
                          {c.name}
                        </span>
                        {c.sector && (
                          <span
                            className="block truncate text-[11.5px]"
                            style={{ color: "#7e706e" }}
                          >
                            {c.sector}
                          </span>
                        )}
                      </span>
                      {c._count.jobs > 0 && (
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                          style={{
                            background: "rgba(129,18,1,0.16)",
                            color: "#c97065",
                            border: "1px solid rgba(129,18,1,0.22)",
                          }}
                        >
                          {c._count.jobs}{" "}
                          {c._count.jobs === 1 ? "vaga" : "vagas"}
                        </span>
                      )}
                      <span
                        className="shrink-0 text-[18px] leading-none"
                        style={{ color: "#3c3230" }}
                      >
                        ›
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Divider */}
          <div className="mb-6 flex items-center gap-2.5">
            <span
              className="h-px flex-1"
              style={{ background: "rgba(255,255,255,0.07)" }}
            />
            <span
              className="text-[11px]"
              style={{ color: "#3c3230", letterSpacing: "0.05em" }}
            >
              Acesso ao painel
            </span>
            <span
              className="h-px flex-1"
              style={{ background: "rgba(255,255,255,0.07)" }}
            />
          </div>

          {/* Manager login */}
          <p className="mb-1 text-[17px] font-bold" style={{ color: "#ede8e5" }}>
            {empresa === "plataforma" ? "Console admin" : "Gestor ou admin"}
          </p>
          <p className="text-[13px]" style={{ color: "#7e706e" }}>
            {company
              ? `Painel de candidatos da ${company.name}.`
              : "Gestores de RH e administradores da plataforma."}
          </p>

          <LoginForm branded={Boolean(company)} slug={company?.slug} dark />

          <a
            href="/login?empresa=plataforma"
            className="mt-8 block text-[11px] transition-colors hover:text-[#7e706e]"
            style={{ color: "#3c3230" }}
          >
            Console da plataforma
          </a>
        </div>
      </section>
    </main>
  );
}
