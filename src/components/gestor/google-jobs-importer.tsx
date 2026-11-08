"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Briefcase,
  Check,
  CheckCircle2,
  ExternalLink,
  Globe,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import {
  createSingleExternalJobAction,
  extractJobPreviewFromUrlAction,
  importExternalJobsAction,
  removeExternalJobAction,
  searchGoogleJobsAction,
  toggleExternalJobAction,
} from "@/server/controllers/external-job.controller";
import type { ExternalJobCandidate } from "@/server/models/external-job.model";

interface ImportedExternalJobItem {
  id: string;
  title: string;
  employer: string;
  location: string | null;
  source: string | null;
  applyUrl: string;
  postedLabel: string | null;
  isPublished: boolean;
  createdAt: string;
}

export function GoogleJobsImporter({
  initialJobs,
  companySlug,
  searchConfigured,
}: {
  initialJobs: ImportedExternalJobItem[];
  companySlug: string;
  searchConfigured: boolean;
}) {
  const [jobsList, setJobsList] = useState<ImportedExternalJobItem[]>(initialJobs);
  const [activeTab, setActiveTab] = useState<"search" | "url">("search");

  // Estados da Busca do Google Vagas
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<
    (ExternalJobCandidate & { alreadyImported: boolean })[]
  >([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Estados da Importação por Link Direto
  const [directUrl, setDirectUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualEmployer, setManualEmployer] = useState("");
  const [manualLocation, setManualLocation] = useState("");
  const [manualSource, setManualSource] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [savingManual, setSavingManual] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  // Ação: Buscar no Google Vagas
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    setSearchError(null);
    setFeedbackMessage(null);
    setSelectedIds(new Set());

    try {
      const res = await searchGoogleJobsAction({
        query: query.trim(),
        location: location.trim() || undefined,
      });

      if (res.ok) {
        setSearchResults(res.jobs);
        if (res.jobs.length === 0) {
          setSearchError("Nenhuma vaga encontrada no Google para os termos informados.");
        }
      } else {
        setSearchError(res.error || "Não foi possível consultar o Google Vagas.");
      }
    } catch {
      setSearchError("Falha de conexão ao pesquisar no Google Vagas.");
    } finally {
      setSearching(false);
    }
  };

  // Alterna seleção individual
  const toggleSelect = (externalId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(externalId)) next.delete(externalId);
      else next.add(externalId);
      return next;
    });
  };

  // Selecionar todas não importadas
  const toggleSelectAll = () => {
    const unimported = searchResults.filter((j) => !j.alreadyImported);
    if (selectedIds.size === unimported.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unimported.map((j) => j.externalId)));
    }
  };

  // Ação: Importar Selecionadas
  const handleImportSelected = async () => {
    if (selectedIds.size === 0) return;
    setImporting(true);
    setFeedbackMessage(null);

    const toImport = searchResults
      .filter((j) => selectedIds.has(j.externalId))
      .map((j) => ({
        externalId: j.externalId,
        title: j.title,
        employer: j.employer,
        location: j.location,
        description: j.description,
        source: j.source,
        applyUrl: j.applyUrl,
        postedLabel: j.postedLabel,
        scheduleType: j.scheduleType,
      }));

    try {
      const res = await importExternalJobsAction(toImport);
      if (res.ok) {
        setFeedbackMessage(
          `Sucesso! ${res.imported} ${
            res.imported === 1 ? "vaga importada" : "vagas importadas"
          } para o mural.`
        );
        // Atualiza estado local
        setSearchResults((prev) =>
          prev.map((j) => (selectedIds.has(j.externalId) ? { ...j, alreadyImported: true } : j))
        );
        setSelectedIds(new Set());
      } else {
        setSearchError(res.error || "Falha ao importar vagas.");
      }
    } catch {
      setSearchError("Erro ao salvar vagas no banco.");
    } finally {
      setImporting(false);
    }
  };

  // Ação: Extrair dados de URL colada
  const handleExtractUrl = async () => {
    if (!directUrl.trim()) return;
    setExtracting(true);
    setManualError(null);

    try {
      const res = await extractJobPreviewFromUrlAction(directUrl.trim());
      if (res.ok && res.data) {
        if (res.data.title) setManualTitle(res.data.title);
        if (res.data.source) setManualSource(res.data.source);
        if (res.data.description) setManualDescription(res.data.description);
      } else {
        setManualError(res.error || "Não foi possível carregar os dados automáticos do link.");
      }
    } catch {
      setManualError("Erro ao inspecionar o link.");
    } finally {
      setExtracting(false);
    }
  };

  // Ação: Salvar vaga manual por link
  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim() || !manualEmployer.trim() || !directUrl.trim()) {
      setManualError("Preencha cargo, empresa e link de inscrição.");
      return;
    }

    setSavingManual(true);
    setManualError(null);

    try {
      const res = await createSingleExternalJobAction({
        externalId: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title: manualTitle.trim(),
        employer: manualEmployer.trim(),
        location: manualLocation.trim() || null,
        description: manualDescription.trim() || null,
        source: manualSource.trim() || "Google Vagas",
        applyUrl: directUrl.trim(),
        postedLabel: "Recém-adicionada",
        scheduleType: null,
      });

      if (res.ok) {
        setFeedbackMessage("Vaga externa adicionada com sucesso ao mural!");
        setDirectUrl("");
        setManualTitle("");
        setManualEmployer("");
        setManualLocation("");
        setManualDescription("");
        setManualSource("");
      } else {
        setManualError(res.error || "Falha ao cadastrar vaga.");
      }
    } catch {
      setManualError("Erro ao salvar a vaga.");
    } finally {
      setSavingManual(false);
    }
  };

  // Ação: Alternar publicação
  const handleTogglePublished = async (id: string, currentStatus: boolean) => {
    setJobsList((prev) =>
      prev.map((j) => (j.id === id ? { ...j, isPublished: !currentStatus } : j))
    );
    await toggleExternalJobAction(id, !currentStatus);
  };

  // Ação: Excluir vaga
  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Deseja remover a vaga externa "${title}" do mural?`)) return;
    setJobsList((prev) => prev.filter((j) => j.id !== id));
    await removeExternalJobAction(id);
  };

  return (
    <div className="space-y-8">
      {/* Topo / Voltar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#e4e4e7] pb-5">
        <div>
          <Link
            href="/vagas"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#71717a] hover:text-[#0a0a0a] transition mb-2"
          >
            <ArrowLeft className="size-3.5" />
            <span>Voltar para Vagas da Empresa</span>
          </Link>
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <Globe className="size-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-[#0a0a0a]">
                Mural de Oportunidades Externas (Google Vagas)
              </h1>
              <p className="text-xs text-[#71717a]">
                Importe e concentre vagas de outros portais para apoiar candidatos, com aviso legal
                de isenção de responsabilidade.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/${companySlug}/vagas`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#e4e4e7] bg-white px-3.5 text-xs font-semibold text-[#0a0a0a] hover:bg-[#fafaf9] transition shadow-2xs"
          >
            <span>Ver Portal Público</span>
            <ExternalLink className="size-3.5 text-[#71717a]" />
          </Link>
        </div>
      </div>

      {/* Banner de Segurança & Disclaimer Legal */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-950 flex items-start gap-3">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-blue-200 text-blue-900 mt-0.5">
          <Info className="size-3.5" />
        </span>
        <div className="space-y-1">
          <p className="font-bold">Como funciona a divulgação de vagas externas:</p>
          <p className="leading-relaxed text-blue-900">
            As vagas importadas aparecem no seu portal com badge <strong>Vaga Externa</strong> e o
            botão direciona o candidato para a página oficial da vaga (LinkedIn, Gupy, InfoJobs,
            etc.). <strong>Seu banco de currículos não é misturado</strong> e o sistema exibe
            automaticamente o aviso legal de isenção de responsabilidade da sua empresa.
          </p>
        </div>
      </div>

      {/* Caixa de Importação com Abas */}
      <div className="rounded-2xl border border-[#e4e4e7] bg-white p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-2 border-b border-[#e4e4e7] pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("search")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              activeTab === "search"
                ? "bg-[#0a0a0a] text-white shadow-xs"
                : "text-[#52525b] hover:bg-[#fafaf9] hover:text-[#0a0a0a]"
            }`}
          >
            <Search className="size-3.5" />
            <span>Buscar no Google Vagas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("url")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              activeTab === "url"
                ? "bg-[#0a0a0a] text-white shadow-xs"
                : "text-[#52525b] hover:bg-[#fafaf9] hover:text-[#0a0a0a]"
            }`}
          >
            <Plus className="size-3.5" />
            <span>Importar por Link Direto</span>
          </button>
        </div>

        {/* ABA 1: BUSCA DIRETA NO GOOGLE VAGAS */}
        {activeTab === "search" && (
          <div className="space-y-4">
            <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-6">
                <label className="text-xs font-bold text-[#0a0a0a] block mb-1">
                  Cargo ou Área:
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-2.5 size-4 text-[#a1a1aa]" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ex: Promotor de Vendas, Atendente, Estoquista…"
                    className="h-10 w-full rounded-xl border border-[#e4e4e7] bg-white pl-9 pr-3 text-xs text-[#0a0a0a] outline-none focus:border-[#0a0a0a]"
                    required
                  />
                </div>
              </div>

              <div className="sm:col-span-4">
                <label className="text-xs font-bold text-[#0a0a0a] block mb-1">
                  Cidade ou Região:
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ex: Fortaleza - CE, Remoto…"
                  className="h-10 w-full rounded-xl border border-[#e4e4e7] bg-white px-3 text-xs text-[#0a0a0a] outline-none focus:border-[#0a0a0a]"
                />
              </div>

              <div className="sm:col-span-2 flex items-end">
                <button
                  type="submit"
                  disabled={searching || !query.trim()}
                  className="h-10 w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0a0a0a] px-4 text-xs font-bold text-white shadow-xs hover:bg-[#27272a] transition active:scale-95 disabled:opacity-50"
                >
                  {searching ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Search className="size-4" />
                  )}
                  <span>{searching ? "Buscando…" : "Buscar Vagas"}</span>
                </button>
              </div>
            </form>

            {!searchConfigured && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900 leading-relaxed">
                💡 <strong>Dica de configuração:</strong> Para ativar a busca automática direta no
                Google Vagas via API, configure a chave <code>SERPAPI_API_KEY</code> no painel da
                Vercel (gratuita em serpapi.com com 100 buscas/mês). Você também pode usar a aba{" "}
                <strong>Importar por Link Direto</strong> acima para cadastrar qualquer vaga colando
                o link.
              </div>
            )}

            {searchError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 leading-relaxed">
                {searchError}
              </div>
            )}

            {feedbackMessage && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-600" />
                <span>{feedbackMessage}</span>
              </div>
            )}

            {/* Resultados da Busca */}
            {searchResults.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[#e4e4e7] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="text-xs font-semibold text-[#52525b] hover:text-[#0a0a0a] underline"
                    >
                      {selectedIds.size > 0 ? "Desmarcar todas" : "Selecionar todas"}
                    </button>
                    <span className="text-xs text-[#71717a]">
                      · {searchResults.length} vagas encontradas no Google
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleImportSelected}
                    disabled={importing || selectedIds.size === 0}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition active:scale-95 disabled:opacity-50"
                  >
                    {importing ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Check className="size-3.5" />
                    )}
                    <span>Importar Selecionadas ({selectedIds.size})</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2.5 max-h-[460px] overflow-y-auto pr-1">
                  {searchResults.map((job) => {
                    const isSelected = selectedIds.has(job.externalId);
                    return (
                      <div
                        key={job.externalId}
                        onClick={() => !job.alreadyImported && toggleSelect(job.externalId)}
                        className={`p-3.5 rounded-xl border text-left transition flex items-start justify-between gap-3 ${
                          job.alreadyImported
                            ? "border-emerald-200 bg-emerald-50/50 opacity-80 cursor-default"
                            : isSelected
                            ? "border-blue-500 bg-blue-50/60 ring-1 ring-blue-500 cursor-pointer"
                            : "border-[#e4e4e7] bg-white hover:bg-[#fafaf9] cursor-pointer"
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={isSelected || job.alreadyImported}
                            disabled={job.alreadyImported}
                            onChange={() => {}}
                            className="size-4 mt-0.5 rounded border-[#e4e4e7] text-blue-600 focus:ring-blue-600"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs font-bold text-[#0a0a0a] truncate">
                                {job.title}
                              </p>
                              {job.alreadyImported && (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                  Já Importada
                                </span>
                              )}
                              {job.source && (
                                <span className="rounded-full bg-[#f4f4f5] px-2 py-0.5 text-[10px] font-medium text-[#71717a]">
                                  via {job.source}
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] text-[#52525b] mt-0.5">
                              Empresa: <strong>{job.employer}</strong> · {job.location || "Local não informado"}
                              {job.postedLabel ? ` · ${job.postedLabel}` : ""}
                            </p>

                            {job.description && (
                              <p className="text-[11px] text-[#71717a] mt-1 line-clamp-2 leading-relaxed">
                                {job.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <a
                          href={job.applyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-lg text-[#71717a] hover:bg-[#e4e4e7] hover:text-[#0a0a0a] transition shrink-0"
                          title="Abrir anúncio original na fonte"
                        >
                          <ExternalLink className="size-4" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ABA 2: IMPORTAR POR LINK DIRETO */}
        {activeTab === "url" && (
          <form onSubmit={handleSaveManual} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-[#0a0a0a] block mb-1">
                Link da Vaga (Google Vagas, LinkedIn, Gupy, etc.):
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={directUrl}
                  onChange={(e) => setDirectUrl(e.target.value)}
                  placeholder="https://..."
                  className="h-10 flex-1 rounded-xl border border-[#e4e4e7] bg-white px-3 text-xs text-[#0a0a0a] outline-none focus:border-[#0a0a0a]"
                  required
                />
                <button
                  type="button"
                  onClick={handleExtractUrl}
                  disabled={extracting || !directUrl.trim()}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#e4e4e7] bg-[#fafaf9] px-3.5 text-xs font-semibold text-[#0a0a0a] hover:bg-[#e4e4e7] transition disabled:opacity-50"
                >
                  {extracting ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3.5" />
                  )}
                  <span>Identificar Dados</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[#0a0a0a] block mb-1">
                  Título do Cargo:
                </label>
                <input
                  type="text"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="Ex: Operador de Caixa"
                  className="h-10 w-full rounded-xl border border-[#e4e4e7] bg-white px-3 text-xs text-[#0a0a0a] outline-none focus:border-[#0a0a0a]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#0a0a0a] block mb-1">
                  Empresa Anunciante:
                </label>
                <input
                  type="text"
                  value={manualEmployer}
                  onChange={(e) => setManualEmployer(e.target.value)}
                  placeholder="Ex: Supermercados XYZ"
                  className="h-10 w-full rounded-xl border border-[#e4e4e7] bg-white px-3 text-xs text-[#0a0a0a] outline-none focus:border-[#0a0a0a]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#0a0a0a] block mb-1">
                  Cidade / Estado:
                </label>
                <input
                  type="text"
                  value={manualLocation}
                  onChange={(e) => setManualLocation(e.target.value)}
                  placeholder="Ex: Fortaleza, CE"
                  className="h-10 w-full rounded-xl border border-[#e4e4e7] bg-white px-3 text-xs text-[#0a0a0a] outline-none focus:border-[#0a0a0a]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#0a0a0a] block mb-1">
                  Fonte Anunciante:
                </label>
                <input
                  type="text"
                  value={manualSource}
                  onChange={(e) => setManualSource(e.target.value)}
                  placeholder="Ex: LinkedIn, Gupy, InfoJobs"
                  className="h-10 w-full rounded-xl border border-[#e4e4e7] bg-white px-3 text-xs text-[#0a0a0a] outline-none focus:border-[#0a0a0a]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#0a0a0a] block mb-1">
                Resumo / Requisitos da Vaga (opcional):
              </label>
              <textarea
                rows={3}
                value={manualDescription}
                onChange={(e) => setManualDescription(e.target.value)}
                placeholder="Cole os principais requisitos ou descrição da oportunidade…"
                className="w-full rounded-xl border border-[#e4e4e7] bg-white p-3 text-xs text-[#0a0a0a] outline-none focus:border-[#0a0a0a] resize-none"
              />
            </div>

            {manualError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                {manualError}
              </div>
            )}

            <button
              type="submit"
              disabled={savingManual}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#0a0a0a] px-5 text-xs font-bold text-white shadow-xs hover:bg-[#27272a] transition active:scale-95 disabled:opacity-50"
            >
              {savingManual ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              <span>Salvar e Publicar no Mural de Vagas</span>
            </button>
          </form>
        )}
      </div>

      {/* Lista de Vagas Externas Cadastradas no Portal */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-[#0a0a0a]">
              Vagas Externas Ativas no Portal ({jobsList.length})
            </h2>
            <p className="text-xs text-[#71717a]">
              Estas oportunidades estão visíveis no mural público do seu portal para apoiar os candidatos.
            </p>
          </div>
        </div>

        {jobsList.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#e4e4e7] bg-white p-10 text-center text-xs text-[#71717a]">
            Nenhuma vaga externa importada ainda. Use a ferramenta de busca do Google Vagas ou cole
            um link direto acima para divulgar as primeiras oportunidades!
          </div>
        ) : (
          <div className="rounded-2xl border border-[#e4e4e7] bg-white overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#e4e4e7] bg-[#fafaf9] text-[#71717a] font-bold">
                  <tr>
                    <th className="py-3 px-4">Cargo / Título</th>
                    <th className="py-3 px-4">Empresa Anunciante</th>
                    <th className="py-3 px-4">Cidade</th>
                    <th className="py-3 px-4">Fonte</th>
                    <th className="py-3 px-4">Status no Portal</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f4f4f5]">
                  {jobsList.map((j) => (
                    <tr key={j.id} className="hover:bg-[#fafaf9] transition">
                      <td className="py-3 px-4 font-bold text-[#0a0a0a]">
                        <div className="flex items-center gap-2">
                          <span>{j.title}</span>
                          {j.postedLabel && (
                            <span className="text-[10px] font-normal text-[#a1a1aa]">
                              ({j.postedLabel})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[#52525b]">{j.employer}</td>
                      <td className="py-3 px-4 text-[#71717a]">{j.location || "—"}</td>
                      <td className="py-3 px-4">
                        <span className="rounded-full bg-[#f4f4f5] px-2 py-0.5 text-[10px] font-medium text-[#71717a]">
                          {j.source || "Google Vagas"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => handleTogglePublished(j.id, j.isPublished)}
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold transition ${
                            j.isPublished
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                              : "bg-[#f4f4f5] text-[#71717a] hover:bg-[#e4e4e7]"
                          }`}
                        >
                          {j.isPublished ? "Publicada" : "Oculta"}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <a
                            href={j.applyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-[#71717a] hover:bg-[#e4e4e7] hover:text-[#0a0a0a] transition"
                            title="Testar link externo de inscrição"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => handleDelete(j.id, j.title)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition"
                            title="Remover do mural"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
