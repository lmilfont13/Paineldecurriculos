import type { Metadata } from "next";

import { AiModelForm } from "@/components/gestor/ai-model-form";
import { ModelTrialCard } from "@/components/gestor/model-trial-card";
import { SettingsTabs } from "@/components/gestor/settings-tabs";
import { getAiSettingsAction } from "@/server/controllers/settings.controller";

export const metadata: Metadata = { title: "Inteligência artificial · Triagem" };

// O teste de modelo faz ~20 chamadas de IA numa server action desta página.
export const maxDuration = 120;

export default async function IaSettingsPage() {
  const settings = await getAiSettingsAction();

  return (
    <>
      <h1 className="text-2xl font-bold text-[#0a0a0a]">Configurações</h1>
      <p className="mt-2 text-sm text-[#71717a]">Qual IA analisa os currículos e compara os candidatos.</p>
      <SettingsTabs />
      <div className="mt-8 max-w-[640px]">
        {settings && <AiModelForm current={settings.current} options={settings.options} />}
        {settings && (
          <ModelTrialCard
            options={settings.options}
            labelFor={Object.fromEntries(settings.options.map((o) => [o.id, o.label]))}
          />
        )}
      </div>
    </>
  );
}
