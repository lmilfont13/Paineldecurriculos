"use client";

import { useState } from "react";
import {
  X,
  Copy,
  Check,
  Printer,
  Mail,
  Phone,
  Shirt,
  MapPin,
  FileSpreadsheet,
  MessageCircle,
  Building2,
  Calendar,
  FileCheck2,
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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [activeView, setActiveView] = useState<"standard" | "cards" | "table">("standard");

  if (!open || candidates.length === 0) return null;

  // Formata o candidato no padrão oficial exato da Ever e Grupo GPS
  function formatCandidateStandard(c: CompanyCandidateDossierItem): string {
    return [
      `Nome completo: ${c.name}`,
      `CPF: ${c.cpf}`,
      `RG: ${c.rg}`,
      `Data de nascimento: ${c.birthDateFormatted}`,
      `• CONTATOS:`,
      `Telefone: ${c.phone}`,
      `E-mail: ${c.email}`,
      `• INFORMAÇÕES ADICIONAIS`,
      `Uniforme: ${c.uniform.formatted}`,
      `Possui conta no Itaú?: ${c.itauAccount}`,
      `Endereço completo: ${c.fullAddress}`,
      `• PARECER: ${c.parecerText}`,
      `Principais Clientes/Marcas Atendidas: ${c.companiesAttended}`,
    ].join("\n");
  }

  // Formata todos os candidatos selecionados no padrão Ever / GPS
  function formatAllCandidatesStandard(): string {
    return candidates
      .map((c) => formatCandidateStandard(c))
      .join("\n\n──────────────────────────────────────────────\n\n");
  }

  function handleCopyAll() {
    const text = formatAllCandidatesStandard();
    navigator.clipboard.writeText(text).then(() => {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 3000);
    });
  }

  function handleCopySingle(c: CompanyCandidateDossierItem) {
    const text = formatCandidateStandard(c);
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(c.id);
      setTimeout(() => setCopiedId(null), 3000);
    });
  }

  function handleExportCsv() {
    const headers = [
      "Nome Completo",
      "CPF",
      "RG",
      "Data de Nascimento",
      "Telefone",
      "E-mail",
      "Uniforme",
      "Conta no Itaú",
      "Endereço Completo",
      "Parecer",
      "Principais Clientes/Marcas Atendidas",
    ];

    const rows = candidates.map((c) => [
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.cpf.replace(/"/g, '""')}"`,
      `"${c.rg.replace(/"/g, '""')}"`,
      `"${c.birthDateFormatted.replace(/"/g, '""')}"`,
      `"${c.phone.replace(/"/g, '""')}"`,
      `"${c.email.replace(/"/g, '""')}"`,
      `"${c.uniform.formatted.replace(/"/g, '""')}"`,
      `"${c.itauAccount.replace(/"/g, '""')}"`,
      `"${c.fullAddress.replace(/"/g, '""')}"`,
      `"${c.parecerText.replace(/\r?\n/g, " ").replace(/"/g, '""')}"`,
      `"${c.companiesAttended.replace(/\r?\n/g, " ").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const filename = `resumo_candidatos_${companyName.toLowerCase().replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
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
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/70 p-2 sm:p-4 md:p-6 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative my-auto flex max-h-[94vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-300 bg-white shadow-2xl overflow-hidden print:max-h-none print:shadow-none print:border-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABEÇALHO DO MODAL */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-100 px-5 py-3.5 print:bg-white print:border-b-2 print:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-white shadow-xs print:hidden">
              <Building2 className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Modelo Oficial p/ Envio (Padrão Ever / Grupo GPS)
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

          {/* Alternância de Abas e Fechar */}
          <div className="flex items-center gap-2 print:hidden">
            <div className="hidden sm:flex rounded-lg border border-slate-300 bg-white p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveView("standard")}
                className={`px-3 py-1 rounded-md transition ${
                  activeView === "standard"
                    ? "bg-slate-800 text-white font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Padrão Ever/GPS
              </button>
              <button
                type="button"
                onClick={() => setActiveView("cards")}
                className={`px-3 py-1 rounded-md transition ${
                  activeView === "cards"
                    ? "bg-slate-800 text-white font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Fichas Visuais
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

        {/* BARRA DE AÇÕES PRINCIPAIS */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-xs print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyAll}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 font-bold transition shadow-xs ${
                copiedAll
                  ? "bg-emerald-600 text-white"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              }`}
              title="Copiar todos os candidatos no padrão exato solicitado pelas empresas"
            >
              {copiedAll ? (
                <>
                  <Check className="size-4" />
                  <span>Copiado com Sucesso!</span>
                </>
              ) : (
                <>
                  <Copy className="size-4" />
                  <span>Copiar Modelo Padrão ({candidates.length})</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
              title="Baixar planilha compatível com Excel (.csv UTF-8)"
            >
              <FileSpreadsheet className="size-3.5 text-emerald-700" />
              <span>Baixar Excel / CSV</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
              title="Imprimir ou Salvar em PDF"
            >
              <Printer className="size-3.5 text-slate-600" />
              <span>Imprimir / PDF</span>
            </button>
          </div>
        </div>

        {/* CONTEÚDO PRINCIPAL */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* VISUALIZAÇÃO 1: PADRÃO OFICIAL EVER / GRUPO GPS (EXATAMENTE O FORMATO DO CLIENTE) */}
          {activeView === "standard" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 flex items-center justify-between">
                <span>
                  💡 <strong>Modelo Padronizado:</strong> CPF e RG sem asteriscos para avaliação admissional, fardamento completo, endereço e parecer com destaques do segmento.
                </span>
                <span className="text-[11px] font-semibold text-slate-500">
                  Pronto para WhatsApp ou E-mail
                </span>
              </div>

              {candidates.map((c, idx) => (
                <div
                  key={c.id}
                  className="rounded-xl border border-slate-300 bg-white shadow-xs overflow-hidden"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-2 text-xs">
                    <span className="font-bold text-slate-700">
                      Candidato #{idx + 1} · {c.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopySingle(c)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
                    >
                      {copiedId === c.id ? (
                        <>
                          <Check className="size-3 text-emerald-600" />
                          <span className="text-emerald-700">Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3 text-slate-500" />
                          <span>Copiar só este</span>
                        </>
                      )}
                    </button>
                  </div>

                  <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-800 p-4 select-all bg-white overflow-x-auto">
                    {formatCandidateStandard(c)}
                  </pre>
                </div>
              ))}
            </div>
          )}

          {/* VISUALIZAÇÃO 2: FICHAS VISUAIS CORPORATIVAS */}
          {activeView === "cards" && (
            <div className="grid grid-cols-1 gap-4">
              {candidates.map((c, idx) => (
                <article
                  key={c.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300 print:border-b print:rounded-none print:shadow-none"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3 mb-4">
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-7 items-center justify-center rounded-lg bg-slate-800 text-xs font-bold text-white">
                        {idx + 1}
                      </span>
                      <div>
                        <h3 className="text-base font-extrabold uppercase tracking-tight text-slate-900">
                          {c.name}
                        </h3>
                        <p className="text-xs text-slate-500">
                          Nascimento: <strong>{c.birthDateFormatted}</strong>
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopySingle(c)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition print:hidden"
                    >
                      {copiedId === c.id ? (
                        <>
                          <Check className="size-3 text-emerald-600" />
                          <span className="text-emerald-700">Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3 text-slate-500" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 text-xs">
                    {/* Documentos */}
                    <div className="rounded-lg bg-slate-50 p-3 border border-slate-200/80 space-y-1">
                      <p className="font-bold uppercase text-[10px] text-slate-500 tracking-wider">
                        Documentos (Sem Asteriscos)
                      </p>
                      <p className="text-slate-800">
                        CPF: <strong className="font-mono text-slate-900">{c.cpf}</strong>
                      </p>
                      <p className="text-slate-800">
                        RG: <strong className="font-mono text-slate-900">{c.rg}</strong>
                      </p>
                    </div>

                    {/* Contatos */}
                    <div className="rounded-lg bg-slate-50 p-3 border border-slate-200/80 space-y-1">
                      <p className="font-bold uppercase text-[10px] text-slate-500 tracking-wider">
                        Contatos
                      </p>
                      <div className="flex items-center gap-1.5 text-slate-800">
                        <Phone className="size-3 text-slate-400" />
                        <span className="font-semibold">{c.phone}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Mail className="size-3 text-slate-400" />
                        <span className="truncate">{c.email}</span>
                      </div>
                    </div>

                    {/* Fardamento & Itaú */}
                    <div className="rounded-lg bg-amber-50/70 p-3 border border-amber-200/80 space-y-1">
                      <p className="font-bold uppercase text-[10px] text-amber-900 tracking-wider">
                        Fardamento & Itaú
                      </p>
                      <p className="font-bold text-slate-800">
                        {c.uniform.formatted}
                      </p>
                      <p className="text-slate-700">
                        Conta Itaú?: <strong>{c.itauAccount}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Endereço Completo */}
                  <div className="mt-3 text-xs text-slate-700">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Endereço Completo:
                    </p>
                    <p className="mt-0.5 text-slate-800 font-medium">
                      {c.fullAddress}
                    </p>
                  </div>

                  {/* Parecer */}
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                      • PARECER:
                    </p>
                    <p className="text-xs leading-relaxed text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                      {c.parecerText}
                    </p>
                  </div>

                  {/* Principais Clientes / Marcas */}
                  <div className="mt-2.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">
                      Principais Clientes / Marcas Atendidas:
                    </p>
                    <p className="text-xs text-slate-700 font-medium">
                      {c.companiesAttended}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* VISUALIZAÇÃO 3: TABELA CORPORATIVA */}
          {activeView === "table" && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    <th className="px-3.5 py-2.5">#</th>
                    <th className="px-3.5 py-2.5">Nome</th>
                    <th className="px-3.5 py-2.5">CPF</th>
                    <th className="px-3.5 py-2.5">RG</th>
                    <th className="px-3.5 py-2.5">Nascimento</th>
                    <th className="px-3.5 py-2.5">Telefone</th>
                    <th className="px-3.5 py-2.5">Uniforme</th>
                    <th className="px-3.5 py-2.5">Conta Itaú?</th>
                    <th className="px-3.5 py-2.5 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {candidates.map((c, idx) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-3.5 py-2.5 font-bold text-slate-400">{idx + 1}</td>
                      <td className="px-3.5 py-2.5 font-bold text-slate-900 whitespace-nowrap">
                        {c.name}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-slate-800 whitespace-nowrap">
                        {c.cpf}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-slate-800 whitespace-nowrap">
                        {c.rg}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-700 whitespace-nowrap">
                        {c.birthDateFormatted}
                      </td>
                      <td className="px-3.5 py-2.5 font-semibold text-slate-800 whitespace-nowrap">
                        {c.phone}
                      </td>
                      <td className="px-3.5 py-2.5 font-bold text-amber-900 bg-amber-50/40 whitespace-nowrap">
                        {c.uniform.formatted}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-700 whitespace-nowrap">
                        {c.itauAccount}
                      </td>
                      <td className="px-3.5 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleCopySingle(c)}
                          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 shadow-2xs transition"
                        >
                          {copiedId === c.id ? "Copiado!" : "Copiar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* RODAPÉ DO MODAL */}
        <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500 print:hidden">
          <span>
            {candidates.length} candidato{candidates.length > 1 ? "s" : ""} formatado{candidates.length > 1 ? "s" : ""} no padrão Ever / GPS.
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
