import { getGestorShell } from "@/server/controllers/gestor.controller";
import { brandCssVars } from "@/server/models/company.model";
import { personInitials } from "@/server/models/dashboard.model";

/**
 * Shell dos wizards do gestor (E5–E8): rail mínimo à esquerda,
 * sem a sidebar completa (frame 89:458 do Figma).
 */
export default async function WizardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { company } = await getGestorShell();

  return (
    <div
      className="flex min-h-screen bg-[#fafaf9]"
      style={brandCssVars(company) as React.CSSProperties}
    >
      <aside className="w-[72px] shrink-0 border-r border-[#e4e4e7] bg-[#f5f5f4] p-5">
        <span
          className="flex size-8 items-center justify-center rounded-[7px] text-[11px] font-bold text-white"
          style={{ backgroundColor: company.primaryColor }}
        >
          {personInitials(company.name)}
        </span>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
