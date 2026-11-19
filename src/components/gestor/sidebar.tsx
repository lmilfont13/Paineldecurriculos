"use client";

import { useEffect, useRef } from "react";

import {
  Briefcase,
  Bot,
  Cake,
  ClipboardList,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Search,
  Settings,
  Share2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { RadioStation } from "@/components/gestor/radio-player";
import { OnlineCounterBadge } from "@/components/gestor/online-presence";
import { CommandPaletteTrigger, openCommandPalette } from "@/components/gestor/command-palette";
import { SoundToggleControl } from "@/components/gestor/sound-notification-listener";
import { LiveAttendanceTopbarButton } from "@/components/gestor/live-attendance-toggle";
import { BirthdayReminderBadge } from "@/components/gestor/birthday-reminder-badge";

const NAV = [
  { href: "/painel", label: "Painel", Icon: LayoutDashboard },
  { href: "/vagas", label: "Vagas", Icon: Briefcase },
  { href: "/candidaturas", label: "Candidatos", Icon: Users, badge: true },
  { href: "/divulgacao", label: "Divulgação / Posts", short: "Divulgação", Icon: Share2 },
  // Desativado momentaneamente para evolução futura:
  // { href: "/suporte-ao-vivo", label: "Suporte ao Vivo", short: "Suporte", Icon: Headphones },
  { href: "/buscar-cvs", label: "Buscar CVs", short: "Buscar", Icon: Search },
  { href: "/talentos", label: "Talentos", Icon: FolderOpen },
  { href: "/aniversariantes", label: "Aniversariantes", short: "Aniversários", Icon: Cake },
  { href: "/agentes", label: "Agentes", Icon: Bot },
  { href: "/auditoria", label: "Auditoria", Icon: ClipboardList, secondary: true },
  { href: "/configuracoes", label: "Configurações", short: "Ajustes", Icon: Settings, secondary: true },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

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
  // Ícone oficial branco para fundo escuro, garantindo que o logo nunca suma
  const isTarhget = !logoUrl || logoUrl.includes("tarhget") || name.toLowerCase().includes("tarhget");
  const src = isTarhget ? "/images/tarhget-icon-white.png" : logoUrl;
  return (
    <div className="flex shrink-0 items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className="shrink-0 object-contain drop-shadow-sm"
        style={{ width: size, height: size }}
      />
    </div>
  );
}

function PendingBadge({ count }: { count: number }) {
  return (
    <span
      className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white shadow-xs bg-[#922d25]"
    >
      {count}
    </span>
  );
}

export function GestorSidebar({
  companyName,
  companySlug = "",
  companyInitials,
  logoUrl,
  pendingCount,
  userName,
  userInitials,
  radioStation,
  canManageRadio = false,
  activeJobsCount = 0,
  totalJobsCount = 0,
  jobsToday = 0,

  logoutAction,
}: {
  companyName: string;
  companySlug?: string;
  companyInitials: string;
  logoUrl: string | null;
  pendingCount: number;
  userName: string;
  userInitials: string;
  radioStation?: RadioStation | null;
  canManageRadio?: boolean;
  activeJobsCount?: number;
  totalJobsCount?: number;
  jobsToday?: number;

  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-[#2e1d1c] bg-[#1f1110] md:flex select-none isolate overflow-x-hidden">
      {/* Topo / Logo oficial com ícone branco e tipografia serifada */}
      <div className="px-5 pt-6 pb-3 flex items-center gap-3">
        <CompanyMark name={companyName} initials={companyInitials} logoUrl={logoUrl} size={32} />
        <span className="font-serif text-[16px] font-bold tracking-[0.24em] text-white uppercase drop-shadow-xs">
          {companyName}
        </span>
      </div>

      <nav className="mt-4 flex flex-col gap-1 px-3">
        <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9d7951]">
          Recrutamento
        </p>
        {NAV.filter((item) => !("secondary" in item && item.secondary)).map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                "relative group flex h-10 items-center gap-2.5 rounded-xl px-3.5 text-[13px] transition-colors " +
                (active
                  ? "bg-[#312423] font-bold text-white shadow-xs"
                  : "text-[#dcd3ce] hover:bg-[#2b1918] hover:text-white")
              }
            >
              {active && (
                <span className="absolute -left-3 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-[#f43f5e]" aria-hidden />
              )}
              <item.Icon
                aria-hidden
                className="size-[17px] shrink-0"
                strokeWidth={active ? 2.25 : 1.75}
                style={active ? { color: "#ffffff" } : undefined}
              />
              <span className="flex-1 truncate">{item.label}</span>
              {"badge" in item && item.badge && pendingCount > 0 && <PendingBadge count={pendingCount} />}
            </Link>
          );
        })}

        <div className="mx-3 my-3 h-px bg-white/[0.08]" />
        <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9d7951]">
          Administração
        </p>
        {NAV.filter((item) => "secondary" in item && item.secondary).map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                "relative group flex h-9.5 items-center gap-2.5 rounded-xl px-3.5 text-[13px] transition-colors " +
                (active
                  ? "bg-[#312423] font-bold text-white shadow-xs"
                  : "text-[#b8aba4] hover:bg-[#2b1918] hover:text-white")
              }
            >
              {active && (
                <span className="absolute -left-3 top-1/2 -translate-y-1/2 h-4.5 w-1 rounded-r-full bg-[#f43f5e]" aria-hidden />
              )}
              <item.Icon
                aria-hidden
                className="size-[16px] shrink-0"
                strokeWidth={active ? 2.1 : 1.6}
                style={active ? { color: "#ffffff" } : undefined}
              />
              <span className="flex-1 truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto">
        {companySlug && (
          <OnlineCounterBadge
            slug={companySlug}
            variant="sidebar"
            activeJobsCount={activeJobsCount}
            totalJobsCount={totalJobsCount}
            jobsToday={jobsToday}

            userName={userName}
          />
        )}
      </div>
      <div className="mx-3 mb-3 flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#2b1918] p-2.5">
        <span
          className="flex size-[28px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-xs bg-[#922d25]"
        >
          {userInitials}
        </span>
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-stone-200">
          {userName}
        </span>
        <button
          type="button"
          onClick={() => logoutAction()}
          title="Sair"
          className="rounded-md px-2 py-1 text-[11px] font-medium text-stone-400 hover:bg-white/10 hover:text-white transition-colors"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}

