"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Sidebar do console admin (frames A1/A5 do Figma) — sempre escura/neutra. */
export function AdminSidebar({
  companyCount,
  adminEmail,
  adminName,
  logoutAction,
}: {
  companyCount: number;
  adminEmail: string;
  adminName: string;
  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const empresasActive = pathname.startsWith("/admin/empresas");

  return (
    <aside className="flex w-[248px] shrink-0 flex-col bg-[#1c1917]">
      <div className="flex items-center gap-2.5 p-4">
        <span className="flex size-8 items-center justify-center rounded-[7px] bg-[#fafaf9] text-[13px] text-[#1c1917]">
          ▲
        </span>
        <span>
          <span className="block text-sm font-bold text-[#fafaf9]">
            Triagem
          </span>
          <span className="block text-[11px] text-[#fafaf9]/40">
            Console interno
          </span>
        </span>
      </div>

      <p className="mt-4 px-6 text-[11px] font-medium tracking-[0.8px] text-[#fafaf9]/30">
        PLATAFORMA
      </p>
      <nav className="mt-2 flex flex-col gap-1 px-3">
        <Link
          href="/admin/empresas"
          className={
            "flex h-[38px] items-center gap-2.5 rounded-lg px-3.5 text-sm " +
            (empresasActive
              ? "bg-[#37322e] font-medium text-[#fafaf9]"
              : "text-[#fafaf9]/55 hover:bg-[#2a2724]")
          }
        >
          <span
            className={
              "size-4 rounded " +
              (empresasActive ? "bg-[#fafaf9]/85" : "bg-[#fafaf9]/35")
            }
          />
          <span className="flex-1">Empresas</span>
          <span className="flex h-[18px] min-w-[26px] items-center justify-center rounded-full bg-[#fafaf9]/12 px-1.5 text-[11px] font-medium text-[#fafaf9]">
            {companyCount}
          </span>
        </Link>
        {["Faturamento", "Atividade"].map((label) => (
          <span
            key={label}
            title="Em breve"
            className="flex h-[38px] cursor-not-allowed items-center gap-2.5 rounded-lg px-3.5 text-sm text-[#fafaf9]/55"
          >
            <span className="size-4 rounded bg-[#fafaf9]/35" />
            {label}
          </span>
        ))}
      </nav>

      <div className="mt-auto flex items-center gap-2.5 p-3">
        <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-[#37322e] text-[10px] font-bold text-white">
          {adminName.slice(0, 2).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-[#fafaf9]">
            {adminName}
          </span>
          <span className="block truncate text-[11px] text-[#fafaf9]/40">
            {adminEmail}
          </span>
        </span>
        <button
          type="button"
          onClick={() => logoutAction()}
          title="Sair"
          className="rounded-md px-2 py-1 text-[11px] font-medium text-[#fafaf9]/55 hover:bg-[#2a2724] hover:text-[#fafaf9]"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}

/** Topbar/breadcrumb do console. */
export function AdminTopbar() {
  const pathname = usePathname();
  const trail = pathname.startsWith("/admin/empresas/nova")
    ? ["Empresas", "Nova"]
    : pathname.startsWith("/admin/empresas/") &&
        pathname !== "/admin/empresas"
      ? ["Empresas", "Editar"]
      : ["Empresas"];

  return (
    <header className="flex h-14 shrink-0 items-center border-b border-[#e4e4e7] bg-white px-8">
      <span className="text-[13px] text-[#71717a]">Console</span>
      {trail.map((part, i) => (
        <span key={part} className="flex items-center">
          <span className="mx-2 text-[13px] text-[#71717a]">/</span>
          <span
            className={
              "text-[13px] " +
              (i === trail.length - 1
                ? "font-medium text-[#0a0a0a]"
                : "text-[#71717a]")
            }
          >
            {part}
          </span>
        </span>
      ))}
    </header>
  );
}
