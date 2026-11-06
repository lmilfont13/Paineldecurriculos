"use client";

import { useState } from "react";
import { MessageCircle, Copy, Check, ExternalLink, X, Calendar, FileText, Award, FolderHeart, Edit3 } from "lucide-react";
import { whatsappUrl } from "@/server/models/contact-channels.model";

interface WhatsAppQuickTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateName: string;
  candidatePhone?: string | null;
  jobTitle: string;
  companyName: string;
  managerName?: string;
}

interface TemplateOption {
  id: string;
  label: string;
  icon: typeof Calendar;
  description: string;
  template: (vars: { firstName: string; jobTitle: string; companyName: string; managerName: string }) => string;
}

const TEMPLATES: TemplateOption[] = [
  {
    id: "interview",
    label: "Agendar Entrevista",
    icon: Calendar,
    description: "Convidar para conversar sobre a vaga",
    template: ({ firstName, jobTitle, companyName, managerName }) =>
      `Olá, ${firstName}! Tudo bem?\n\nAqui é ${managerName || "da equipe de seleção"} da ${companyName}. Avaliamos seu currículo para a vaga de *${jobTitle}* e seu perfil chamou bastante nossa atenção!\n\nGostaríamos de agendar uma entrevista com você. Qual seria o melhor dia e horário para conversarmos?`,
  },
  {
    id: "info",
    label: "Solicitar Informações",
    icon: FileText,
    description: "Pedir dados ou esclarecimentos rápidos",
    template: ({ firstName, jobTitle, companyName }) =>
      `Olá, ${firstName}! Tudo bem?\n\nEstamos avaliando sua candidatura para a vaga de *${jobTitle}* na ${companyName} e gostaríamos de tirar algumas dúvidas rápidas para dar andamento no processo. Podemos falar por aqui?`,
  },
  {
    id: "advance",
    label: "Avanço de Etapa",
    icon: Award,
    description: "Notificar aprovação para a próxima fase",
    template: ({ firstName, jobTitle, companyName }) =>
      `Olá, ${firstName}! Passando para dar uma ótima notícia: seu perfil foi aprovado e você avançou para a próxima etapa do processo seletivo para *${jobTitle}* na ${companyName}! 🚀\n\nEm breve entraremos em contato com as orientações do próximo passo.`,
  },
  {
    id: "standby",
    label: "Banco de Talentos",
    icon: FolderHeart,
    description: "Agradecer e manter no banco prioritário",
    template: ({ firstName, jobTitle, companyName }) =>
      `Olá, ${firstName}! Agradecemos imensamente por sua participação no processo seletivo para *${jobTitle}* na ${companyName}.\n\nSeu currículo foi muito elogiado e foi adicionado ao nosso Banco de Talentos prioritário para novas oportunidades. Desejamos muito sucesso!`,
  },
  {
    id: "custom",
    label: "Mensagem Livre",
    icon: Edit3,
    description: "Escrever uma mensagem personalizada",
    template: ({ firstName, companyName }) =>
      `Olá, ${firstName}! Tudo bem? Entrando em contato sobre sua candidatura na ${companyName}.`,
  },
];

