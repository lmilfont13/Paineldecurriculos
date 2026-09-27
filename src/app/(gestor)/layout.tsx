import type { Metadata } from "next";

import {
  GestorBottomNav,
  GestorSidebar,
  GestorTopbar,
} from "@/components/gestor/sidebar";
import { logoutAction } from "@/server/controllers/auth.controller";
import { getGestorShell } from "@/server/controllers/gestor.controller";
import { brandCssVars } from "@/server/models/company.model";
import { personInitials } from "@/server/models/dashboard.model";

export async function generateMetadata(): Promise<Metadata> {
  const { company } = await getGestorShell();
  return company.logoUrl ? { icons: { icon: company.logoUrl } } : {};
}

/**
 * Shell da área do gestor (regra 4): base neutra com a marca do cliente
 * nos acentos-chave (botões primários, estados ativos) via CSS vars --brand-*.
 * No celular a lateral vira barra inferior, porque é pelo telefone que o dono
 * olha quem chegou.
 */
export default async function GestorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, company, pendingCount } = await getGestorShell();
  const userName = user.name ?? user.email;
  const companyInitials = personInitials(company.name);

  return (
    <div
      className="flex min-h-screen bg-[#fafaf9]"
      style={brandCssVars(company) as React.CSSProperties}
    >
      <GestorSidebar
        companyName={company.name}
        companyInitials={companyInitials}
        logoUrl={company.logoUrl}
        pendingCount={pendingCount}
        userName={userName}
        userInitials={personInitials(userName)}
        logoutAction={logoutAction}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <GestorTopbar
          companyName={company.name}
          companyInitials={companyInitials}
          logoUrl={company.logoUrl}
          logoutAction={logoutAction}
        />
        <main className="flex-1 overflow-x-hidden px-4 pb-28 pt-6 md:px-10 md:pb-12 md:pt-9 lg:px-12">
          {children}
        </main>
      </div>
      <GestorBottomNav pendingCount={pendingCount} />
    </div>
  );
}
