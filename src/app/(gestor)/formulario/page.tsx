import type { Metadata } from "next";

import { FormBuilder } from "@/components/gestor/form-builder";
import { getFormularioPageData } from "@/server/controllers/gestor.controller";

export const metadata: Metadata = { title: "Formulário · Triagem" };

/** Construtor de formulário do gestor (padrão do frame A5 do Figma). */
export default async function FormularioPage() {
  const { fields } = await getFormularioPageData();

  return (
    <>
      <h1 className="text-2xl font-bold text-[#0a0a0a]">
        Formulário de candidatura
      </h1>
      <p className="mt-2 text-sm text-[#71717a]">
        Os campos extras aparecem para o candidato nos passos “Perfil” e
        “Extras”.
      </p>
      <div className="mt-8">
        <FormBuilder fields={fields} />
      </div>
    </>
  );
}
