import { Bell, LogOut } from "lucide-react";
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

/** Logo sobre a faixa da marca: a versão completa, pintada de branco. */
function BrandLogo({ company }: { company: PublicCompany }) {
  if (company.logoFullUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={company.logoFullUrl}
        alt={company.name}
        className="h-[60px] w-auto object-contain md:h-[76px]"
        style={{ filter: "brightness(0) invert(1)" }}
      />
    );
  }
  return (
    <span className="text-lg font-bold text-white">{company.name}</span>
  );
}

/** Logo sobre fundo claro: o símbolo colorido + o nome. */
function LightLogo({ company }: { company: PublicCompany }) {
  return (
    <span className="flex items-center gap-2.5">
      {company.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={company.logoUrl}
          alt=""
          className="size-9 object-contain"
        />
      ) : (
        <span
          className="flex size-8 items-center justify-center rounded-[7px] text-[11px] font-bold"
          style={{
            backgroundColor: "var(--brand-primary)",
            color: "var(--brand-foreground)",
          }}
        >
          {companyInitials(company.name)}
        </span>
      )}
      <span className="text-[15px] font-semibold tracking-[0.2px] text-[#1c1917]">
        {company.name}
      </span>
    </span>
  );
}

/**
 * Cabeçalho do fluxo público. `brand` fica sobre a faixa bordô da página de
 * vagas (o logo completo faz as vezes de cabeçalho); `light` é o das telas
 * internas, mais quieto, com o símbolo.
 */
export async function CompanyHeader({
  company,
  candidate,
  tone = "light",
  showSignIn = true,
  jobCount,
}: {
  company: PublicCompany;
  candidate?: CandidateProfile | null;
  tone?: "light" | "brand";
  showSignIn?: boolean;
  jobCount?: number;
}) {
  const unread = candidate ? await getUnreadCount() : 0;
  const onBrand = tone === "brand";

  const link = onBrand
    ? "text-white/85 hover:text-white"
    : "text-[#57534e] hover:text-[#0a0a0a]";
  const iconButton = onBrand
    ? "text-white/85 hover:bg-white/10 hover:text-white"
    : "text-[#71717a] hover:bg-[#f1efec] hover:text-[#0a0a0a]";

  return (
    <header
      className={
        onBrand
          ? ""
          : "border-b border-[#ebe7e3] bg-white/90 backdrop-blur"
      }
    >
      <div
        className={
          "mx-auto flex w-full max-w-[1120px] items-center justify-between gap-4 px-5 md:px-8 " +
          (onBrand ? "pt-6" : "h-16")
        }
      >
        <div className="flex items-center gap-6">
          <Link
            href={`/${company.slug}/vagas`}
            aria-label={`${company.name}: vagas`}
            className="shrink-0"
          >
            {onBrand ? (
              <BrandLogo company={company} />
            ) : (
              <LightLogo company={company} />
            )}
          </Link>

          {!onBrand && jobCount !== undefined && jobCount > 0 && (
            <Link
              href={`/${company.slug}/vagas`}
              className="hidden items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-[#57534e] hover:text-[#0a0a0a] sm:flex"
            >
              Vagas
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{
                  backgroundColor: "var(--brand-tint)",
                  color: "var(--brand-primary)",
                }}
              >
                {jobCount}
              </span>
            </Link>
          )}
        </div>

        {candidate ? (
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              href={`/${company.slug}/minhas-candidaturas`}
              className={`rounded-lg px-2 py-1.5 text-[13px] font-medium ${link}`}
            >
              <span className="sm:hidden">Minha área</span>
              <span className="hidden sm:inline">Minhas candidaturas</span>
            </Link>
            <Link
              href={`/${company.slug}/notificacoes`}
              aria-label={
                unread > 0
                  ? `Novidades: ${unread} não lida${unread === 1 ? "" : "s"}`
                  : "Novidades"
              }
              className={`relative flex size-9 items-center justify-center rounded-full ${iconButton}`}
            >
              <Bell aria-hidden className="size-[18px]" strokeWidth={1.75} />
              {unread > 0 && (
                <span
                  className={
                    "absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold " +
                    (onBrand ? "bg-white" : "text-white")
                  }
                  style={
                    onBrand
                      ? { color: "var(--brand-primary)" }
                      : { backgroundColor: "var(--brand-primary)" }
                  }
                >
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <Link
              href={`/${company.slug}/perfil`}
              className={`hidden rounded-lg px-2 py-1.5 text-[13px] sm:inline ${link}`}
            >
              {candidate.name.split(" ")[0]}
            </Link>
            <form action={logoutCandidateAction.bind(null, company.slug)}>
              <button
                type="submit"
                aria-label="Sair"
                title="Sair"
                className={`flex size-9 items-center justify-center rounded-full ${iconButton}`}
              >
                <LogOut aria-hidden className="size-[17px]" strokeWidth={1.75} />
              </button>
            </form>
          </nav>
        ) : !showSignIn ? null : (
          <Link
            href={`/${company.slug}/entrar?next=${encodeURIComponent(`/${company.slug}/minhas-candidaturas`)}&modo=entrar`}
            className={
              "rounded-xl px-4 py-2 text-[13px] font-medium " +
              (onBrand
                ? "border border-white/30 text-white hover:bg-white/10"
                : "border border-[#e4e0dc] bg-white text-[#1c1917] hover:border-[#d6d0ca]")
            }
          >
            Entrar
          </Link>
        )}
      </div>
    </header>
  );
}

/** Rodapé do fluxo público. */
export function CompanyFooter({ company }: { company: PublicCompany }) {
  return (
    <footer className="mt-24 border-t border-[#ebe7e3]">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-1 px-5 py-8 text-xs text-[#a8a29e] sm:flex-row sm:items-center sm:justify-between md:px-8">
        <span>
          {company.name}
          {company.sector ? ` · ${company.sector}` : ""}
        </span>
        <div className="flex items-center gap-4">
          <a
            href="/login"
            className="transition-colors hover:text-[#78716c]"
          >
            Área do gestor
          </a>
          <span>Página de vagas feita com Triagem</span>
        </div>
      </div>
    </footer>
  );
}
