import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getTenant } from "@/server/controllers/public.controller";
import { brandCssVars } from "@/server/models/company.model";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const company = await getTenant(slug);
  if (!company) return {};
  return {
    title: `Vagas · ${company.name}`,
    description: company.heroSubtitle,
    ...(company.logoUrl ? { icons: { icon: company.logoUrl } } : {}),
  };
}

/**
 * Layout do fluxo público (candidato): resolve o tenant pelo slug.
 * Empresa inexistente ou desativada → 404.
 * As cores da marca ficam disponíveis como CSS vars para as telas públicas
 * (regra 4). Fundo levemente quente, para o bordô não brigar com um branco frio.
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
      className="flex min-h-screen flex-col bg-[#faf8f6] text-[#1c1917]"
      style={brandCssVars(company) as React.CSSProperties}
    >
      {children}
    </div>
  );
}
