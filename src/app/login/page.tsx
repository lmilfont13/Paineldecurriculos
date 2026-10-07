import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type React from "react";

import { LoginForm } from "@/components/auth/login-form";
import { brandCssVars } from "@/server/models/company.model";
import { getDefaultCompanySlug, getPublicCompanyBySlug, listPublicCompanies } from "@/server/services/company.service";
import { getSessionUser, isAdmin } from "@/server/services/auth.service";

export const metadata: Metadata = { title: "Triagem · Recrutamento" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const user = await getSessionUser();
  if (user) redirect(isAdmin(user) ? "/admin/empresas" : "/painel");

  const { empresa } = await searchParams;
  const slug = empresa === "plataforma" ? null : (empresa ?? (await getDefaultCompanySlug()));
  // Sequencial: com connection_limit=1 o Promise.all só enfileira na
  // mesma conexão e aumenta o risco de P2024 (pool_timeout).
  const company = slug ? await getPublicCompanyBySlug(slug) : null;
  const companies = await listPublicCompanies();

  return (
    <main className="min-h-screen bg-[#f4f2ef] text-[#1c1917]" style={{ ...(company ? (brandCssVars(company) as React.CSSProperties) : {}) }}>
      <div className="mx-auto flex min-h-screen w-full max-w-[1540px] items-stretch p-3 sm:p-5 lg:p-7">
        <div className="grid min-h-[calc(100vh-2.5rem)] w-full overflow-hidden rounded-[30px] border border-[#ded9d4] bg-white shadow-[0_30px_100px_rgba(28,25,23,0.12)] lg:grid-cols-2">

          <section className="relative overflow-hidden bg-[#0b0909] px-6 py-8 text-white sm:px-10 sm:py-10 lg:px-12 xl:px-16 xl:py-14">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(255,255,255,0.08),transparent_28%),radial-gradient(circle_at_82%_75%,rgba(129,18,1,0.28),transparent_38%),linear-gradient(145deg,#090808_0%,#0d0b0b_62%,#160d0c_100%)]" />
            <div className="absolute -bottom-28 -left-20 size-72 rounded-full border border-white/[0.04]" />
            <div className="relative flex h-full flex-col">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-[14px] text-xs font-bold text-white shadow-[0_10px_35px_rgba(129,18,1,0.3)]" style={{ backgroundColor: "var(--brand-primary, #811201)" }}>T</span>
                <div><p className="text-sm font-semibold tracking-wide">Triagem</p><p className="text-[10px] uppercase tracking-[0.16em] text-white/35">SaaS de recrutamento</p></div>
              </div>

              <div className="mt-14 max-w-[560px] xl:mt-20">
                <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35"><span className="h-px w-8 bg-white/20" />Para empresas</div>
                <h1 className="mt-5 text-[40px] font-semibold leading-[1.02] tracking-[-1.8px] sm:text-[48px] xl:text-[56px]">Recrute melhor. Decida com mais clareza.</h1>
                <p className="mt-6 max-w-[500px] text-[14px] leading-6 text-white/50 sm:text-[15px] sm:leading-7">Organize vagas, candidatos e decisões em um único ambiente profissional para sua equipe.</p>
              </div>

              <div className="mt-10 max-w-[520px] rounded-[22px] border border-white/[0.09] bg-white/[0.035] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.2)] backdrop-blur-md sm:p-5">
                <div className="flex items-center justify-between"><div><p className="text-[9px] font-semibold uppercase tracking-[0.17em] text-white/30">Seu ambiente de recrutamento</p><p className="mt-1 text-[12px] font-medium text-white/80">Tudo que sua equipe precisa para contratar</p></div><span className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] font-semibold text-white/40">SaaS</span></div>
                <div className="mt-5 grid grid-cols-3 gap-2">
                  {[["01","Vagas","Organizadas"],["02","Triagem","Inteligente"],["03","Decisão","Com contexto"]].map(([n,title,sub]) => <div key={n} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"><span className="text-[9px] font-semibold text-white/25">{n}</span><p className="mt-3 text-[11px] font-semibold text-white/80">{title}</p><p className="mt-0.5 text-[9px] text-white/35">{sub}</p></div>)}
                </div>
              </div>

              <div className="mt-auto pt-10">
                <div className="mb-5 flex items-center gap-3"><span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Acesso da empresa</span><div className="h-px flex-1 bg-white/[0.08]" /></div>
                <div className="max-w-[440px] rounded-[22px] border border-white/[0.09] bg-black/20 p-5 backdrop-blur-sm sm:p-6">
                  <div className="mb-1 flex items-center justify-between"><h2 className="text-[18px] font-semibold">Entrar no painel</h2><span className="text-[9px] font-medium uppercase tracking-[0.14em] text-white/30">Gestor</span></div>
                  <p className="mb-1 text-[12px] leading-5 text-white/40">Acesse o ambiente de recrutamento da sua empresa.</p>
                  <LoginForm branded={Boolean(company)} slug={company?.slug} dark />
                </div>
              </div>
            </div>
          </section>

          <section className="relative overflow-hidden bg-[#f8f6f3] px-6 py-8 sm:px-10 sm:py-10 lg:px-12 xl:px-16 xl:py-14">
            <div className="absolute right-[-90px] top-[-90px] size-64 rounded-full bg-[#811201]/[0.035] blur-3xl" />
            <div className="absolute bottom-[-120px] right-[-60px] size-72 rounded-full border border-[#e8e1db]" />
            <div className="relative flex h-full flex-col">
              <div className="flex items-center justify-between"><div><p className="text-sm font-semibold tracking-wide text-[#1c1917]">Triagem</p><p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[#aaa39c]">Oportunidades profissionais</p></div><span className="rounded-full border border-[#e5dfda] bg-white px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.13em] text-[#a8a29e]">Candidato</span></div>

              <div className="mt-14 max-w-[560px] xl:mt-20">
                <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--brand-primary, #811201)" }}><span className="h-px w-8 bg-current opacity-30" />Para candidatos</div>
                <h2 className="mt-5 text-[40px] font-semibold leading-[1.02] tracking-[-1.8px] text-[#1c1917] sm:text-[48px] xl:text-[56px]">Encontre a próxima oportunidade certa para você.</h2>
                <p className="mt-6 max-w-[500px] text-[14px] leading-6 text-[#78716c] sm:text-[15px] sm:leading-7">Veja vagas abertas, conheça as empresas e acompanhe suas candidaturas em um só lugar.</p>
              </div>

              <div className="mt-10 rounded-[22px] border border-[#e5dfda] bg-white p-4 shadow-[0_18px_50px_rgba(28,25,23,0.06)] sm:p-5">
                <div className="flex items-center justify-between"><div><p className="text-[9px] font-semibold uppercase tracking-[0.17em] text-[#aaa39c]">Empresas com oportunidades</p><p className="mt-1 text-[12px] font-medium text-[#57534e]">Escolha onde você quer trabalhar</p></div><span className="text-[10px] text-[#b7b0aa]">{companies.length} {companies.length === 1 ? "empresa" : "empresas"}</span></div>
                <ul className="mt-5 space-y-2.5">
                  {companies.map((c) => <li key={c.slug}><Link href={`/${c.slug}/vagas`} className="group flex items-center gap-3 rounded-2xl border border-[#e9e3de] bg-[#fcfbfa] px-4 py-3.5 transition-all hover:-translate-y-0.5 hover:border-[#d7cdc5] hover:bg-white hover:shadow-md">
                    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl text-[10px] font-bold text-white shadow-sm" style={{ background: c.primaryColor ?? "#811201" }}>{c.logoUrl ? <img src={c.logoUrl} alt="" className="size-full object-cover" /> : c.name.slice(0,2).toUpperCase()}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold text-[#1c1917]">{c.name}</span>{c.sector && <span className="block truncate text-[11px] text-[#a8a29e]">{c.sector}</span>}</span>
                    {c._count.jobs > 0 && <span className="rounded-full bg-[#f5f1ed] px-2 py-1 text-[10px] font-semibold text-[#78716c]">{c._count.jobs} {c._count.jobs === 1 ? "vaga" : "vagas"}</span>}
                    <span className="text-lg text-[#b7aaa3] transition-transform group-hover:translate-x-0.5">→</span>
                  </Link></li>)}
                </ul>
                {companies.length === 0 && <div className="rounded-2xl border border-dashed border-[#ddd6d0] bg-[#faf9f7] p-6 text-center text-[12px] text-[#8a847e]">Nenhuma empresa com vagas abertas no momento.</div>}
              </div>

              <div className="mt-auto pt-8"><div className="flex items-center justify-between rounded-2xl border border-[#e5dfda] bg-white/70 px-4 py-3.5"><div><p className="text-[11px] font-semibold text-[#57534e]">Já se candidatou?</p><p className="mt-0.5 text-[10px] text-[#a8a29e]">Acompanhe seus processos pela área da empresa.</p></div><span className="text-[18px] text-[#b7b0aa]">→</span></div></div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
