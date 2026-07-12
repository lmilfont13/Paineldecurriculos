import { GestorSidebar, GestorTopbar } from "@/components/gestor/sidebar";
import { logoutAction } from "@/server/controllers/auth.controller";
import { getGestorShell } from "@/server/controllers/gestor.controller";
import { brandCssVars } from "@/server/models/company.model";
import { personInitials } from "@/server/models/dashboard.model";

/**
 * Shell da área do gestor (regra 4): base neutra com a marca do cliente
 * nos acentos-chave (botões primários, estados ativos) via CSS vars --brand-*.
 */
export default async function GestorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, company, pendingCount } = await getGestorShell();
  const userName = user.name ?? user.email;

  return (
    <div
      className="flex min-h-screen bg-[#fafaf9]"
      style={brandCssVars(company) as React.CSSProperties}
    >
      <GestorSidebar
        companyName={company.name}
        companyInitials={personInitials(company.name)}
        companyColor={company.primaryColor}
        pendingCount={pendingCount}
        userName={userName}
        userInitials={personInitials(userName)}
        logoutAction={logoutAction}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <GestorTopbar companyName={company.name} />
        <main className="flex-1 overflow-x-auto px-12 py-9">{children}</main>
      </div>
    </div>
  );
}