export function WhatsAppQuickTemplatesModal({
  isOpen,
  onClose,
  candidateName,
  candidatePhone,
  jobTitle,
  companyName,
  managerName,
}: WhatsAppQuickTemplatesModalProps) {
  const firstName = candidateName.trim().split(" ")[0] || "Candidato";
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("interview");

  const initialText =
    TEMPLATES.find((t) => t.id === "interview")?.template({
      firstName,
      jobTitle,
      companyName,
      managerName: managerName || "",
    }) || "";

  const [messageText, setMessageText] = useState(initialText);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  function handleSelectTemplate(t: TemplateOption) {
    setSelectedTemplateId(t.id);
    setMessageText(
      t.template({
        firstName,
        jobTitle,
        companyName,
        managerName: managerName || "",
      })
    );
  }

  function handleCopy() {
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const waUrl = whatsappUrl(candidatePhone, messageText);
  const hasValidPhone = Boolean(waUrl);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Modelos de mensagem para WhatsApp"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#e4e4e7] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e4e4e7] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-xl bg-[#25D366]/15 text-[#25D366]">
              <MessageCircle className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#0a0a0a]">
                Mensagem WhatsApp com 1 Clique
              </h2>
              <p className="text-xs text-[#71717a]">
                Para: <span className="font-semibold text-[#0a0a0a]">{candidateName}</span>
                {candidatePhone ? ` (${candidatePhone})` : " (sem telefone cadastrado)"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[#a1a1aa] hover:bg-[#f4f4f5] hover:text-[#0a0a0a]"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Templates selector */}
        <div className="border-b border-[#e4e4e7] bg-[#fafaf9] p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#a1a1aa]">
            Selecione o modelo
          </p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {TEMPLATES.slice(0, 4).map((t) => {
              const isSelected = selectedTemplateId === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSelectTemplate(t)}
                  className={`flex flex-col items-start rounded-xl p-2.5 text-left text-xs transition-colors ${
                    isSelected
                      ? "border border-[#25D366] bg-white font-medium text-[#0a0a0a] shadow-xs"
                      : "border border-transparent bg-transparent text-[#71717a] hover:bg-white hover:text-[#0a0a0a]"
                  }`}
                >
                  <Icon className={`size-3.5 mb-1 ${isSelected ? "text-[#25D366]" : "text-[#71717a]"}`} />
                  <span className="truncate w-full">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Message editor */}
        <div className="p-5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[#0a0a0a]">
              Texto da mensagem (editável antes de enviar):
            </span>
            <textarea
              rows={6}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="w-full rounded-xl border border-[#e4e4e7] p-3 text-xs leading-relaxed text-[#0a0a0a] focus:border-[#25D366] focus:outline-none focus:ring-1 focus:ring-[#25D366]"
            />
          </label>

          {!hasValidPhone && (
            <p className="mt-2 rounded-lg bg-[#fff7ed] p-2 text-[11px] text-[#c2410c]">
              ⚠️ Este candidato não possui um número de telefone válido cadastrado. Você ainda pode copiar o texto da mensagem abaixo para usar em outro canal.
            </p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-[#e4e4e7] bg-[#fafaf9] px-5 py-3.5">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-xl border border-[#e4e4e7] bg-white px-3 py-2 text-xs font-medium text-[#0a0a0a] hover:bg-[#f4f4f5]"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-[#15803d]" />
                <span className="text-[#15803d]">Texto copiado!</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5 text-[#71717a]" />
                <span>Copiar texto</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-3 py-2 text-xs font-medium text-[#71717a] hover:text-[#0a0a0a]"
            >
              Cancelar
            </button>

            {hasValidPhone && waUrl ? (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="flex items-center gap-1.5 rounded-xl bg-[#25D366] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#20bd5a] transition-colors"
              >
                <MessageCircle className="size-4" />
                <span>Abrir no WhatsApp</span>
                <ExternalLink className="size-3" />
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="flex items-center gap-1.5 rounded-xl bg-[#e4e4e7] px-4 py-2 text-xs font-semibold text-[#a1a1aa] cursor-not-allowed"
              >
                <MessageCircle className="size-4" />
                <span>Sem WhatsApp</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Botão para abrir o modal de templates rápidos de WhatsApp */
export function WhatsAppQuickButton({
  candidateName,
  candidatePhone,
  jobTitle,
  companyName,
  managerName,
  enabled = true,
}: {
  candidateName: string;
  candidatePhone?: string | null;
  jobTitle: string;
  companyName: string;
  managerName?: string;
  enabled?: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  if (!enabled) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        title="Enviar mensagem com modelo pronto via WhatsApp"
        className="inline-flex items-center gap-1.5 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-1.5 text-xs font-semibold text-[#15803d] shadow-2xs hover:bg-[#dcfce7] transition-colors"
      >
        <MessageCircle className="size-3.5 text-[#25D366]" />
        <span>WhatsApp</span>
      </button>

      <WhatsAppQuickTemplatesModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        candidateName={candidateName}
        candidatePhone={candidatePhone}
        jobTitle={jobTitle}
        companyName={companyName}
        managerName={managerName}
      />
    </>
  );
}

