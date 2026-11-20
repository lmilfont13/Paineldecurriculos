"use client";

import { useState } from "react";
import {
  X,
  Copy,
  Check,
  Download,
  Printer,
  Mail,
  Phone,
  Shirt,
  User,
  MapPin,
  FileSpreadsheet,
  MessageCircle,
  Eye,
  FileText,
  Building2,
} from "lucide-react";
import type { CompanyCandidateDossierItem } from "@/server/services/application.service";

export type CompanyDossierModalProps = {
  open: boolean;
  onClose: () => void;
  companyName: string;
  jobTitle?: string;
  candidates: CompanyCandidateDossierItem[];
};

export function CompanyDossierModal({
  open,
  onClose,
  companyName,
  jobTitle,
  candidates,
}: CompanyDossierModalProps) {
  const [copiedMode, setCopiedMode] = useState<"whatsapp" | "full" | null>(null);
  const [activeView, setActiveView] = useState<"cards" | "table" | "preview">("cards");

  if (!open || candidates.length === 0) return null;

  // Formata o texto perfeito para WhatsApp
  function formatWhatsAppText(): string {
    const header = [
      `📋 *RELATÓRIO DE CANDIDATOS — ${companyName.toUpperCase()}*`,
      jobTitle ? `*Vaga:* ${jobTitle}` : null,
      `*Total:* ${candidates.length} candidato(s) selecionado(s)`,
      `*Data:* ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date())}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ]
      .filter(Boolean)
      .join("\n");

    const body = candidates
      .map((c, i) => {
        return [
          `*${i + 1}. ${c.name.toUpperCase()}*`,
          `📧 *E-mail:* ${c.email}`,
          `📱 *Telefone:* ${c.phone}`,
          `🦺 *Fardamento:* ${c.uniform.formatted}`,
          `📍 *Localização:* ${c.location}`,
          c.cpfMasked ? `📑 *CPF:* ${c.cpfMasked}` : null,
          `📝 *Resumo Profissional:*\n${c.resumo}`,
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n\n─────────────────────────────────\n\n");

    const footer = [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Documento gerado para conferência e alinhamento de fardamento e contratação.`,
    ].join("\n");

    return `${header}\n\n${body}\n\n${footer}`;
  }

  // Formata o texto formal para E-mail
  function formatFullEmailText(): string {
    const header = [
      `RELATÓRIO DE CANDIDATOS SELECIONADOS`,
      `Empresa: ${companyName}`,
      jobTitle ? `Vaga: ${jobTitle}` : null,
      `Quantidade: ${candidates.length}`,
      `Data de emissão: ${new Intl.DateTimeFormat("pt-BR").format(new Date())}`,
      `=================================================================`,
    ]
      .filter(Boolean)
      .join("\n");

    const body = candidates
      .map((c, i) => {
        return [
          `[${i + 1}] ${c.name.toUpperCase()}`,
          `- E-mail: ${c.email}`,
          `- Telefone: ${c.phone}`,
          `- Fardamento: ${c.uniform.formatted}`,
          `- Localidade: ${c.location}`,
          c.cpfMasked ? `- CPF: ${c.cpfMasked}` : null,
          `- Resumo do Perfil:`,
          `  ${c.resumo.replace(/\n/g, "\n  ")}`,
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n\n-----------------------------------------------------------------\n\n");

    return `${header}\n\n${body}`;
  }

  function handleCopy(mode: "whatsapp" | "full") {
    const text = mode === "whatsapp" ? formatWhatsAppText() : formatFullEmailText();
    navigator.clipboard.writeText(text).then(() => {
      setCopiedMode(mode);
      setTimeout(() => setCopiedMode(null), 3000);
    });
  }

  function handleExportCsv() {
    const headers = [
      "Nome",
      "E-mail",
      "Telefone",
      "Fardamento Completo",
      "Bota",
      "Calça",
      "Camisa",
      "Cidade / UF",
      "Vaga",
      "Resumo Profissional",
    ];

    const rows = candidates.map((c) => [
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.email.replace(/"/g, '""')}"`,
      `"${c.phone.replace(/"/g, '""')}"`,
      `"${c.uniform.formatted.replace(/"/g, '""')}"`,
      `"${c.uniform.bootSize || ""}"`,
      `"${c.uniform.pantsSize || ""}"`,
      `"${c.uniform.shirtSize || ""}"`,
      `"${c.location.replace(/"/g, '""')}"`,
      `"${(c.jobTitle || jobTitle || "").replace(/"/g, '""')}"`,
      `"${c.resumo.replace(/\r?\n/g, " ").replace(/"/g, '""')}"`,
    ]);

    // BOM UTF-8 (\uFEFF) para abrir no Excel em português sem quebrar caracteres
    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const filename = `candidatos_${companyName.toLowerCase().replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/70 p-3 sm:p-6 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative my-auto flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-300 bg-white shadow-2xl overflow-hidden print:max-h-none print:shadow-none print:border-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABEÇALHO DO MODAL */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-100 px-5 py-4 print:bg-white print:border-b-2 print:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-white shadow-xs print:hidden">
              <Building2 className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Dossiê Executivo para Empresa
                </span>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700 tabular-nums">
                  {candidates.length} candidato{candidates.length > 1 ? "s" : ""}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                {companyName} {jobTitle ? `· ${jobTitle}` : ""}
              </h2>
            </div>
          </div>

          {/* Botões de Ação de Topo */}
          <div className="flex items-center gap-2 print:hidden">
            <div className="hidden sm:flex rounded-lg border border-slate-300 bg-white p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveView("cards")}
                className={`px-3 py-1 rounded-md transition ${
                  activeView === "cards"
                    ? "bg-slate-800 text-white font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Fichas
              </button>
              <button
                type="button"
                onClick={() => setActiveView("table")}
                className={`px-3 py-1 rounded-md transition ${
                  activeView === "table"
                    ? "bg-slate-800 text-white font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Tabela
              </button>
              <button
                type="button"
                onClick={() => setActiveView("preview")}
                className={`px-3 py-1 rounded-md transition ${
                  activeView === "preview"
                    ? "bg-slate-800 text-white font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Prévia Texto
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
            >
              <X className="size-5" />
            </button>
          </div>
        </header>

        {/* BARRA DE AÇÕES RÁPIDAS DE COMPARTILHAMENTO */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-xs print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleCopy("whatsapp")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-bold transition shadow-2xs ${
                copiedMode === "whatsapp"
                  ? "bg-emerald-600 text-white"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              }`}
            >
              {copiedMode === "whatsapp" ? (
                <>
                  <Check className="size-3.5" />
                  <span>Copiado p/ WhatsApp!</span>
                </>
              ) : (
                <>
                  <MessageCircle className="size-3.5" />
                  <span>Copiar p/ WhatsApp</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleCopy("full")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
            >
              {copiedMode === "full" ? (
                <>
                  <Check className="size-3.5 text-emerald-600" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5 text-slate-500" />
                  <span>Copiar p/ E-mail</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
              title="Baixar planilha compatível com Excel (.csv UTF-8)"
            >
              <FileSpreadsheet className="size-3.5 text-emerald-700" />
              <span>Baixar Planilha</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
              title="Imprimir ou Salvar em PDF"
            >
              <Printer className="size-3.5 text-slate-600" />
              <span>Imprimir / PDF</span>
            </button>
          </div>
        </div>

        {/* CONTEÚDO SCROLLÁVEL */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* VISUALIZAÇÃO 1: FICHAS EXECUTIVAS (CARDS) */}
          {activeView === "cards" && (
            <div className="grid grid-cols-1 gap-4">
              {candidates.map((c, idx) => (
                <article
                  key={c.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-slate-300 print:border-b print:rounded-none print:shadow-none"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-2.5 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-white">
                        {idx + 1}
                      </span>
                      <h3 className="text-base font-extrabold uppercase tracking-tight text-slate-900">
                        {c.name}
                      </h3>
                    </div>
                    {c.jobTitle && (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        {c.jobTitle}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 text-xs">
                    {/* Contatos */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Mail className="size-3.5 text-slate-400 shrink-0" />
                        <a href={`mailto:${c.email}`} className="truncate hover:underline">
                          {c.email}
                        </a>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Phone className="size-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold">{c.phone}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <MapPin className="size-3.5 text-slate-400 shrink-0" />
                        <span>{c.location}</span>
                      </div>
                    </div>

                    {/* Fardamento */}
                    <div className="rounded-lg bg-amber-50/70 border border-amber-200/80 p-2.5">
                      <div className="flex items-center gap-1.5 font-bold text-amber-900 uppercase tracking-wider text-[10px] mb-1">
                        <Shirt className="size-3 text-amber-700" />
                        <span>Fardamento & Medidas</span>
                      </div>
                      <p className="font-semibold text-slate-800 leading-snug">
                        {c.uniform.formatted}
                      </p>
                    </div>

                    {/* Dados Adicionais */}
                    <div className="space-y-1 text-slate-600">
                      {c.cpfMasked && (
                        <div>
                          CPF: <strong className="font-mono text-slate-800">{c.cpfMasked}</strong>
                        </div>
                      )}
                      {c.rg && (
                        <div>
                          RG: <strong className="font-mono text-slate-800">{c.rg}</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Resumo do Candidato */}
                  <div className="mt-3 border-t border-slate-100 pt-2.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Resumo Profissional / Qualificações
                    </p>
                    <p className="text-xs leading-relaxed text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                      {c.resumo}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* VISUALIZAÇÃO 2: TABELA CORPORATIVA */}
          {activeView === "table" && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    <th className="px-3.5 py-2.5">#</th>
                    <th className="px-3.5 py-2.5">Nome</th>
                    <th className="px-3.5 py-2.5">E-mail</th>
                    <th className="px-3.5 py-2.5">Telefone</th>
                    <th className="px-3.5 py-2.5">Fardamento</th>
                    <th className="px-3.5 py-2.5">Local</th>
                    <th className="px-3.5 py-2.5">Resumo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {candidates.map((c, idx) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-3.5 py-2.5 font-bold text-slate-400">{idx + 1}</td>
                      <td className="px-3.5 py-2.5 font-bold text-slate-900 whitespace-nowrap">
                        {c.name}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-600">{c.email}</td>
                      <td className="px-3.5 py-2.5 font-semibold text-slate-700 whitespace-nowrap">
                        {c.phone}
                      </td>
                      <td className="px-3.5 py-2.5 font-bold text-amber-900 bg-amber-50/40 whitespace-nowrap">
                        {c.uniform.formatted}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-600 whitespace-nowrap">
                        {c.location}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-600 max-w-xs truncate" title={c.resumo}>
                        {c.resumo}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* VISUALIZAÇÃO 3: PRÉVIA DO TEXTO (WHATSAPP / E-MAIL) */}
          {activeView === "preview" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                  Prévia do Texto Formatado para WhatsApp
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy("whatsapp")}
                  className="text-xs font-bold text-emerald-700 hover:underline"
                >
                  Copiar este texto
                </button>
              </div>
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-800 bg-slate-900 text-slate-100 p-4 rounded-xl border border-slate-700 max-h-[500px] overflow-y-auto">
                {formatWhatsAppText()}
              </pre>
            </div>
          )}
        </div>

        {/* RODAPÉ DO MODAL */}
        <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500 print:hidden">
          <span>
            {candidates.length} candidato{candidates.length > 1 ? "s" : ""} pronto{candidates.length > 1 ? "s" : ""} para envio.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 transition"
          >
            Fechar
          </button>
        </footer>
      </div>
    </div>
  );
}
