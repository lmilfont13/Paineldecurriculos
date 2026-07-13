import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { brandCssVars } from "@/server/models/company.model";
import { getPublicCompanyBySlug } from "@/server/services/company.service";
import { getSessionUser, isAdmin } from "@/server/services/auth.service";

function companyInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  const initials = words.slice(0, 2).map((w) => w[0] ?? "");
  return initials.join("").toUpperCase();
}

/**
 * Login unificado (gestor + admin) — frames E0/A0 do Figma.
 * Com `?empresa=<slug>` mostra a marca do cliente (regra 4);
 * sem o parâmetro, versão neutra da plataforma.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect(isAdmin(user) ? "/admin/empresas" : "/painel");

  const { empresa } = await searchParams;
  const company = empresa ? await getPublicCompanyBySlug(empresa) : null;

  return (
    <main
      className="flex min-h-screen bg-[#fafaf9]"
      style={
        company ? (brandCssVars(company) as React.CSSProperties) : undefined
      }
    >
      {/* Painel esquerdo — marca (empresa no login do gestor, plataforma no admin) */}
      <aside className="hidden w-[560px] shrink-0 flex-col justify-between bg-[#1c1917] p-16 lg:flex">
        <div className="flex items-center gap-2.5">
          {company ? (
            <span
              className="flex size-8 items-center justify-center rounded-[7px] text-[11px] font-bold text-white"
              style={{ backgroundColor: company.primaryColor }}
            >
              {companyInitials(company.name)}
            </span>
          ) : (
            <span className="flex size-8 items-center justify-center rounded-[7px] bg-[#fafaf9] text-[13px] text-[#1c1917]">
              ▲
            </span>
          )}
          <span className="text-sm font-bold text-[#fafaf9]">
            {company ? company.name : "Triagem"}
          </span>
        </div>

        <div className="mb-32">
          <h1 className="max-w-[420px] text-[32px] font-bold leading-10 text-[#fafaf9]">
            {company ? "Painel de recrutamento" : "Console da plataforma"}
          </h1>
          <p className="mt-10 max-w-[380px] text-sm leading-[21px] text-[#fafaf9]/50">
            {company
              ? "Gerencie vagas, candidaturas e a triagem por IA da sua empresa."
              : "Cadastre empresas, configure identidade e formulários, e gerencie os clientes."}
          </p>
        </div>

        <div />
      </aside>

      {/* Formulário */}
      <section className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-[400px]">
          <h2 className="text-[28px] font-bold text-[#0a0a0a]">Entrar</h2>
          <p className="mt-2 text-sm text-[#71717a]">
            {company
              ? `Acesse o painel da ${company.name}.`
              : "Área da equipe — gestores e administradores."}
          </p>

          <LoginForm branded={Boolean(company)} />

          {!company && (
            <p className="mt-6 border-t border-[#e4e4e7] pt-6 text-[13px] leading-relaxed text-[#71717a]">
              É candidato? Você entra pela página de vagas da empresa onde se
              candidatou — abra o link de carreiras e clique em “Entrar”.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
