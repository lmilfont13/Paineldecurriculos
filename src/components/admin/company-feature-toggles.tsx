"use client";

import { useState, useTransition } from "react";
import { MessageCircle, Command, Check, GitCommit, History, Image as ImageIcon, Volume2 } from "lucide-react";
import {
  toggleCompanyWhatsappTemplatesAction,
  toggleCompanyCommandPaletteAction,
  toggleCompanyCandidateTimelineAction,
  toggleCompanyUndoActionAction,
  toggleCompanyDynamicOgAction,
  toggleCompanySoundNotificationsAction,
} from "@/server/controllers/settings.controller";

export function CompanyWhatsappTemplatesToggle({
  companyId,
  initialEnabled,
}: {
  companyId: string;
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    startTransition(async () => {
      const res = await toggleCompanyWhatsappTemplatesAction(companyId, next);
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setEnabled(!next);
      }
    });
  }

  return (
    <div className="mt-4 rounded-xl border border-[#e4e4e7] bg-white p-5 shadow-2xs">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <MessageCircle className="size-4 text-[#25D366]" />
            <span className="text-xs font-bold text-[#0a0a0a]">
              Templates Rápidos de WhatsApp com 1 Clique
            </span>
            {saved && (
              <span className="flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
                <Check className="size-2.5" /> Salvo
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-[#71717a]">
            Permite ao gestor disparar mensagens com modelos pré-configurados (agendar entrevista, pedir dados, aprovação) direto para o WhatsApp do candidato com 1 clique.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={isPending}
          onClick={handleToggle}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            enabled ? "bg-[#0a0a0a]" : "bg-[#e4e4e7]"
          } ${isPending ? "opacity-60 cursor-wait" : ""}`}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              enabled ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

export function CompanyCommandPaletteToggle({
  companyId,
  initialEnabled,
}: {
  companyId: string;
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    startTransition(async () => {
      const res = await toggleCompanyCommandPaletteAction(companyId, next);
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setEnabled(!next);
      }
    });
  }

  return (
    <div className="mt-4 rounded-xl border border-[#e4e4e7] bg-white p-5 shadow-2xs">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Command className="size-4 text-[#0a0a0a]" />
            <span className="text-xs font-bold text-[#0a0a0a]">
              Command Palette (Ctrl + K) & Busca Global
            </span>
            {saved && (
              <span className="flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
                <Check className="size-2.5" /> Salvo
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-[#71717a]">
            Habilita a barra de comandos flutuante estilo Spotlight / Linear para busca instantânea de candidatos, vagas e atalhos rápidos do painel.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={isPending}
          onClick={handleToggle}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            enabled ? "bg-[#0a0a0a]" : "bg-[#e4e4e7]"
          } ${isPending ? "opacity-60 cursor-wait" : ""}`}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              enabled ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

export function CompanyCandidateTimelineToggle({
  companyId,
  initialEnabled,
}: {
  companyId: string;
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    startTransition(async () => {
      const res = await toggleCompanyCandidateTimelineAction(companyId, next);
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setEnabled(!next);
      }
    });
  }

  return (
    <div className="mt-4 rounded-xl border border-[#e4e4e7] bg-white p-5 shadow-2xs">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <GitCommit className="size-4 text-sky-700" />
            <span className="text-xs font-bold text-[#0a0a0a]">
              Linha do Tempo Visual no Portal do Candidato
            </span>
            {saved && (
              <span className="flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
                <Check className="size-2.5" /> Salvo
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-[#71717a]">
            Exibe uma barra de progresso horizontal estilo rastreio para o candidato acompanhar em tempo real o avanço da candidatura (Recebida, Em Análise, Entrevista, Final).
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={isPending}
          onClick={handleToggle}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            enabled ? "bg-[#0a0a0a]" : "bg-[#e4e4e7]"
          } ${isPending ? "opacity-60 cursor-wait" : ""}`}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              enabled ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

export function CompanyUndoActionToggle({
  companyId,
  initialEnabled,
}: {
  companyId: string;
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    startTransition(async () => {
      const res = await toggleCompanyUndoActionAction(companyId, next);
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setEnabled(!next);
      }
    });
  }

  return (
    <div className="mt-4 rounded-xl border border-[#e4e4e7] bg-white p-5 shadow-2xs">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="size-4 text-amber-700" />
            <span className="text-xs font-bold text-[#0a0a0a]">
              Ação de Desfazer (Undo) no Funil
            </span>
            {saved && (
              <span className="flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
                <Check className="size-2.5" /> Salvo
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-[#71717a]">
            Exibe um botão de &quot;Desfazer&quot; no toast flutuante por 6 segundos sempre que um candidato for movido entre as etapas do funil.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={isPending}
          onClick={handleToggle}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            enabled ? "bg-[#0a0a0a]" : "bg-[#e4e4e7]"
          } ${isPending ? "opacity-60 cursor-wait" : ""}`}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              enabled ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

export function CompanyDynamicOgToggle({
  companyId,
  initialEnabled,
}: {
  companyId: string;
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    startTransition(async () => {
      const res = await toggleCompanyDynamicOgAction(companyId, next);
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setEnabled(!next);
      }
    });
  }

  return (
    <div className="mt-4 rounded-xl border border-[#e4e4e7] bg-white p-5 shadow-2xs">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ImageIcon className="size-4 text-indigo-700" />
            <span className="text-xs font-bold text-[#0a0a0a]">
              Cards Sociais Dinâmicos (Open Graph)
            </span>
            {saved && (
              <span className="flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
                <Check className="size-2.5" /> Salvo
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-[#71717a]">
            Gera automaticamente uma imagem de prévia (1200x630) atraente com logo da empresa, título da vaga, tags de trabalho e chamada para ação ao compartilhar no WhatsApp e LinkedIn.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={isPending}
          onClick={handleToggle}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            enabled ? "bg-[#0a0a0a]" : "bg-[#e4e4e7]"
          } ${isPending ? "opacity-60 cursor-wait" : ""}`}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              enabled ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

export function CompanySoundNotificationsToggle({
  companyId,
  initialEnabled,
}: {
  companyId: string;
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    startTransition(async () => {
      const res = await toggleCompanySoundNotificationsAction(companyId, next);
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setEnabled(!next);
      }
    });
  }

  return (
    <div className="mt-4 rounded-xl border border-[#e4e4e7] bg-white p-5 shadow-2xs">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Volume2 className="size-4 text-emerald-700" />
            <span className="text-xs font-bold text-[#0a0a0a]">
              Notificações Sonoras para Novas Candidaturas
            </span>
            {saved && (
              <span className="flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
                <Check className="size-2.5" /> Salvo
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-[#71717a]">
            Toca um som suave de sino (*chime*) gerado nativamente no navegador sempre que um novo candidato se inscrever em uma vaga enquanto o painel do gestor estiver aberto.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={isPending}
          onClick={handleToggle}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            enabled ? "bg-[#0a0a0a]" : "bg-[#e4e4e7]"
          } ${isPending ? "opacity-60 cursor-wait" : ""}`}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              enabled ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
