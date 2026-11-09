"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  BarChart2,
  Briefcase,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  ExternalLink,
  Eye,
  Globe,
  Info,
  Loader2,
  MapPin,
  MousePointerClick,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  TrendingUp,
} from "lucide-react";
import {
  createSingleExternalJobAction,
  extractJobPreviewFromUrlAction,
  importExternalJobsAction,
  removeExternalJobAction,
  searchGoogleJobsAction,
  toggleExternalJobAction,
} from "@/server/controllers/external-job.controller";
import {
  calculateCtr,
  calculateExternalJobsSummary,
  isGenericSearchUrl,
  type ExternalJobCandidate,
  type WorkplaceTypeFilter,
} from "@/server/models/external-job.model";

interface ImportedExternalJobItem {
  id: string;
  title: string;
  employer: string;
  location: string | null;
  source: string | null;
  applyUrl: string;
  postedLabel: string | null;
  isPublished: boolean;
  viewsCount?: number;
  clicksCount?: number;
  ctr?: number;
  createdAt: string;
}

export function GoogleJobsImporter({
  initialJobs,
  companySlug,
  searchConfigured,
  initialStats,
}: {
  initialJobs: ImportedExternalJobItem[];
  companySlug: string;
  searchConfigured: boolean;
  initialStats?: {
    totalJobs: number;
    publishedJobs: number;
    totalViews: number;
    totalClicks: number;
    averageCtr: number;
  };
}) {
  const [jobsList, setJobsList] = useState<ImportedExternalJobItem[]>(initialJobs);
  const [activeTab, setActiveTab] = useState<"search" | "url">("search");

  // Estados da Busca do Google Vagas
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [workplaceType, setWorkplaceType] = useState<WorkplaceTypeFilter>("all");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<
    (ExternalJobCandidate & { alreadyImported: boolean })[]
  >([]);
  const [searchEngineLabel, setSearchEngineLabel] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "json">("cards");
  const [copiedJson, setCopiedJson] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
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

  // Ordenação e Telemetria
  const [sortMode, setSortMode] = useState<"recent" | "views" | "clicks" | "ctr">("recent");

  const stats = useMemo(() => {
    return calculateExternalJobsSummary(jobsList);
  }, [jobsList]);

  const sortedJobs = useMemo(() => {
    return [...jobsList].sort((a, b) => {
      if (sortMode === "views") {
        return (b.viewsCount ?? 0) - (a.viewsCount ?? 0);
      }
      if (sortMode === "clicks") {
        return (b.clicksCount ?? 0) - (a.clicksCount ?? 0);
      }
      if (sortMode === "ctr") {
        const ctrA = calculateCtr(a.clicksCount ?? 0, a.viewsCount ?? 0);
        const ctrB = calculateCtr(b.clicksCount ?? 0, b.viewsCount ?? 0);
        return ctrB - ctrA;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [jobsList, sortMode]);

  // Ação: Buscar no Google Vagas (Cargo opcional — localidade ou modalidade já bastam!)
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() && !location.trim() && workplaceType === "all") {
      setSearchError("Informe ao menos a localidade ou escolha se a vaga é presencial ou remota.");
      return;
    }

    setSearching(true);
    setSearchError(null);
    setFeedbackMessage(null);
    setSelectedIds(new Set());

    try {
      const res = await searchGoogleJobsAction({
        query: query.trim() || undefined,
        location: location.trim() || undefined,
        workplaceType,
      });

      if (res.ok) {
        setSearchResults(res.jobs);
        if ("engineLabel" in res && typeof res.engineLabel === "string") {
          setSearchEngineLabel(res.engineLabel);
        }
        if (res.jobs.length === 0) {
          setSearchError("Nenhuma vaga encontrada para os filtros selecionados.");
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

  const handleCopyJson = async () => {
    try {
      const cleanJson = JSON.stringify(
        searchResults.map(({ alreadyImported, ...rest }) => rest),
        null,
        2
      );
      await navigator.clipboard.writeText(cleanJson);
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    } catch {
      // fallback sem erro
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

  // Ação: Publicar uma vaga individual instantaneamente no portal (1-clique)
  const handlePublishSingle = async (job: ExternalJobCandidate) => {
    setPublishingId(job.externalId);
    setSearchError(null);
    setFeedbackMessage(null);

    try {
      const res = await createSingleExternalJobAction(job);
      if (res.ok) {
        setFeedbackMessage(
          `Vaga "${job.title}" publicada com sucesso! Ela já está visível para os candidatos no seu portal.`
        );
        // Marca como já publicada nos resultados
        setSearchResults((prev) =>
          prev.map((j) => (j.externalId === job.externalId ? { ...j, alreadyImported: true } : j))
        );
        // Atualiza a tabela de vagas ativas em tempo real
        setJobsList((prev) => [
          {
            id: `pub_${Date.now()}_${job.externalId}`,
            title: job.title,
            employer: job.employer,
            location: job.location,
            source: job.source,
            applyUrl: job.applyUrl,
            postedLabel: job.postedLabel,
            isPublished: true,
            viewsCount: 0,
            clicksCount: 0,
            ctr: 0,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
      } else {
        setSearchError(res.error || "Não foi possível publicar a vaga no portal.");
      }
    } catch {
      setSearchError("Falha de conexão ao publicar a vaga no portal.");
    } finally {
      setPublishingId(null);
    }
  };

  // Ação: Importar Selecionadas ou Todas do JSON
  const handleImportSelected = async () => {
    const unimported = searchResults.filter((j) => !j.alreadyImported);
    const toImportList =
      selectedIds.size > 0
        ? searchResults.filter((j) => selectedIds.has(j.externalId))
        : unimported;

    if (toImportList.length === 0) return;
    setImporting(true);
    setFeedbackMessage(null);

    const toImport = toImportList.map((j) => ({
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
            res.imported === 1 ? "vaga publicada" : "vagas publicadas"
          } no seu portal público.`
        );
        // Atualiza estado local de busca
        const importedIdSet = new Set(toImportList.map((j) => j.externalId));
        setSearchResults((prev) =>
          prev.map((j) => (importedIdSet.has(j.externalId) ? { ...j, alreadyImported: true } : j))
        );
        // Adiciona à lista de vagas ativas no portal
        const newItems: ImportedExternalJobItem[] = toImportList.map((job) => ({
          id: `imp_${Date.now()}_${job.externalId}`,
          title: job.title,
          employer: job.employer,
          location: job.location,
          source: job.source,
          applyUrl: job.applyUrl,
          postedLabel: job.postedLabel,
          isPublished: true,
          viewsCount: 0,
          clicksCount: 0,
          ctr: 0,
          createdAt: new Date().toISOString(),
        }));
        setJobsList((prev) => [...newItems, ...prev]);
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
        setFeedbackMessage(`Vaga "${manualTitle.trim()}" publicada com sucesso no portal!`);
        setJobsList((prev) => [
          {
            id: `man_${Date.now()}`,
            title: manualTitle.trim(),
            employer: manualEmployer.trim(),
            location: manualLocation.trim() || null,
            source: manualSource.trim() || "Google Vagas",
            applyUrl: directUrl.trim(),
            postedLabel: "Recém-adicionada",
            isPublished: true,
            viewsCount: 0,
            clicksCount: 0,
            ctr: 0,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
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
            <form onSubmit={handleSearch} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                {/* Cidade / Região */}
                <div className="sm:col-span-5">
                  <label className="text-xs font-bold text-[#0a0a0a] block mb-1">
                    Cidade ou Região:
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 size-4 text-[#a1a1aa]" />
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Ex: Fortaleza, São Paulo, Curitiba, Ceará…"
                      className="h-10 w-full rounded-xl border border-[#e4e4e7] bg-white pl-9 pr-3 text-xs text-[#0a0a0a] outline-none focus:border-[#0a0a0a]"
                    />
                  </div>
                </div>

                {/* Modalidade: Presencial vs Remoto */}
                <div className="sm:col-span-4">
                  <label className="text-xs font-bold text-[#0a0a0a] block mb-1">
                    Modalidade de Trabalho:
                  </label>
                  <div className="grid grid-cols-3 gap-1 h-10 rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] p-1">
                    <button
                      type="button"
                      onClick={() => setWorkplaceType("all")}
                      className={`rounded-lg text-[11px] font-bold transition flex items-center justify-center ${
                        workplaceType === "all"
                          ? "bg-white text-[#0a0a0a] shadow-2xs"
                          : "text-[#71717a] hover:text-[#0a0a0a]"
                      }`}
                    >
                      Todas
                    </button>
                    <button
                      type="button"
                      onClick={() => setWorkplaceType("on-site")}
                      className={`rounded-lg text-[11px] font-bold transition flex items-center justify-center ${
                        workplaceType === "on-site"
                          ? "bg-white text-[#0a0a0a] shadow-2xs"
                          : "text-[#71717a] hover:text-[#0a0a0a]"
                      }`}
                    >
                      Presencial
                    </button>
                    <button
                      type="button"
                      onClick={() => setWorkplaceType("remote")}
                      className={`rounded-lg text-[11px] font-bold transition flex items-center justify-center ${
                        workplaceType === "remote"
                          ? "bg-white text-[#0a0a0a] shadow-2xs"
                          : "text-[#71717a] hover:text-[#0a0a0a]"
                      }`}
                    >
                      Remoto
                    </button>
                  </div>
                </div>

                {/* Cargo (Opcional) */}
                <div className="sm:col-span-3">
                  <label className="text-xs font-bold text-[#0a0a0a] block mb-1">
                    Cargo <span className="font-normal text-[#71717a]">(opcional)</span>:
                  </label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-2.5 size-4 text-[#a1a1aa]" />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Ex: Vendedor, Atendente…"
                      className="h-10 w-full rounded-xl border border-[#e4e4e7] bg-white pl-9 pr-3 text-xs text-[#0a0a0a] outline-none focus:border-[#0a0a0a]"
                    />
                  </div>
                </div>
              </div>

              {/* Dica e Botão de Busca */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                <p className="text-[11px] text-[#71717a] leading-tight">
                  💡 <strong>Filtro flexível:</strong> O cargo não é obrigatório. Basta informar a cidade ou selecionar se busca vagas presenciais ou remotas.
                </p>

                <button
                  type="submit"
                  disabled={searching || (!query.trim() && !location.trim() && workplaceType === "all")}
                  className="h-11 sm:h-10 min-w-[150px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0a0a0a] px-5 text-xs font-bold text-white shadow-xs hover:bg-[#27272a] transition active:scale-95 disabled:opacity-40"
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

            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 flex items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-blue-600 shrink-0" />
                <span>
                  <strong>Buscador Inteligente via API/Web Ativo:</strong> Requisições diretas de resultados
                  estruturados do Google Vagas com entrega em JSON limpo e zero risco de bloqueio de IP.
                </span>
              </div>
              {searchEngineLabel && (
                <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold text-blue-800">
                  {searchEngineLabel}
                </span>
              )}
            </div>

            {searchError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 leading-relaxed">
                {searchError}
              </div>
            )}

            {feedbackMessage && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs animate-in fade-in">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-bold">{feedbackMessage}</p>
                    <p className="text-[11px] text-emerald-800">
                      A vaga já está online e disponível para os candidatos no seu portal público.
                    </p>
                  </div>
                </div>
                <Link
                  href={`/${companySlug}/vagas`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 transition shrink-0 self-start sm:self-auto"
                >
                  <Globe className="size-3.5" />
                  <span>Ver no Meu Portal ↗</span>
                </Link>
              </div>
            )}

            {/* Resultados da Busca */}
            {searchResults.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[#e4e4e7] space-y-3">
                {/* Barra de Ações e Alternador de Visualização (Cards vs JSON Limpo) */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2">
                    {viewMode === "cards" ? (
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="text-xs font-semibold text-[#52525b] hover:text-[#0a0a0a] underline"
                      >
                        {selectedIds.size > 0 ? "Desmarcar todas" : "Selecionar todas"}
                      </button>
                    ) : null}
                    <span className="text-xs text-[#71717a]">
                      {searchResults.length} vagas estruturadas em JSON limpo
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Alternador de Modo */}
                    <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setViewMode("cards")}
                        className={`rounded-md px-2.5 py-1 font-semibold transition ${
                          viewMode === "cards"
                            ? "bg-slate-900 text-white shadow-2xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Cards de Seleção
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode("json")}
                        className={`flex items-center gap-1 rounded-md px-2.5 py-1 font-semibold transition ${
                          viewMode === "json"
                            ? "bg-slate-900 text-white shadow-2xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <Code2 className="size-3" />
                        <span>JSON Limpo</span>
                      </button>
                    </div>

                    {/* Botão Copiar JSON */}
                    {viewMode === "json" && (
                      <button
                        type="button"
                        onClick={handleCopyJson}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                      >
                        {copiedJson ? (
                          <>
                            <Check className="size-3.5 text-emerald-600" />
                            <span className="text-emerald-700">JSON Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="size-3.5" />
                            <span>Copiar JSON</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Botão de Importar */}
                    <button
                      type="button"
                      onClick={handleImportSelected}
                      disabled={importing || (viewMode === "cards" && selectedIds.size === 0)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition active:scale-95 disabled:opacity-50"
                    >
                      {importing ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Check className="size-3.5" />
                      )}
                      <span>
                        {viewMode === "json"
                          ? "Importar Todas do JSON"
                          : `Importar Selecionadas (${selectedIds.size})`}
                      </span>
                    </button>
                  </div>
                </div>

                {/* VISUALIZAÇÃO 1: MODO JSON LIMPO */}
                {viewMode === "json" ? (
                  <div className="relative rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs font-mono text-emerald-400 max-h-[460px] overflow-auto shadow-inner">
                    <div className="absolute top-3 right-3 flex items-center gap-2">
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 font-sans">
                        application/json
                      </span>
                    </div>
                    <pre className="whitespace-pre-wrap leading-relaxed">
                      {JSON.stringify(
                        searchResults.map(({ alreadyImported, ...rest }) => rest),
                        null,
                        2
                      )}
                    </pre>
                  </div>
                ) : (
                  /* VISUALIZAÇÃO 2: MODO CARDS */
                  <div className="grid grid-cols-1 gap-2.5 max-h-[460px] overflow-y-auto pr-1">
                  {searchResults.map((job) => {
                    const isSelected = selectedIds.has(job.externalId);
                    return (
                      <div
                        key={job.externalId}
                        className={`p-3.5 rounded-xl border text-left transition flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${
                          job.alreadyImported
                            ? "border-emerald-200 bg-emerald-50/50"
                            : isSelected
                            ? "border-blue-500 bg-blue-50/60 ring-1 ring-blue-500"
                            : "border-[#e4e4e7] bg-white hover:bg-[#fafaf9]"
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={isSelected || job.alreadyImported}
                            disabled={job.alreadyImported}
                            onChange={() => toggleSelect(job.externalId)}
                            className="size-4 mt-0.5 rounded border-[#e4e4e7] text-blue-600 focus:ring-blue-600 cursor-pointer"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs font-bold text-[#0a0a0a] truncate">
                                {job.title}
                              </p>
                              {job.alreadyImported && (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 flex items-center gap-1">
                                  <Check className="size-2.5" />
                                  <span>No Seu Portal</span>
                                </span>
                              )}
                              {job.source && (
                                <span className="rounded-full bg-[#f4f4f5] px-2 py-0.5 text-[10px] font-medium text-[#71717a]">
                                  via {job.source}
                                </span>
                              )}
                              <span className="rounded-full bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 flex items-center gap-1">
                                <CheckCircle2 className="size-2.5 text-emerald-600" />
                                <span>Link Direto</span>
                              </span>
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

                            <div className="mt-1.5 flex items-center gap-2">
                              <a
                                href={job.applyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 underline underline-offset-2"
                                title="Conferir e testar o link direto da vaga na fonte original"
                              >
                                <span>Testar Link Direto da Vaga</span>
                                <ExternalLink className="size-3" />
                              </a>
                            </div>
                          </div>
                        </div>

                        {/* Ações da Vaga: 1-clique para publicar no portal + link ao vivo */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#f4f4f5]">
                          {job.alreadyImported ? (
                            <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
                              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                                <Check className="size-3" />
                                <span>No Seu Portal</span>
                              </span>
                              <Link
                                href={`/${companySlug}/vagas`}
                                target="_blank"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex h-9 sm:h-8 items-center justify-center gap-1 rounded-xl border border-emerald-300 bg-white px-3 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 transition shadow-2xs"
                                title="Ver vaga no seu portal público ao vivo"
                              >
                                <Globe className="size-3.5" />
                                <span>Ver ao Vivo ↗</span>
                              </Link>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePublishSingle(job);
                              }}
                              disabled={publishingId === job.externalId}
                              className="w-full sm:w-auto inline-flex h-11 sm:h-8 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition active:scale-95 disabled:opacity-50"
                              title="Publicar esta vaga imediatamente no seu portal público"
                            >
                              {publishingId === job.externalId ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Plus className="size-3.5" />
                              )}
                              <span>Exibir no Meu Portal</span>
                            </button>
                          )}

                          <a
                            href={job.applyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="hidden sm:inline-flex p-1.5 rounded-lg text-[#71717a] hover:bg-[#e4e4e7] hover:text-[#0a0a0a] transition shrink-0"
                            title="Abrir anúncio original na fonte externa"
                          >
                            <ExternalLink className="size-4" />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
                  placeholder="https://empresa.gupy.io/job/123456 ou linkedin.com/jobs/view/..."
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

              {directUrl.trim().length > 10 && isGenericSearchUrl(directUrl.trim()) && (
                <div className="mt-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2.5">
                  <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <p className="font-bold">Atenção ao link de busca:</p>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Este endereço parece ser uma página de busca ou catálogo geral (com múltiplos resultados).
                      Para que o candidato vá direto ao formulário da vaga específica sem se perder, prefira o link direto individual
                      (ex: <code className="font-mono bg-amber-100 px-1 rounded">empresa.gupy.io/job/...</code> ou <code className="font-mono bg-amber-100 px-1 rounded">linkedin.com/jobs/view/...</code>).
                    </p>
                  </div>
                </div>
              )}

              {directUrl.trim().length > 10 && !isGenericSearchUrl(directUrl.trim()) && (
                <div className="mt-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>✓ Link direto da vaga detectado:</strong> O candidato abrirá diretamente a página de candidatura desta oportunidade.
                  </span>
                </div>
              )}
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

      {/* Dashboard de Métricas e Telemetria do Mural */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-bold text-[#0a0a0a] flex items-center gap-2">
            <BarChart2 className="size-4 text-purple-600" />
            <span>Métricas e Desempenho do Mural de Oportunidades</span>
          </h2>
          <p className="text-xs text-[#71717a]">
            Acompanhe quantas pessoas visualizaram e clicaram para se candidatar nas vagas externas divulgadas no seu portal.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Vagas no Mural */}
          <div className="rounded-2xl border border-[#e4e4e7] bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between text-[#71717a] mb-1.5">
              <span className="text-xs font-semibold">Vagas no Mural</span>
              <Briefcase className="size-4 text-[#71717a]" />
            </div>
            <div className="text-2xl font-black text-[#0a0a0a] tracking-tight">
              {stats.totalJobs}
            </div>
            <p className="text-[11px] text-[#71717a] mt-0.5">
              <span className="text-emerald-700 font-bold">{stats.publishedJobs}</span> ativas no portal
            </p>
          </div>

          {/* Card 2: Visualizações */}
          <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 shadow-2xs">
            <div className="flex items-center justify-between text-blue-700 mb-1.5">
              <span className="text-xs font-semibold">Visualizações</span>
              <Eye className="size-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-blue-950 tracking-tight">
              {stats.totalViews.toLocaleString("pt-BR")}
            </div>
            <p className="text-[11px] text-blue-700/80 mt-0.5">
              Candidatos que viram o mural
            </p>
          </div>

          {/* Card 3: Cliques */}
          <div className="rounded-2xl border border-purple-100 bg-purple-50/60 p-4 shadow-2xs">
            <div className="flex items-center justify-between text-purple-700 mb-1.5">
              <span className="text-xs font-semibold">Cliques p/ Inscrição</span>
              <MousePointerClick className="size-4 text-purple-600" />
            </div>
            <div className="text-2xl font-black text-purple-950 tracking-tight">
              {stats.totalClicks.toLocaleString("pt-BR")}
            </div>
            <p className="text-[11px] text-purple-700/80 mt-0.5">
              Cliques no link oficial da vaga
            </p>
          </div>

          {/* Card 4: Taxa de Conversão */}
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 shadow-2xs">
            <div className="flex items-center justify-between text-emerald-700 mb-1.5">
              <span className="text-xs font-semibold">Taxa de Interesse (CTR)</span>
              <TrendingUp className="size-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-950 tracking-tight">
              {stats.averageCtr}%
            </div>
            <p className="text-[11px] text-emerald-700/80 mt-0.5">
              Média de cliques / visualizações
            </p>
          </div>
        </div>
      </div>

      {/* Lista de Vagas Externas Cadastradas no Portal */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[#0a0a0a]">
              Vagas Externas Cadastradas ({jobsList.length})
            </h3>
            <p className="text-xs text-[#71717a]">
              Oportunidades em exibição no mural público da sua empresa.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Seletor de Ordenação */}
            {jobsList.length > 0 && (
              <div className="flex items-center gap-1.5 rounded-xl border border-[#e4e4e7] bg-white px-2.5 py-1.5 text-xs text-[#71717a] shadow-2xs">
                <span className="font-medium text-[#a1a1aa]">Ordenar:</span>
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as "recent" | "views" | "clicks" | "ctr")}
                  className="bg-transparent font-semibold text-[#0a0a0a] focus:outline-none cursor-pointer"
                >
                  <option value="recent">Mais Recentes</option>
                  <option value="views">Mais Vistas (👁️)</option>
                  <option value="clicks">Mais Clicadas (🖱️)</option>
                  <option value="ctr">Maior Taxa CTR (%)</option>
                </select>
              </div>
            )}

            <Link
              href={`/${companySlug}/vagas`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50/80 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition shadow-2xs"
              title="Abrir o portal público de vagas em uma nova aba"
            >
              <Globe className="size-3.5 text-emerald-600" />
              <span>Ver Portal Público ao Vivo ↗</span>
            </Link>
          </div>
        </div>

        {jobsList.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#e4e4e7] bg-white p-8 text-center text-xs text-[#71717a]">
            Nenhuma vaga externa importada ainda. Use a ferramenta de busca do Google Vagas ou cole
            um link direto acima para divulgar as primeiras oportunidades!
          </div>
        ) : (
          <>
            {/* 1. VISUALIZAÇÃO MOBILE (CARDS AMPLOS E TÁTEIS COM TELEMETRIA) */}
            <div className="block md:hidden space-y-3">
              {sortedJobs.map((j) => {
                const jobCtr = calculateCtr(j.clicksCount ?? 0, j.viewsCount ?? 0);
                return (
                  <div
                    key={j.id}
                    className="rounded-2xl border border-[#e4e4e7] bg-white p-4 shadow-2xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-[15px] font-bold text-[#0a0a0a] leading-snug">
                          {j.title}
                        </h4>
                        <p className="text-xs text-[#52525b] mt-0.5 font-medium">
                          {j.employer} {j.location ? `· ${j.location}` : ""}
                        </p>
                      </div>

                      <span className="rounded-full bg-[#f4f4f5] px-2.5 py-0.5 text-[10px] font-medium text-[#71717a] shrink-0">
                        via {j.source || "Google Vagas"}
                      </span>
                    </div>

                    {/* Bloco de Métricas da Vaga */}
                    <div className="grid grid-cols-3 gap-2 rounded-xl bg-[#fafaf9] p-2.5 text-center text-xs border border-[#f4f4f5]">
                      <div>
                        <span className="block text-[10px] text-[#71717a] font-medium">Visualizações</span>
                        <span className="font-bold text-[#0a0a0a] flex items-center justify-center gap-1 mt-0.5">
                          <Eye className="size-3 text-blue-500" />
                          {j.viewsCount ?? 0}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-[#71717a] font-medium">Cliques</span>
                        <span className="font-bold text-[#0a0a0a] flex items-center justify-center gap-1 mt-0.5">
                          <MousePointerClick className="size-3 text-purple-500" />
                          {j.clicksCount ?? 0}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-[#71717a] font-medium">Taxa (CTR)</span>
                        <span
                          className={`font-bold block mt-0.5 ${
                            jobCtr > 0 ? "text-emerald-700" : "text-[#71717a]"
                          }`}
                        >
                          {jobCtr}%
                        </span>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-[#f4f4f5] flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleTogglePublished(j.id, j.isPublished)}
                        className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold transition active:scale-98 ${
                          j.isPublished
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        <span className={`size-2 rounded-full ${j.isPublished ? "bg-emerald-500" : "bg-slate-400"}`} />
                        <span>{j.isPublished ? "Publicada no Portal" : "Oculta do Portal"}</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <a
                          href={j.applyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex size-9 items-center justify-center rounded-xl text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#0a0a0a] transition border border-[#e4e4e7]"
                          title="Testar link na fonte"
                        >
                          <ExternalLink className="size-4" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDelete(j.id, j.title)}
                          className="inline-flex size-9 items-center justify-center rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition border border-rose-100"
                          title="Remover do mural"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 2. VISUALIZAÇÃO DESKTOP (TABELA COM COLUNAS DE TELEMETRIA) */}
            <div className="hidden md:block rounded-2xl border border-[#e4e4e7] bg-white overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#e4e4e7] bg-[#fafaf9] text-[#71717a] font-bold">
                    <tr>
                      <th className="py-3 px-4">Cargo / Título</th>
                      <th className="py-3 px-4">Empresa Anunciante</th>
                      <th className="py-3 px-4">Cidade</th>
                      <th className="py-3 px-4">Fonte</th>
                      <th className="py-3 px-4 text-center">Visualizações</th>
                      <th className="py-3 px-4 text-center">Cliques</th>
                      <th className="py-3 px-4 text-center">Conversão (CTR)</th>
                      <th className="py-3 px-4">Status no Portal</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f4f4f5]">
                    {sortedJobs.map((j) => {
                      const jobCtr = calculateCtr(j.clicksCount ?? 0, j.viewsCount ?? 0);
                      return (
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
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center gap-1 font-semibold text-[#0a0a0a]">
                              <Eye className="size-3 text-blue-500" />
                              {(j.viewsCount ?? 0).toLocaleString("pt-BR")}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center gap-1 font-semibold text-[#0a0a0a]">
                              <MousePointerClick className="size-3 text-purple-500" />
                              {(j.clicksCount ?? 0).toLocaleString("pt-BR")}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                                jobCtr > 0
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : "bg-[#f4f4f5] text-[#71717a] border-transparent"
                              }`}
                            >
                              {jobCtr}%
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

