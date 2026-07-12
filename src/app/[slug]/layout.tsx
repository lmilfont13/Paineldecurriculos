import { notFound } from "next/navigation";

import { getTenant } from "@/server/controllers/public.controller";
import { brandCssVars } from "@/server/models/company.model";

/**
 * Layout do fluxo público (candidato): resolve o tenant pelo slug.
 * Empresa inexistente ou desativada → 404.
 * As cores da marca ficam disponíveis como CSS vars para as telas públicas
 * (regra 4: marca do cliente só aparece aqui, nunca no painel interno).
 */
export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const company = await getTenant(slug);
  if (!company) notFound();

  return (
    <div
      className="flex min-h-screen flex-col bg-[#fafaf9]"
      style={brandCssVars(company) as React.CSSProperties}
    >
      {children}
    </div>
  );
}
