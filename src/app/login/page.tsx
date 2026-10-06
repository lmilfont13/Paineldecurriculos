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
      <div className="grid min-h-screen lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden overflow-hidden border-r border-white/[0.06] lg:flex">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_16%,rgba(255,255,255,0.075),transparent_28%),radial-gradient(circle_at_78%_62%,rgba(129,18,1,0.2),transparent_34%),linear-gradient(135deg,#090808_0%,#0c0a0a_58%,#130d0c_100%)]" />
          <div className="relative flex w-full flex-col justify-between p-10 xl:p-14 2xl:p-16">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-[13px] text-xs font-bold text-white shadow-[0_8px_30px_rgba(129,18,1,0.28)]" style={{ backgroundColor: "var(--brand-primary, #811201)" }}>T</span>
                <div>
                  <p className="text-sm font-semibold tracking-wide">Triagem</p>
                  <p className="text-[11px] text-white/40">Recrutamento inteligente</p>
                </div>
              </div>

              <div className="mt-24 max-w-[620px] xl:mt-28">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--brand-secondary, #c9a9a2)" }}>
                  {company ? company.name : "Plataforma"}
                </p>
                <div className="flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.18em] text-white/30"><span className="h-px w-8 bg-white/20" />Recrutamento sem ruído</div>
                <h1 className="mt-5 max-w-[590px] text-[44px] font-semibold leading-[1.01] tracking-[-2px] text-white xl:text-[60px] 2xl:text-[64px]">
                  {company ? "Encontre os talentos certos para o seu time." : "Recrutamento mais claro. Decisões melhores."}
                </h1>
                <p className="mt-7 max-w-[540px] text-[15px] leading-7 text-white/55">
                  {company ? "Organize vagas, avalie candidatos e tome decisões com mais contexto." : "Uma plataforma para organizar vagas, candidatos e o processo de decisão da sua equipe."}
                </p>
              </div>
            </div>

            <div className="mt-12 hidden w-[360px] rounded-[22px] border border-white/[0.1] bg-white/[0.035] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur-md xl:block">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Painel de decisão</p>
                  <p className="mt-1 text-[12px] font-medium text-white/80">Contexto antes da escolha</p>
                </div>
                <span className="flex size-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-[10px] text-white/45">AI</span>
              </div>
              <div className="mt-4 space-y-2.5">
                <div className="flex items-center gap-3"><span className="w-[108px] text-[10px] text-white/40">Experiência</span><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]"><span className="block h-full w-[82%] rounded-full bg-gradient-to-r from-white/20 to-white/55" /></div><span className="w-14 text-right text-[9px] font-medium text-white/35">forte</span></div>
                <div className="flex items-center gap-3"><span className="w-[108px] text-[10px] text-white/40">Aderência à vaga</span><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]"><span className="block h-full w-[91%] rounded-full bg-gradient-to-r from-white/20 to-white/55" /></div><span className="w-14 text-right text-[9px] font-medium text-white/35">alta</span></div>
                <div className="flex items-center gap-3"><span className="w-[108px] text-[10px] text-white/40">Momento profissional</span><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]"><span className="block h-full w-[76%] rounded-full bg-gradient-to-r from-white/20 to-white/55" /></div><span className="w-14 text-right text-[9px] font-medium text-white/35">compatível</span></div>
              </div>
            </div>

            <div className="grid max-w-[620px] gap-3 sm:grid-cols-3">
              {[
                ["01", "Vagas", "Organize oportunidades e critérios."],
                ["02", "Triagem", "Priorize candidatos com contexto."],
                ["03", "Decisão", "Mantenha o controle na mão do gestor."],
              ].map(([number, title, description]) => (
                <div key={number} className="rounded-[18px] border border-white/[0.1] bg-white/[0.035] p-4 transition-all hover:-translate-y-0.5 hover:border-white/[0.15] hover:bg-white/[0.055]">
                  <span className="text-[10px] font-semibold tracking-[0.16em] text-white/30">{number}</span>
                  <p className="mt-4 text-[13px] font-semibold text-white/85">{title}</p>
                  <p className="mt-1.5 text-[11px] leading-5 text-white/40">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center overflow-hidden bg-[#f7f5f2] px-5 py-8 text-[#1c1917] sm:px-8">
          <div className="relative w-full max-w-[390px]">
            <div className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-[#811201]/[0.035] blur-2xl" />

            <div className="mb-7 lg:hidden">
              <p className="text-sm font-semibold">Triagem</p>
              <p className="mt-1 text-xs text-[#8a847e]">Recrutamento inteligente</p>
            </div>

            <div className="rounded-[28px] border border-[#e7e1db] bg-white/95 p-6 shadow-[0_30px_90px_rgba(28,25,23,0.11),0_2px_8px_rgba(28,25,23,0.03)] backdrop-blur-xl sm:p-7">
              {companies.length > 0 && (
                <div className="rounded-[22px] border border-[#ead7dd] bg-[#fcf7f9] p-5 shadow-[0_10px_30px_rgba(129,18,1,0.05)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--brand-primary, #811201)" }}>
                        Área do candidato
                      </p>
                      <h2 className="mt-2 text-[25px] font-semibold tracking-[-0.65px]">Encontre sua próxima oportunidade</h2>
                      <p className="mt-2 max-w-[300px] text-[13px] leading-5 text-[#78716c]">
                        Escolha uma empresa, veja as vagas abertas e candidate-se.
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#a8a29e]">01</span>
                  </div>

                  <ul className="mt-5 space-y-2">
                    {companies.map((c) => (
                      <li key={c.slug}>
                        <Link href={`/${c.slug}/vagas`} className="group flex items-center gap-3 rounded-2xl border border-[#e7dfd9] bg-white px-3.5 py-3.5 transition-all hover:-translate-y-0.5 hover:border-[#d8c8c1] hover:shadow-md">
                          <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl text-[10px] font-bold text-white shadow-sm" style={{ background: c.primaryColor ?? "#811201" }}>
                            {c.logoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={c.logoUrl} alt="" className="size-full object-cover" />
                            ) : c.name.slice(0, 2).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold text-[#1c1917]">{c.name}</span>
                            {c.sector && <span className="block truncate text-[11px] text-[#a8a29e]">{c.sector}</span>}
                          </span>
                          {c._count.jobs > 0 && <span className="rounded-full bg-[#f5f1ed] px-2 py-1 text-[10px] font-semibold text-[#78716c]">{c._count.jobs} {c._count.jobs === 1 ? "vaga" : "vagas"}</span>}
                          <span className="text-lg text-[#b7aaa4] transition-transform group-hover:translate-x-0.5">→</span>
                        </Link>
                      </li>
                    ))}
                  </ul>

                  <p className="mt-4 text-center text-[10px] text-[#a8a29e]">Você não precisa de login para procurar uma vaga.</p>
                </div>
              )}

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-[#eee9e4]" />
                <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#c1bbb5]">Acesso restrito</span>
                <div className="h-px flex-1 bg-[#eee9e4]" />
              </div>

              <details className="group rounded-2xl border border-[#eee9e4] bg-[#faf9f7]">
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 [&::-webkit-details-marker]:hidden">
                  <span>
                    <span className="block text-[12px] font-semibold text-[#57534e]">Sou gestor ou administrador</span>
                    <span className="mt-0.5 block text-[10px] text-[#a8a29e]">Acesso ao painel de recrutamento</span>
                  </span>
                  <span className="flex size-7 items-center justify-center rounded-lg border border-[#e7e1db] bg-white text-[#a8a29e] transition-transform group-open:rotate-180">⌄</span>
                </summary>

                <div className="border-t border-[#eee9e4] px-4 pb-4 pt-3">
                  <p className="text-[12px] leading-5 text-[#8a847e]">
                    Entre com as credenciais da sua empresa.
                  </p>
                  <LoginForm branded={Boolean(company)} slug={company?.slug} />
                </div>
              </details>
            </div>

            <p className="mt-5 text-center text-[11px] text-[#aaa39e]">Plataforma de recrutamento · Triagem</p>
          </div>
        </section>
      </div>
    </main>
  );
}
