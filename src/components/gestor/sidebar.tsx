"use client";

import { ClipboardList, LayoutDashboard, Users, Briefcase } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/painel", label: "Painel", Icon: LayoutDashboard },
  { href: "/vagas", label: "Vagas", Icon: Briefcase },
  { href: "/candidaturas", label: "Candidatos", Icon: Users, badge: true },
  { href: "/formulario", label: "Formulário", Icon: ClipboardList },
] as const;

/**
 * Sidebar do gestor (frame E1 do Figma). Painel interno é sempre neutro
 * (regra 4) — a cor da empresa aparece só no chip identificador do tenant.
 */
export function GestorSidebar({
  companyName,
  companyInitials,
  companyColor,
  pendingCount,
  userName,
  userInitials,
  logoutAction,
}: {
  companyName: string;
  companyInitials: string;
  companyColor: string;
  pendingCount: number;
  userName: string;
  userInitials: string;
  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex w-[248px] shrink-0 flex-col border-r border-[#e4e4e7] bg-[#f5f5f4]">
      <div className="m-3 flex items-center gap-2.5 rounded-lg p-2">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-[7px] text-[11px] font-bold text-white"
          style={{ backgroundColor: companyColor }}
        >
          {companyInitials}
        </span>
        <span className="min-w-0 truncate text-[13px] font-medium text-[#0a0a0a]">
          {companyName}
        </span>
      </div>

      <p className="mt-4 px-6 text-[11px] font-medium tracking-[0.8px] text-[#a1a1aa]">
        RECRUTAMENTO
      </p>
      <nav className="mt-2 flex flex-col gap-1 px-3">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                "flex h-[38px] items-center gap-2.5 rounded-lg px-3.5 text-sm " +
                (active
                  ? "bg-[#e7e5e4] font-medium text-[#0a0a0a]"
                  : "text-[#71717a] hover:bg-[#eeedec]")
              }
            >
              <item.Icon
                aria-hidden
                className="size-4 shrink-0"
                strokeWidth={active ? 2.25 : 1.75}
                style={
                  active ? { color: "var(--brand-primary)" } : undefined
                }
              />
              <span className="flex-1">{item.label}</span>
              {"badge" in item && item.badge && pendingCount > 0 && (
                <span
                  className="flex h-[18px] min-w-7 items-center justify-center rounded-full px-1.5 text-[11px] font-medium"
                  style={{
                    backgroundColor:
                      "color-mix(in srgb, var(--brand-primary) 12%, transparent)",
                    color: "var(--brand-primary)",
                  }}
                >
                  {pendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-2.5 p-3">
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

/** Topbar com breadcrumb (frame E1). */
export function GestorTopbar({ companyName }: { companyName: string }) {
  const pathname = usePathname();
  const section =
    NAV.find(
      (n) => pathname === n.href || pathname.startsWith(`${n.href}/`)
    )?.label ?? "Painel";

  return (
    <header className="flex h-14 shrink-0 items-center border-b border-[#e4e4e7] bg-white px-8">
      <span className="text-[13px] text-[#71717a]">{companyName}</span>
      <span className="mx-2 text-[13px] text-[#71717a]">/</span>
      <span className="text-[13px] font-medium text-[#0a0a0a]">{section}</span>
    </header>
  );
}
