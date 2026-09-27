import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { brandCssVars } from "@/server/models/company.model";
import {
  getDefaultCompanySlug,
  getPublicCompanyBySlug,
} from "@/server/services/company.service";
import { getSessionUser, isAdmin } from "@/server/services/auth.service";

export const metadata: Metadata = { title: "Entrar" };

/**
 * Login unificado (gestor + admin). Com `?empresa=<slug>` mostra essa marca;
 * sem o parâmetro, a da empresa ativa, porque quem digita só /login é o dono
 * dela. `?empresa=plataforma` força a versão neutra do console.
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
    empresa === "plataforma" ? null : (empresa ?? (await getDefaultCompanySlug()));
  const company = slug ? await getPublicCompanyBySlug(slug) : null;

  return (
    <main
      className="flex min-h-screen bg-[#faf8f6]"
      style={
        company ? (brandCssVars(company) as React.CSSProperties) : undefined
      }
    >
      {/* Painel da marca (empresa no login do gestor, plataforma no admin) */}
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

      {/* Formulário */}
      <section className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-[380px]">
          {company && (
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              {company.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={company.logoUrl} alt="" className="size-10 object-contain" />
              )}
              <span className="text-base font-semibold text-[#1c1917]">
                {company.name}
              </span>
            </div>
          )}
          <h2 className="text-[26px] font-bold text-[#1c1917]">Entrar</h2>
          <p className="mt-2 text-sm text-[#78716c]">
            {company
              ? `Acesso da equipe da ${company.name}.`
              : "Área da equipe: gestores e administradores."}
          </p>

          <LoginForm branded={Boolean(company)} />

          <p className="mt-8 border-t border-[#ebe7e3] pt-6 text-[13px] leading-relaxed text-[#78716c]">
            É candidato?{" "}
            {company ? (
              <Link
                href={`/${company.slug}/vagas`}
                className="font-medium underline-offset-2 hover:underline"
                style={{ color: "var(--brand-primary)" }}
              >
                Veja as vagas e acompanhe sua candidatura por lá.
              </Link>
            ) : (
              "Você entra pela página de vagas da empresa onde se candidatou."
            )}
          </p>
        </div>
      </section>
    </main>
  );
}
