import type { Metadata } from "next";

import { CareersPageForm } from "@/components/gestor/careers-page-form";
import { SettingsTabs } from "@/components/gestor/settings-tabs";
import { getConfiguracoesData } from "@/server/controllers/gestor.controller";

export const metadata: Metadata = { title: "Configurações · Triagem" };

/** Configurações · a vitrine da empresa, nas mãos de quem é dono dela. */
export default async function ConfiguracoesPage() {
  const { company, publicUrl } = await getConfiguracoesData();

  return (
    <>
      <h1 className="text-2xl font-bold text-[#0a0a0a]">Configurações</h1>
      <p className="mt-2 text-sm text-[#71717a]">
        Como a {company.name} aparece para quem procura vaga.
      </p>
      <SettingsTabs />
      <div className="mt-8">
        <CareersPageForm
          company={{
            name: company.name,
            heroTitle: company.heroTitle,
            heroSubtitle: company.heroSubtitle,
            aboutText: company.aboutText,
            primaryColor: company.primaryColor,
            logoUrl: company.logoUrl,
            logoFullUrl: company.logoFullUrl,
          }}
          publicUrl={publicUrl}
        />
      </div>
    </>
  );
}
