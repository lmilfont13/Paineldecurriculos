import type { Metadata } from "next";

import { FormBuilder } from "@/components/gestor/form-builder";
import { SettingsTabs } from "@/components/gestor/settings-tabs";
import { getFormularioPageData } from "@/server/controllers/gestor.controller";

export const metadata: Metadata = { title: "Formulário · Triagem" };

/** Configurações · perguntas que o candidato responde ao se candidatar. */
export default async function FormularioPage() {
  const { fields } = await getFormularioPageData();

  return (
    <>
      <h1 className="text-2xl font-bold text-[#0a0a0a]">Configurações</h1>
      <p className="mt-2 text-sm text-[#71717a]">
        Perguntas que o candidato responde em todas as vagas. As marcadas como
        passo Perfil aparecem junto do currículo; as outras, no passo Extras.
      </p>
      <SettingsTabs />
      <div className="mt-8">
        <FormBuilder fields={fields} />
      </div>
    </>
  );
}
