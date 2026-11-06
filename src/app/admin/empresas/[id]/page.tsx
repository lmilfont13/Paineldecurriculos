import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CompanyTabs } from "@/components/admin/company-tabs";
import { getEmpresaDetail } from "@/server/controllers/admin.controller";
import {
  isCandidateAiRadarEnabled,
  isWhatsappTemplatesEnabled,
  isCommandPaletteEnabled,
  isCandidateTimelineEnabled,
  isUndoActionEnabled,
  isDynamicOgEnabled,
  isSoundNotificationsEnabled,
} from "@/server/services/company-feature.service";

export const metadata: Metadata = { title: "Editar empresa · Console Triagem" };

/** A7 · Editar empresa (abas). */
export default async function EditarEmpresaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getEmpresaDetail(id);
  if (!data) notFound();
  const { company, manager } = data;
  const candidateAiEnabled = await isCandidateAiRadarEnabled(company.id);
  const whatsappTemplatesEnabled = await isWhatsappTemplatesEnabled(company.id);
  const commandPaletteEnabled = await isCommandPaletteEnabled(company.id);
  const candidateTimelineEnabled = await isCandidateTimelineEnabled(company.id);
  const undoActionEnabled = await isUndoActionEnabled(company.id);
  const dynamicOgEnabled = await isDynamicOgEnabled(company.id);
  const soundNotificationsEnabled = await isSoundNotificationsEnabled(company.id);

  return (
    <>
      <Link
        href="/admin/empresas"
        className="text-[13px] font-medium text-[#71717a] hover:text-[#0a0a0a]"
      >
        ← Empresas
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-[#0a0a0a]">{company.name}</h1>
      <p className="mt-2 text-sm text-[#71717a]">
        /{company.slug} · {company.email}
      </p>
      <div className="mt-8">
        <CompanyTabs
          company={company}
          manager={manager}
          candidateAiEnabled={candidateAiEnabled}
          whatsappTemplatesEnabled={whatsappTemplatesEnabled}
          commandPaletteEnabled={commandPaletteEnabled}
          candidateTimelineEnabled={candidateTimelineEnabled}
          undoActionEnabled={undoActionEnabled}
          dynamicOgEnabled={dynamicOgEnabled}
          soundNotificationsEnabled={soundNotificationsEnabled}
        />
      </div>
    </>
  );
}
