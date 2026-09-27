"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/configuracoes", label: "Página de carreiras" },
  { href: "/configuracoes/formulario", label: "Formulário de candidatura" },
];

/** Abas de Configurações: o que é ajuste, fora da navegação do dia a dia. */
export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-[#e4e4e7]">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              "-mb-px shrink-0 border-b-2 px-3.5 pb-2.5 pt-1 text-[13px] " +
              (active
                ? "font-medium text-[#0a0a0a]"
                : "border-transparent text-[#71717a] hover:text-[#0a0a0a]")
            }
            style={active ? { borderColor: "var(--brand-primary)" } : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
