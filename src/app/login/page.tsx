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
      className="min-h-screen bg-[#0b0909] text-[#f5f2ef]"
      style={{
        ...(company ? (brandCssVars(company) as React.CSSProperties) : {}),
      }}
    >
      <div className="grid min-h-screen lg:grid-cols-[1.12fr_0.88fr]">
        <section className="relative hidden overflow-hidden border-r border-white/[0.06] lg:flex">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.07),transparent_34%),radial-gradient(circle_at_72%_80%,rgba(129,18,1,0.18),transparent_42%)]" />
          <div className="relative flex w-full flex-col justify-between p-12 xl:p-16">
            <div>
              <div className="flex items-center gap-3">
                <span
                  className="flex size-10 items-center justify-center rounded-xl text-xs font-bold text-white"
                  style={{ backgroundColor: "var(--brand-primary, #811201)" }}
                >
                  T
                </span>
                <div>
                  <p className="text-sm font-semibold tracking-wide">Triagem</p>
                  <p className="text-[11px] text-white/40">Recrutamento inteligente</p>
                </div>
              </div>

              <div className="mt-20 max-w-[600px]">
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.2em]"
                  style={{ color: "var(--brand-secondary, #c9a9a2)" }}
                >
                  {company ? company.name : "Plataforma"}
                </p>
                <h1 className="mt-4 text-[44px] font-semibold leading-[1.04] tracking-[-1.6px] text-white xl:text-[58px]">
                  {company
                    ? "Encontre os talentos certos para o seu time."
                    : "Recrutamento mais claro. Decisões melhores."}
                </h1>
                <p className="mt-6 max-w-[540px] text-[16px] leading-7 text-white/55">
                  {company
                    ? `Organize vagas, avalie candidatos e tome decisões com mais contexto.`
                    : "Uma plataforma para organizar vagas, candidatos e o processo de decisão da sua equipe."}
                </p>
              </div>
            </div>

            <div className="grid max-w-[600px] gap-3 sm:grid-cols-3">
              {[
                ["01", "Vagas", "Organize oportunidades e critérios."],
                ["02", "Triagem", "Priorize candidatos com contexto."],
                ["03", "Decisão", "Mantenha o controle na mão do gestor."],
              ].map(([number, title, description]) => (
                <div
                  key={number}
                  className="rounded-2xl border border-white/[0.11] bg-white/[0.035] p-4 transition-colors hover:bg-white/[0.05]"
                >
                  <span className="text-[10px] font-semibold tracking-[0.16em] text-white/30">
                    {number}
                  </span>
                  <p className="mt-4 text-[13px] font-semibold text-white/85">
                    {title}
                  </p>
                  <p className="mt-1.5 text-[11px] leading-5 text-white/40">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center bg-[#f7f5f2] px-5 py-10 text-[#1c1917] sm:px-8">
          <div className="w-full max-w-[380px]">
            <div className="mb-8 lg:hidden">
              <p className="text-sm font-semibold">Triagem</p>
              <p className="mt-1 text-xs text-[#8a847e]">Recrutamento inteligente</p>
            </div>

            <div className="rounded-[26px] border border-[#e7e1db] bg-white p-6 shadow-[0_24px_70px_rgba(28,25,23,0.09)] sm:p-7">
              {companies.length > 0 && (
                <div className="mb-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#aaa39c]">
                    Para candidatos
                  </p>
                  <h2 className="mt-2 text-xl font-semibold tracking-[-0.3px]">
                    Encontre uma vaga
                  </h2>
                  <p className="mt-1.5 text-[13px] leading-5 text-[#78716c]">
                    Veja oportunidades abertas e acompanhe suas candidaturas.
                  </p>

                  <ul className="mt-4 space-y-2">
                    {companies.map((c) => (
                      <li key={c.slug}>
                        <Link
                          href={`/${c.slug}/vagas`}
                          className="group flex items-center gap-3 rounded-2xl border border-[#ebe6e0] px-3.5 py-3 transition-all hover:-translate-y-0.5 hover:border-[#d8d0c8] hover:shadow-sm"
                        >
                          <span
                            className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl text-[10px] font-bold text-white"
                            style={{ background: c.primaryColor ?? "#811201" }}
                          >
                            {c.logoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={c.logoUrl}
                                alt=""
                                className="size-full object-cover"
                              />
                            ) : (
                              c.name.slice(0, 2).toUpperCase()
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold text-[#1c1917]">
                              {c.name}
                            </span>
                            {c.sector && (
                              <span className="block truncate text-[11px] text-[#a8a29e]">
                                {c.sector}
                              </span>
                            )}
                          </span>
                          {c._count.jobs > 0 && (
                            <span className="rounded-full bg-[#f5f1ed] px-2 py-1 text-[10px] font-semibold text-[#78716c]">
                              {c._count.jobs} {c._count.jobs === 1 ? "vaga" : "vagas"}
                            </span>
                          )}
                          <span className="text-lg text-[#c4bdb6] transition-transform group-hover:translate-x-0.5">
                            →
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="my-5 h-px bg-[#eee9e4]" />

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#aaa39c]">
                  Área restrita
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-[-0.3px]">
                  {empresa === "plataforma" ? "Console admin" : "Entrar no painel"}
                </h2>
                <p className="mt-1.5 text-[13px] leading-5 text-[#78716c]">
                  {company
                    ? `Acesse o painel de recrutamento da ${company.name}.`
                    : "Gestores e administradores da plataforma."}
                </p>

                <LoginForm branded={Boolean(company)} slug={company?.slug} />
              </div>
            </div>

            <p className="mt-5 text-center text-[11px] text-[#aaa39e]">
              Plataforma de recrutamento · Triagem
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
