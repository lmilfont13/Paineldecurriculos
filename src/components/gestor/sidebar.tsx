"use client";

import {
  Briefcase,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/painel", label: "Painel", Icon: LayoutDashboard },
  { href: "/vagas", label: "Vagas", Icon: Briefcase },
  { href: "/candidaturas", label: "Candidatos", Icon: Users, badge: true },
  { href: "/auditoria", label: "Auditoria", short: "Audit", Icon: ClipboardList },
  { href: "/configuracoes", label: "Configurações", short: "Ajustes", Icon: Settings },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Símbolo da empresa: a imagem quando existe, iniciais quando não. */
function CompanyMark({
  name,
  initials,
  logoUrl,
  size = 32,
}: {
  name: string;
  initials: string;
  logoUrl: string | null;
  size?: number;
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name}
        width={size}
        height={size}
        className="shrink-0 rounded-[7px] bg-white object-contain p-0.5 ring-1 ring-[#e4e4e7]"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-[7px] text-[11px] font-bold"
      style={{
        width: size,
        height: size,
        backgroundColor: "var(--brand-primary)",
        color: "var(--brand-foreground)",
      }}
    >
      {initials}
    </span>
  );
}

function PendingBadge({ count }: { count: number }) {
  return (
    <span
      className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[11px] font-medium"
      style={{
        backgroundColor: "var(--brand-tint)",
        color: "var(--brand-primary)",
      }}
    >
      {count}
    </span>
  );
}

/**
 * Lateral do painel (desktop). Base neutra (regra 4); a marca entra no
 * símbolo da empresa, no item ativo e no contador.
 */
export function GestorSidebar({
  companyName,
  companyInitials,
  logoUrl,
  pendingCount,
  userName,
  userInitials,
  logoutAction,
}: {
  companyName: string;
  companyInitials: string;
  logoUrl: string | null;
  pendingCount: number;
  userName: string;
  userInitials: string;
  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-[#e4e4e7] bg-[#f5f5f4] md:flex">
      <div className="m-3 flex items-center gap-2.5 rounded-lg p-2">
        <CompanyMark
          name={companyName}
          initials={companyInitials}
          logoUrl={logoUrl}
        />
        <span className="min-w-0 truncate text-[13px] font-semibold text-[#0a0a0a]">
          {companyName}
        </span>
      </div>

      <nav className="mt-4 flex flex-col gap-1 px-3">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                "flex h-[38px] items-center gap-2.5 rounded-lg px-3.5 text-sm " +
                (active
                  ? "bg-[#e7e5e4] font-medium text-[#0a0a0a]"
                  : "text-[#71717a] hover:bg-[#eeedec] hover:text-[#0a0a0a]")
              }
            >
              <item.Icon
                aria-hidden
                className="size-4 shrink-0"
                strokeWidth={active ? 2.25 : 1.75}
                style={active ? { color: "var(--brand-primary)" } : undefined}
              />
              <span className="flex-1">{item.label}</span>
              {"badge" in item && item.badge && pendingCount > 0 && (
                <PendingBadge count={pendingCount} />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-2.5 border-t border-[#e4e4e7] p-3">
        <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-[#1c1917] text-[10px] font-bold text-white">
          {userInitials}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#0a0a0a]">
          {userName}
        </span>
        <button
          type="button"
          onClick={() => logoutAction()}
          title="Sair"
          className="rounded-md px-2 py-1 text-[11px] font-medium text-[#71717a] hover:bg-[#e7e5e4] hover:text-[#0a0a0a]"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}

/**
 * Barra de cima. No desktop mostra onde você está; no celular, que não tem a
 * lateral, carrega a identidade da empresa e o botão de sair.
 */
export function GestorTopbar({
  companyName,
  companyInitials,
  logoUrl,
  logoutAction,
}: {
  companyName: string;
  companyInitials: string;
  logoUrl: string | null;
  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const section =
    NAV.find((n) => isActive(pathname, n.href))?.label ?? "Painel";

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center border-b border-[#e4e4e7] bg-white/95 px-4 backdrop-blur md:static md:bg-white md:px-8">
      <span className="flex min-w-0 flex-1 items-center gap-2.5 md:hidden">
        <CompanyMark
          name={companyName}
          initials={companyInitials}
          logoUrl={logoUrl}
          size={28}
        />
        <span className="truncate text-[13px] font-semibold text-[#0a0a0a]">
          {companyName}
        </span>
      </span>
      <button
        type="button"
        onClick={() => logoutAction()}
        aria-label="Sair"
        className="flex size-9 items-center justify-center rounded-lg text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#0a0a0a] md:hidden"
      >
        <LogOut aria-hidden className="size-[18px]" strokeWidth={1.75} />
      </button>

      <span className="hidden text-[13px] md:inline">
        <span className="text-[#71717a]">{companyName}</span>
        <span className="mx-2 text-[#a1a1aa]">/</span>
        <span className="font-medium text-[#0a0a0a]">{section}</span>
      </span>
    </header>
  );
}

/** Navegação do celular: polegar alcança, rótulo sempre visível. */
export function GestorBottomNav({ pendingCount }: { pendingCount: number }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-[#e4e4e7] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              "relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] " +
              (active ? "font-medium text-[#0a0a0a]" : "text-[#71717a]")
            }
          >
            <item.Icon
              aria-hidden
              className="size-5"
              strokeWidth={active ? 2.25 : 1.75}
              style={active ? { color: "var(--brand-primary)" } : undefined}
            />
            {"short" in item ? item.short : item.label}
            {"badge" in item && item.badge && pendingCount > 0 && (
              <span className="absolute right-[calc(50%-22px)] top-2">
                <PendingBadge count={pendingCount} />
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
