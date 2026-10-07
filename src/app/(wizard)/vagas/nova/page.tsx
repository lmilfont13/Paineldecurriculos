import type { Metadata } from "next";

import { JobWizard } from "@/components/gestor/job-wizard";

export const metadata: Metadata = { title: "Nova vaga · Triagem" };

// Publicar já confere o banco de talentos em segundo plano (after()).
export const maxDuration = 60;

/** E5–E8 · Nova vaga (frames 89:378..89:514 do Figma). */
export default function NovaVagaPage() {
  return <JobWizard />;
}