export function GestorTopbar({
  companyName,
  companySlug = "",
  companyInitials,
  logoUrl,
  logoutAction,
  commandPaletteEnabled = true,
  soundEnabled = true,
}: {
  companyName: string;
  companySlug?: string;
  companyInitials: string;
  logoUrl: string | null;
  logoutAction: () => Promise<void>;
  commandPaletteEnabled?: boolean;
  soundEnabled?: boolean;
}) {
  const pathname = usePathname();
  const section = NAV.find((n) => isActive(pathname, n.href))?.label ?? "Painel";

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-[#e4e4e7] bg-white px-4 md:static md:px-8">
      <span className="flex min-w-0 items-center gap-2.5 md:hidden">
        <CompanyMark name={companyName} initials={companyInitials} logoUrl={logoUrl} size={28} />
        <span className="truncate text-[13px] font-semibold text-[#0a0a0a]">{companyName}</span>
      </span>

      <span className="hidden text-[13px] md:inline">
        <span className="text-[#71717a]">{companyName}</span>
        <span className="mx-2 text-[#71717a]">/</span>
        <span className="font-medium text-[#0a0a0a]">{section}</span>
      </span>

      <div className="flex items-center gap-2">
        <BirthdayReminderBadge />
        <LiveAttendanceTopbarButton />
        <CommandPaletteTrigger enabled={commandPaletteEnabled} />
        <SoundToggleControl enabled={soundEnabled} />
        {commandPaletteEnabled && (
          <button
            type="button"
            onClick={openCommandPalette}
            aria-label="Buscar"
            className="flex size-9 items-center justify-center rounded-lg text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#0a0a0a] sm:hidden"
          >
            <Search aria-hidden className="size-[18px]" strokeWidth={1.75} />
          </button>
        )}
        <button
          type="button"
          onClick={() => logoutAction()}
          aria-label="Sair"
          className="flex size-9 items-center justify-center rounded-lg text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#0a0a0a] md:hidden"
        >
          <LogOut aria-hidden className="size-[18px]" strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
}

export function GestorBottomNav({ pendingCount }: { pendingCount: number }) {
  const pathname = usePathname();
  const activeRef = useRef<HTMLAnchorElement>(null);

  // Uma fileira só, com rolagem lateral: com 9 itens numa grade de 7 colunas
  // a barra quebrava em duas linhas e cobria ~130px da tela do celular.
  useEffect(() => {
    // Rola só a barra (nunca a página) para deixar o item ativo à vista.
    const el = activeRef.current;
    const nav = el?.parentElement;
    if (el && nav) nav.scrollLeft = el.offsetLeft - (nav.clientWidth - el.clientWidth) / 2;
  }, [pathname]);

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 flex snap-x overflow-x-auto overscroll-x-contain border-t border-[#e4e4e7] bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.04)] backdrop-blur [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden"
    >
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            ref={active ? activeRef : undefined}
            aria-current={active ? "page" : undefined}
            className={
              // 18% de largura: cabem 5 itens e meio, e o meio item mostra que há mais ao lado.
              "relative flex h-16 min-w-[18%] shrink-0 grow snap-start flex-col items-center justify-center gap-1 whitespace-nowrap px-1 text-[10px] " +
              (active ? "font-medium text-[#0a0a0a]" : "text-[#52525b]")
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
