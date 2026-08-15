import { Bell } from "lucide-react";
import Link from "next/link";

import type { CandidateProfile } from "@/server/models/candidate.model";
import type { PublicCompany } from "@/server/models/company.model";
import { logoutCandidateAction } from "@/server/controllers/candidate.controller";
import { getUnreadCount } from "@/server/controllers/public.controller";

export function companyInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

/** Cabeçalho do fluxo público — marca do cliente (frame P1 do Figma). */
export async function CompanyHeader({
  company,
  candidate,
}: {
  company: PublicCompany;
  candidate?: CandidateProfile | null;
}) {
  const unread = candidate ? await getUnreadCount() : 0;

  return (
    <header className="border-b border-[#e4e4e7] bg-[#fafaf9]">
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-6">
        <Link href={`/${company.slug}/vagas`} className="flex items-center gap-2">
          {company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logoUrl}
              alt={company.name}
              className="size-8 rounded-[7px] object-cover"
            />
          ) : (
            <span
              className="flex size-8 items-center justify-center rounded-[7px] text-[11px] font-bold text-white"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              {companyInitials(company.name)}
            </span>
          )}
          <span className="text-sm font-bold text-[#0a0a0a]">
            {company.name}
          </span>
        </Link>
        {candidate ? (
          <span className="flex items-center gap-5">
            <Link
              href={`/${company.slug}/minhas-candidaturas`}
              className="text-[13px] font-medium hover:underline"
              style={{ color: "var(--brand-primary)" }}
            >
              Minhas candidaturas
            </Link>
            <Link
              href={`/${company.slug}/notificacoes`}
              aria-label={
                unread > 0
                  ? `Novidades: ${unread} não lida${unread === 1 ? "" : "s"}`
                  : "Novidades"
              }
              className="relative flex size-8 items-center justify-center rounded-full text-[#71717a] transition-colors hover:bg-[#f1f0ed] hover:text-[#0a0a0a]"
            >
              <Bell aria-hidden className="size-[18px]" strokeWidth={1.75} />
              {unread > 0 && (
                <span
                  className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                  style={{ backgroundColor: "var(--brand-primary)" }}
                >
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <Link
              href={`/${company.slug}/perfil`}
              className="hidden text-[13px] text-[#71717a] hover:text-[#0a0a0a] hover:underline sm:inline"
            >
              {candidate.name.split(" ")[0]}
            </Link>
            <form action={logoutCandidateAction.bind(null, company.slug)}>
              <button
                type="submit"
                className="text-[13px] font-medium text-[#71717a] hover:text-[#0a0a0a]"
              >
                Sair
              </button>
            </form>
          </span>
        ) : (
          <span className="text-[13px] font-medium text-[#71717a]">
            Carreiras
          </span>
        )}
      </div>
    </header>
  );
}

/** Rodapé do fluxo público (frame P1 do Figma). */
export function CompanyFooter({ company }: { company: PublicCompany }) {
  return (
    <footer className="mx-auto w-full max-w-[1200px] px-6 pb-8 pt-16">
      <p className="text-xs text-[#a1a1aa]">
        Página de carreiras da {company.name} · feito com Triagem
      </p>
    </footer>
  );
}
