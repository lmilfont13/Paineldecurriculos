import type { Metadata } from "next";

import { CompanyAiRadarToggle } from "@/components/admin/company-ai-radar-toggle";
import {
  CompanyCandidateTimelineToggle,
  CompanyCommandPaletteToggle,
  CompanyDynamicOgToggle,
  CompanyLiveSupportSpaceToggle,
  CompanySoundNotificationsToggle,
  CompanyTargetRadioSpotsToggle,
  CompanyUndoActionToggle,
  CompanyWhatsappTemplatesToggle,
} from "@/components/admin/company-feature-toggles";
import { SettingsTabs } from "@/components/gestor/settings-tabs";
import { requireManager } from "@/server/controllers/guards";
import {
  isCandidateAiRadarEnabled,
  isCandidateTimelineEnabled,
  isCommandPaletteEnabled,
  isDynamicOgEnabled,
  isLiveSupportSpaceEnabled,
  isSoundNotificationsEnabled,
  isTargetRadioSpotsEnabled,
  isUndoActionEnabled,
  isWhatsappTemplatesEnabled,
} from "@/server/services/company-feature.service";

export const metadata: Metadata = {
  title: "Recursos & Módulos · Triagem",
};

export default async function RecursosSettingsPage() {
  const user = await requireManager();
  const companyId = user.companyId;

  const [
    candidateAiEnabled,
    whatsappTemplatesEnabled,
    commandPaletteEnabled,
    candidateTimelineEnabled,
    undoActionEnabled,
    dynamicOgEnabled,
    soundNotificationsEnabled,
    targetRadioSpotsEnabled,
    liveSupportSpaceEnabled,
  ] = await Promise.all([
    isCandidateAiRadarEnabled(companyId),
    isWhatsappTemplatesEnabled(companyId),
    isCommandPaletteEnabled(companyId),
    isCandidateTimelineEnabled(companyId),
    isUndoActionEnabled(companyId),
    isDynamicOgEnabled(companyId),
    isSoundNotificationsEnabled(companyId),
    isTargetRadioSpotsEnabled(companyId),
    isLiveSupportSpaceEnabled(companyId),
  ]);

  return (
    <>
      <h1 className="text-2xl font-bold text-[#0a0a0a]">Configurações</h1>
      <p className="mt-2 text-sm text-[#71717a]">
        Ative ou desative recursos, módulos operacionais e spots de rádio para sua empresa.
      </p>
      <SettingsTabs />

      <div className="mt-8 max-w-[640px] space-y-4">
        <div>
          <h3 className="text-sm font-bold text-[#0a0a0a]">
            Recursos da Empresa & Painel do Candidato
          </h3>
          <p className="mt-1 text-xs text-[#71717a]">
            As alterações são salvas automaticamente em tempo real para a sua empresa.
          </p>
        </div>

        <CompanyLiveSupportSpaceToggle
          companyId={companyId}
          initialEnabled={liveSupportSpaceEnabled}
        />
        <CompanyTargetRadioSpotsToggle
          companyId={companyId}
          initialEnabled={targetRadioSpotsEnabled}
        />
        <CompanyWhatsappTemplatesToggle
          companyId={companyId}
          initialEnabled={whatsappTemplatesEnabled}
        />
        <CompanySoundNotificationsToggle
          companyId={companyId}
          initialEnabled={soundNotificationsEnabled}
        />
        <CompanyCandidateTimelineToggle
          companyId={companyId}
          initialEnabled={candidateTimelineEnabled}
        />
        <CompanyUndoActionToggle
          companyId={companyId}
          initialEnabled={undoActionEnabled}
        />
        <CompanyDynamicOgToggle
          companyId={companyId}
          initialEnabled={dynamicOgEnabled}
        />
        <CompanyCommandPaletteToggle
          companyId={companyId}
          initialEnabled={commandPaletteEnabled}
        />
        <CompanyAiRadarToggle
          companyId={companyId}
          initialEnabled={candidateAiEnabled}
        />
      </div>
    </>
  );
}

