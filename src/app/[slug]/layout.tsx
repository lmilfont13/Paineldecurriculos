import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getTenant, getPublicSession } from "@/server/controllers/public.controller";
import { getActiveRadioStation, getActiveRadioPlaylist } from "@/server/services/message-template.service";
import { isTargetRadioSpotsEnabled } from "@/server/services/company-feature.service";
import { CandidateRadioPlayer } from "@/components/public/candidate-radio-player";
import { AttributionTracker } from "@/components/public/attribution-tracker";
import { PublicPresenceTracker } from "@/components/gestor/online-presence";
import { brandCssVars, isHiddenFromDirectory } from "@/server/models/company.model";

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
    // Empresa de demonstração: acessível por link, mas fora do Google.
    ...(isHiddenFromDirectory(company.slug) ? { robots: { index: false, follow: false } } : {}),
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
  const candidate = await getPublicSession();
  const [radioStation, spotsEnabled, customPlaylist] = await Promise.all([
    getActiveRadioStation(company.id),
    isTargetRadioSpotsEnabled(company.id),
    getActiveRadioPlaylist(company.id),
  ]);

  return (
    <div
      className="flex min-h-screen flex-col bg-[#faf8f6] text-[#1c1917] pb-24"
      style={brandCssVars(company) as React.CSSProperties}
    >
      <AttributionTracker />
      <PublicPresenceTracker slug={company.slug} candidateName={candidate?.name} />
      {children}
      <CandidateRadioPlayer
        station={radioStation}
        companyName={company.name}
        companySlug={company.slug}
        spotsEnabled={spotsEnabled}
        playlist={customPlaylist}
      />
    </div>
  );
}
