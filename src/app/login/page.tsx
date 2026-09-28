import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type React from "react";

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
      : (empresa ?? await getDefaultCompanySlug());

  const [company, companies] = await Promise.all([
    slug ? getPublicCompanyBySlug(slug) : null,
    listPublicCompanies(),
  ]);

  return (
    <main
      className="flex min-h-screen bg-[#faf8f6]"
      style={
        company ? (brandCssVars(company) as React.CSSProperties) : undefined
      }
    >
      {/* Painel lateral da marca */}
      <aside
        className="hidden w-[520px] shrink-0 flex-col justify-between p-14 lg:flex"
        style={{
          background: company
            ? "linear-gradient(165deg, var(--brand-primary) 0%, var(--brand-deep) 100%)"
            : "#1c1917",
        }}
      >
        {company?.logoFullUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={company.logoFullUrl}
            alt={company.name}
            className="h-20 w-auto self-start object-contain"
            style={{ filter: "brightness(0) invert(1)" }}
          />
        ) : (
          <span className="text-sm font-bold text-white">
            {company ? company.name : "Triagem"}
          </span>
        )}

        <div>
          <h1 className="max-w-[400px] text-[30px] font-bold leading-tight text-white">
            {company ? "Painel de recrutamento" : "Console da plataforma"}
          </h1>
          <p className="mt-4 max-w-[360px] text-sm leading-6 text-white/65">
            {company
              ? `Vagas, candidatos e entrevistas da ${company.name}.`
              : "Cadastro de empresas, identidade visual e formulários dos clientes."}
          </p>
        </div>

        <span className="text-xs text-white/40">
          {company ? `${company.name} · feito com Triagem` : "Triagem"}
        </span>
      </aside>

      {/* Área direita */}
      <section className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px]">

          {/* Logo mobile */}
          {company && (
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              {company.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={company.logoUrl} alt="" className="size-9 object-contain" />
              )}
              <span className="text-base font-semibold text-[#1c1917]">{company.name}</span>
            </div>
          )}

          {/* CANDIDATO — seção principal (maior destaque) */}
          {companies.length > 0 && (
            <div className="mb-8">
              <h2 className="text-[22px] font-bold text-[#1c1917]">
                Procurando vagas?
              </h2>
              <p className="mt-1 text-sm text-[#78716c]">
                Escolha a empresa e veja as oportunidades abertas.
              </p>
              <ul className="mt-4 space-y-2">
                {companies.map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={`/${c.slug}/vagas`}
                      className="flex items-center gap-3 rounded-xl border border-[#ece8e3] bg-white px-3.5 py-3 transition-colors hover:border-[#d6d0c9] hover:bg-[#faf8f6]"
                    >
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold text-white"
                        style={{ background: c.primaryColor ?? "#7B1C3E" }}
                      >
                        {c.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.logoUrl} alt="" className="size-9 rounded-lg object-cover" />
                        ) : (
                          c.name.slice(0, 2).toUpperCase()
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold text-[#1c1917]">
                          {c.name}
                        </span>
                        {c.sector && (
                          <span className="block truncate text-[12px] text-[#a8a29e]">
                            {c.sector}
                          </span>
                        )}
                      </span>
                      {c._count.jobs > 0 && (
                        <span className="shrink-0 rounded-full bg-[#f0ece8] px-2.5 py-1 text-[12px] font-semibold text-[#78716c]">
                          {c._count.jobs} {c._count.jobs === 1 ? "vaga" : "vagas"}
                        </span>
                      )}
                      <span className="shrink-0 text-[#c4bfba]">›</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* EMPRESA — seção secundária (discreta) */}
          <details open className="group rounded-xl border border-[#ece8e3] bg-[#faf8f6]">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[12px] font-medium text-[#a8a29e] hover:text-[#78716c]">
              <span>Acesso para recrutadores e gestores</span>
              <span className="transition-transform group-open:rotate-180 text-[10px]">▼</span>
            </summary>
            <div className="border-t border-[#ece8e3] px-4 pb-4 pt-3">
              <p className="mb-4 text-[12px] text-[#a8a29e]">
                {company
                  ? `Painel de candidatos da ${company.name}.`
                  : "Gestores de RH e administradores da plataforma."}
              </p>
              <LoginForm branded={Boolean(company)} slug={company?.slug} />
            </div>
          </details>
        </div>
      </section>
    </main>
  );
}
