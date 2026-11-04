import type { Metadata } from "next";

import { ReferrerManager } from "@/components/gestor/referrer-manager";
import { SettingsTabs } from "@/components/gestor/settings-tabs";
import { getIndicadoresPageData } from "@/server/controllers/referrer.controller";

export const metadata: Metadata = { title: "Indicadores · Triagem" };

/** Configurações → Indicadores: links de indicação para funcionários. */
export default async function IndicadoresPage() {
  const { companySlug, appUrl } = await getIndicadoresPageData();

  return (
    <>
      <h1 className="text-2xl font-bold text-[#0a0a0a]">Configurações</h1>
      <p className="mt-2 text-sm text-[#71717a]">
        Crie links de indicação para funcionários e acompanhe quem indica mais.
      </p>
      <SettingsTabs />
      <div className="mt-8">
        <ReferrerManager companySlug={companySlug} appUrl={appUrl} />
      </div>
    </>
  );
}
