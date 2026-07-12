import Link from "next/link";

import type { PublicCompany } from "@/server/models/company.model";

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
export function CompanyHeader({ company }: { company: PublicCompany }) {
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
        <span className="text-[13px] font-medium text-[#71717a]">
          Carreiras
        </span>
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
