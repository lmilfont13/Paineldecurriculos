"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Award,
  BookOpen,
  Briefcase,
  Check,
  ChevronRight,
  Command,
  Copy,
  DollarSign,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  GraduationCap,
  Keyboard,
  Languages,
  Layers,
  MapPin,
  MessageCircle,
  Printer,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  User,
  X,
  Zap,
} from "lucide-react";

import { CandidateAvatar } from "@/components/gestor/candidate-avatar";
import { extractPhotosBulkAction } from "@/server/controllers/application.controller";
import {
  computeAreaFacets,
  computeLevelFacets,
  extractResumeSnippet,
  filterCandidates,
  sortCandidates,
  type CandidateCvCard,
  type CvSearchFilters,
  type CvSearchSort,
} from "@/server/models/cv-search.model";

const LEVEL_COLORS: Record<string, string> = {
  Liderança: "bg-amber-50 text-amber-900 border-amber-200",
  Sênior: "bg-purple-50 text-purple-900 border-purple-200",
  Pleno: "bg-blue-50 text-blue-900 border-blue-200",
  Júnior: "bg-emerald-50 text-emerald-900 border-emerald-200",
  Operacional: "bg-stone-100 text-stone-800 border-stone-200",
  Estágio: "bg-cyan-50 text-cyan-900 border-cyan-200",
};

export function BuscarCvsView({
  candidates,
  jobs,
}: {
  candidates: CandidateCvCard[];
  jobs: { id: string; title: string }[];
}) {
  const [filters, setFilters] = useState<CvSearchFilters>({
    keyword: "",
    selectedAreas: [],
    selectedLevels: [],
    selectedJobId: "",
    selectedStatus: "",
    minScore: null,
    onlyWithPhoto: false,
    onlyWithPdf: false,
    onlyRemote: false,
  });

  const [sort, setSort] = useState<CvSearchSort>("score");
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateCvCard | null>(null);
  const [drawerTab, setDrawerTab] = useState<"pdf" | "ai" | "text">("pdf");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [areaSearch, setAreaSearch] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showHotkeysHelp, setShowHotkeysHelp] = useState(true);
  const [isExtractingPhotos, startPhotoExtraction] = useTransition();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Facetas calculadas da base inteira
  const allAreas = useMemo(() => computeAreaFacets(candidates), [candidates]);
  const allLevels = useMemo(() => computeLevelFacets(candidates), [candidates]);

  // Áreas filtradas pelo mini-campo de busca da sidebar
  const visibleAreas = useMemo(() => {
    if (!areaSearch.trim()) return allAreas;
    const q = areaSearch.toLowerCase();
    return allAreas.filter((a) => a.label.toLowerCase().includes(q));
  }, [allAreas, areaSearch]);

  // Candidatos filtrados e ordenados
  const filtered = useMemo(() => filterCandidates(candidates, filters), [candidates, filters]);
  const sorted = useMemo(() => sortCandidates(filtered, sort), [filtered, sort]);

  // Estatísticas rápidas
  const totalWithPhoto = useMemo(() => candidates.filter((c) => Boolean(c.photoUrl)).length, [candidates]);
  const totalWithPdf = useMemo(() => candidates.filter((c) => Boolean(c.resumeUrl)).length, [candidates]);
  const topMatches = useMemo(() => candidates.filter((c) => (c.aiScore ?? 0) >= 80).length, [candidates]);

  const hasActiveFilters =
    Boolean(filters.keyword.trim()) ||
    filters.selectedAreas.length > 0 ||
    filters.selectedLevels.length > 0 ||
    Boolean(filters.selectedJobId) ||
    Boolean(filters.selectedStatus) ||
    filters.minScore !== null ||
    filters.onlyWithPhoto ||
    filters.onlyWithPdf ||
    Boolean(filters.onlyRemote);

  // Power Recruiter Keyboard Navigation (J/K, Enter, W, C, /, Esc)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignora se estiver digitando em campos de texto
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") {
        if (e.key === "Escape") {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      if (e.key === "/" || (e.key === "k" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.key === "Escape") {
        setSelectedCandidate(null);
        return;
      }

      if (sorted.length === 0) return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const next = Math.min(sorted.length - 1, prev + 1);
          cardRefs.current[next]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
          return next;
        });
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const next = Math.max(0, prev - 1);
          cardRefs.current[next]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
          return next;
        });
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const activeItem = sorted[selectedIndex];
        if (activeItem) {
          setSelectedCandidate(activeItem);
        }
      } else if (e.key === "w" || e.key === "W") {
        const activeItem = sorted[selectedIndex];
        const cleanPhone = activeItem?.phone?.replace(/\D/g, "");
        if (cleanPhone) {
          e.preventDefault();
          window.open(`https://wa.me/55${cleanPhone}`, "_blank");
        }
      } else if (e.key === "c" || e.key === "C") {
        const activeItem = sorted[selectedIndex];
        if (activeItem) {
          e.preventDefault();
          handleCopy(`${activeItem.name} <${activeItem.email}>`, activeItem.id);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sorted, selectedIndex]);

  function toggleArea(area: string) {
    setFilters((prev) => {
      const exists = prev.selectedAreas.includes(area);
      return {
        ...prev,
        selectedAreas: exists
          ? prev.selectedAreas.filter((a) => a !== area)
          : [...prev.selectedAreas, area],
      };
    });
  }

  function toggleLevel(level: string) {
    setFilters((prev) => {
      const exists = prev.selectedLevels.includes(level);
      return {
        ...prev,
        selectedLevels: exists
          ? prev.selectedLevels.filter((l) => l !== level)
          : [...prev.selectedLevels, level],
      };
    });
  }

  function clearAllFilters() {
    setFilters({
      keyword: "",
      selectedAreas: [],
      selectedLevels: [],
      selectedJobId: "",
      selectedStatus: "",
      minScore: null,
      onlyWithPhoto: false,
      onlyWithPdf: false,
      onlyRemote: false,
    });
    setAreaSearch("");
    setSelectedIndex(0);
  }

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setToastMessage("Contato copiado para a área de transferência!");
    setTimeout(() => {
      setCopiedId(null);
      setToastMessage(null);
    }, 2500);
  }

  function handleExtractAllPhotos() {
    startPhotoExtraction(async () => {
      try {
        const result = await extractPhotosBulkAction();
        setToastMessage(
          result.processed === 0
            ? "Todos os currículos já possuem foto processada!"
            : `${result.found} foto(s) extraída(s) de ${result.processed} currículo(s).`
        );
        setTimeout(() => setToastMessage(null), 4000);
      } catch {
        setToastMessage("Erro ao extrair fotos.");
        setTimeout(() => setToastMessage(null), 4000);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification Flutuante */}
      {toastMessage && (
        <div className="fixed bottom-16 right-6 z-50 flex items-center gap-2.5 rounded-2xl bg-[#0a0a0a] px-5 py-3.5 text-xs font-semibold text-white shadow-2xl animate-in fade-in slide-in-from-bottom-3">
          <Sparkles className="size-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Michelin de Última Geração */}
      <div className="relative overflow-hidden rounded-3xl border border-[#e4e4e7] bg-linear-to-b from-white via-white to-[#fafaf9] p-6 shadow-sm sm:p-8">
        <div className="relative z-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-lg bg-amber-500/15 text-amber-800">
                <Sparkles className="size-3.5" />
              </span>
              <span className="text-[11px] font-bold tracking-widest uppercase text-amber-800">
                Talent Intelligence · Base Aberta Michelin
              </span>
            </div>
            <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-[#0a0a0a] sm:text-3xl lg:text-4xl">
              Radar de Talentos & Currículos
            </h1>
            <p className="mt-2 max-w-2xl text-xs sm:text-sm text-[#71717a] leading-relaxed">
              Explore o acervo completo da empresa com busca semântica no PDF, tags de competências,
              scorecard de aderência e navegação instantânea por atalhos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={isExtractingPhotos}
              onClick={handleExtractAllPhotos}
              className="inline-flex h-9.5 items-center gap-2 rounded-xl border border-[#e4e4e7] bg-white px-4 text-xs font-semibold text-[#0a0a0a] shadow-xs transition hover:bg-[#fafaf9] hover:border-[#0a0a0a]/30 active:scale-98 disabled:opacity-60"
            >
              <RotateCcw className={`size-3.5 ${isExtractingPhotos ? "animate-spin" : ""}`} />
              {isExtractingPhotos ? "Extraindo fotos…" : "Sincronizar fotos do CV"}
            </button>
            <Link
              href="/candidaturas"
              className="inline-flex h-9.5 items-center gap-1.5 rounded-xl bg-[#0a0a0a] px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-[#27272a] active:scale-98"
            >
              Ver Funil por Vaga →
            </Link>
          </div>
        </div>

        {/* Barra de Filtros Rápidos Pré-configurados (Chips Inteligentes) */}
        <div className="relative z-10 mt-6 flex flex-wrap items-center gap-2 border-t border-[#f4f4f5] pt-4 text-xs">
          <span className="text-[11px] font-semibold text-[#71717a]">Acesso Rápido:</span>
          <button
            type="button"
            onClick={() => setFilters((p) => ({ ...p, minScore: p.minScore === 80 ? null : 80 }))}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition ${
              filters.minScore === 80
                ? "bg-amber-100 text-amber-950 font-semibold ring-1 ring-amber-300"
                : "bg-white border border-[#e4e4e7] text-[#52525b] hover:bg-[#f4f4f5]"
            }`}
          >
            <Zap className="size-3 text-amber-600" />
            Top Match (80%+) ({topMatches})
          </button>
          <button
            type="button"
            onClick={() => setFilters((p) => ({ ...p, onlyWithPhoto: !p.onlyWithPhoto }))}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition ${
              filters.onlyWithPhoto
                ? "bg-[#0a0a0a] text-white font-semibold"
                : "bg-white border border-[#e4e4e7] text-[#52525b] hover:bg-[#f4f4f5]"
            }`}
          >
            <span>📸</span> Com foto ({totalWithPhoto})
          </button>
          <button
            type="button"
            onClick={() => setFilters((p) => ({ ...p, onlyWithPdf: !p.onlyWithPdf }))}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition ${
              filters.onlyWithPdf
                ? "bg-[#0a0a0a] text-white font-semibold"
                : "bg-white border border-[#e4e4e7] text-[#52525b] hover:bg-[#f4f4f5]"
            }`}
          >
            <FileText className="size-3 text-blue-600" /> Com PDF ({totalWithPdf})
          </button>
          <button
            type="button"
            onClick={() => setFilters((p) => ({ ...p, onlyRemote: !p.onlyRemote }))}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition ${
              filters.onlyRemote
                ? "bg-[#0a0a0a] text-white font-semibold"
                : "bg-white border border-[#e4e4e7] text-[#52525b] hover:bg-[#f4f4f5]"
            }`}
          >
            <MapPin className="size-3 text-purple-600" /> Remoto
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-[11px] font-semibold text-red-600 hover:underline ml-auto"
            >
              Limpar todos
            </button>
          )}
        </div>
      </div>

      {/* Grid Principal: Sidebar Facetada (Esquerda) + Feed de Candidatos (Direita) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
        {/* BARRA LATERAL ESQUERDA: Filtros Facetados (Padrão InfoJobs Michelin) */}
        <aside className="space-y-4">
          <div className="rounded-3xl border border-[#e4e4e7] bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#f4f4f5] pb-3.5">
              <span className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase text-[#0a0a0a]">
                <Filter className="size-3.5 text-stone-500" /> Filtros Facetados
              </span>
              <span className="text-[11px] text-[#71717a] font-medium">
                {sorted.length} de {candidates.length}
              </span>
            </div>

            {/* 1. Busca Booleana & Palavra-chave no Currículo */}
            <div className="mt-4 space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#71717a]">
                Palavra-chave no Currículo
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-[#a1a1aa]" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={filters.keyword}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, keyword: e.target.value }))
                  }
                  placeholder="Ex: React, Sped, Vendas, CNH..."
                  className="w-full rounded-xl border border-[#e4e4e7] bg-[#fafaf9] py-2 pl-9 pr-8 text-xs text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[#0a0a0a] focus:bg-white focus:outline-none transition"
                />
                {filters.keyword && (
                  <button
                    type="button"
                    onClick={() => setFilters((prev) => ({ ...prev, keyword: "" }))}
                    className="absolute right-2.5 top-2.5 text-[#a1a1aa] hover:text-[#0a0a0a]"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-[#a1a1aa] leading-tight">
                Suporta busca booleana: <code className="bg-stone-100 px-1 py-0.5 rounded">AND</code>,{" "}
                <code className="bg-stone-100 px-1 py-0.5 rounded">OR</code>,{" "}
                <code className="bg-stone-100 px-1 py-0.5 rounded">NOT</code>.
              </p>
            </div>

            {/* 2. Área Profissional */}
            <div className="mt-5 space-y-2 border-t border-[#f4f4f5] pt-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#71717a]">
                  Área Profissional
                </span>
                {filters.selectedAreas.length > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    {filters.selectedAreas.length} selecionada(s)
                  </span>
                )}
              </div>

              {allAreas.length > 4 && (
                <input
                  type="text"
                  value={areaSearch}
                  onChange={(e) => setAreaSearch(e.target.value)}
                  placeholder="Pesquisar áreas…"
                  className="w-full rounded-lg border border-[#e4e4e7] bg-[#fafaf9] px-2.5 py-1 text-[11px] text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:outline-none"
                />
              )}

              <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
                {visibleAreas.map((area) => {
                  const selected = filters.selectedAreas.includes(area.key);
                  return (
                    <label
                      key={area.key}
                      className={`flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition ${
                        selected
                          ? "bg-[#0a0a0a] text-white font-medium shadow-xs"
                          : "text-[#3f3f46] hover:bg-[#fafaf9]"
                      }`}
                    >
                      <span className="truncate pr-2">{area.label}</span>
                      <span
                        className={`text-[10px] font-mono ${
                          selected ? "text-white/80" : "text-[#a1a1aa]"
                        }`}
                      >
                        ({area.count})
                      </span>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleArea(area.key)}
                        className="sr-only"
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 3. Nível de Senioridade */}
            <div className="mt-5 space-y-2 border-t border-[#f4f4f5] pt-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#71717a]">
                Senioridade
              </span>
              <div className="space-y-1">
                {allLevels.map((lvl) => {
                  const selected = filters.selectedLevels.includes(lvl.key);
                  return (
                    <label
                      key={lvl.key}
                      className={`flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition ${
                        selected
                          ? "bg-[#0a0a0a] text-white font-medium shadow-xs"
                          : "text-[#3f3f46] hover:bg-[#fafaf9]"
                      }`}
                    >
                      <span className="truncate">{lvl.label}</span>
                      <span
                        className={`text-[10px] font-mono ${
                          selected ? "text-white/80" : "text-[#a1a1aa]"
                        }`}
                      >
                        ({lvl.count})
                      </span>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleLevel(lvl.key)}
                        className="sr-only"
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 4. Vagas de Inscrição */}
            {jobs.length > 0 && (
              <div className="mt-5 space-y-2 border-t border-[#f4f4f5] pt-4">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#71717a]">
                  Vaga de Origem
                </span>
                <select
                  value={filters.selectedJobId}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, selectedJobId: e.target.value }))
                  }
                  className="w-full rounded-xl border border-[#e4e4e7] bg-white px-2.5 py-2 text-xs text-[#0a0a0a] focus:border-[#0a0a0a] focus:outline-none"
                >
                  <option value="">Todas as vagas da empresa</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </aside>

        {/* FEED PRINCIPAL: Dossiês Executivos de Candidatos (Direita) */}
        <main className="space-y-4">
          {/* Header da Lista de Resultados */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e4e4e7] bg-white px-5 py-3.5 shadow-xs">
            <div className="flex items-center gap-2 text-xs text-[#71717a]">
              <span>
                <strong className="text-sm font-bold text-[#0a0a0a]">{sorted.length}</strong>{" "}
                talento{sorted.length === 1 ? "" : "s"} encontrado{sorted.length === 1 ? "" : "s"}
              </span>
              {hasActiveFilters && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 ring-1 ring-amber-200">
                  Filtros Ativos
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-[#a1a1aa]">Ordenar:</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as CvSearchSort)}
                className="h-8.5 rounded-xl border border-[#e4e4e7] bg-white px-3 text-xs font-semibold text-[#0a0a0a] focus:outline-none"
              >
                <option value="score">✨ Maior Aderência IA</option>
                <option value="recent">📅 Mais Recentes</option>
                <option value="name">🔤 Nome (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Lista de Dossiês */}
          {sorted.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#e4e4e7] bg-white p-14 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-stone-100 text-[#71717a]">
                <User className="size-6" />
              </div>
              <h3 className="mt-4 text-base font-bold text-[#0a0a0a]">
                Nenhum talento encontrado com esses filtros
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-xs text-[#71717a]">
                Tente buscar termos mais amplos ou remover filtros específicos na barra lateral.
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#0a0a0a] px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#27272a]"
                >
                  Limpar todos os filtros
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {sorted.map((item, index) => {
                const isSelected = selectedIndex === index;
                const snippet = extractResumeSnippet(item.resumeText, filters.keyword);
                const levelBadgeClass = item.aiLevel ? LEVEL_COLORS[item.aiLevel] ?? "" : "";
                const isTopMatch = (item.aiScore ?? 0) >= 85;

                const cleanPhone = item.phone?.replace(/\D/g, "");
                const whatsappUrl = cleanPhone
                  ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(
                      `Olá ${item.name.split(" ")[0]}, tudo bem? Vimos seu perfil e gostaríamos de conversar sobre uma oportunidade.`
                    )}`
                  : null;

                return (
                  <div
                    key={item.id}
                    ref={(el) => {
                      cardRefs.current[index] = el;
                    }}
                    onClick={() => setSelectedIndex(index)}
                    className={`group relative rounded-3xl border bg-white p-6 transition duration-150 ${
                      isSelected
                        ? "border-[#0a0a0a] ring-2 ring-[#0a0a0a]/10 shadow-lg scale-[1.003]"
                        : "border-[#e4e4e7] hover:border-[#0a0a0a]/30 shadow-xs hover:shadow-md"
                    } ${isTopMatch ? "border-amber-300/80 bg-linear-to-b from-amber-50/20 via-white to-white" : ""}`}
                  >
                    {/* Top Match Banner (Michelin Glow) */}
                    {isTopMatch && (
                      <div className="mb-3 flex items-center gap-1.5 text-[11px] font-bold text-amber-800">
                        <Sparkles className="size-3.5 text-amber-500 fill-amber-400" />
                        <span>TOP MATCH IA · FORTE ADERÊNCIA</span>
                      </div>
                    )}

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      {/* Avatar e Perfil */}
                      <div className="flex min-w-0 items-start gap-4">
                        <div className="relative shrink-0">
                          <CandidateAvatar
                            name={item.name}
                            photoUrl={item.photoUrl}
                            className="size-16 sm:size-20 rounded-2xl bg-[#1c1917] text-xl font-bold text-white shadow-xs object-cover"
                          />
                          {item.aiScore !== null && (
                            <span
                              className={`absolute -bottom-2 -right-2 flex size-7 items-center justify-center rounded-full text-[10px] font-bold shadow-xs ${
                                item.aiScore >= 80
                                  ? "bg-emerald-600 text-white"
                                  : item.aiScore >= 60
                                  ? "bg-amber-500 text-white"
                                  : "bg-stone-200 text-stone-700"
                              }`}
                            >
                              {item.aiScore}%
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          {/* Título de Cargo / Perfil em Destaque */}
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-base sm:text-lg font-bold text-[#0a0a0a]">
                              {item.aiProfile || item.name}
                            </h2>
                            {item.aiLevel && (
                              <span
                                className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${levelBadgeClass}`}
                              >
                                {item.aiLevel}
                              </span>
                            )}
                            {item.aiArea && (
                              <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-700">
                                {item.aiArea}
                              </span>
                            )}
                          </div>

                          {/* Nome Real + Vaga + Localização */}
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#71717a]">
                            <span className="font-semibold text-[#0a0a0a]">{item.name}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Briefcase className="size-3 text-[#a1a1aa]" />
                              {item.job.title}
                            </span>
                            {item.job.location && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="size-3 text-[#a1a1aa]" />
                                  {item.job.location}
                                </span>
                              </>
                            )}
                          </div>

                          {/* Resumo da IA */}
                          {item.aiReasoning && (
                            <p className="mt-3 text-xs leading-relaxed text-[#52525b] line-clamp-2">
                              <span className="font-bold text-[#0a0a0a]">Síntese da IA:</span>{" "}
                              {item.aiReasoning}
                            </p>
                          )}

                          {/* Snippet do Currículo quando há busca */}
                          {snippet && (
                            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-950">
                              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                                <FileText className="size-3.5" />
                                Trecho localizado no currículo:
                              </div>
                              <p className="mt-1 italic leading-relaxed">{snippet}</p>
                            </div>
                          )}

                          {/* Tags Inteligentes de Competências Detectadas */}
                          {item.skills && item.skills.length > 0 && (
                            <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                              {item.skills.map((skill) => (
                                <button
                                  key={skill}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFilters((p) => ({ ...p, keyword: skill }));
                                  }}
                                  className="rounded-lg border border-[#e4e4e7] bg-[#fafaf9] px-2 py-0.5 text-[11px] font-medium text-[#3f3f46] hover:bg-white hover:border-[#0a0a0a] transition"
                                  title={`Filtrar por ${skill}`}
                                >
                                  {skill}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Metadados Extras estruturados */}
                          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#71717a]">
                            {item.salaryExpectation && (
                              <span className="flex items-center gap-1 text-emerald-800 font-medium">
                                <DollarSign className="size-3.5 text-emerald-600" />
                                {item.salaryExpectation}
                              </span>
                            )}
                            {item.education && (
                              <span className="flex items-center gap-1 text-[#52525b]">
                                <GraduationCap className="size-3.5 text-[#a1a1aa]" />
                                {item.education}
                              </span>
                            )}
                            {item.languages && (
                              <span className="flex items-center gap-1 text-[#52525b]">
                                <Languages className="size-3.5 text-[#a1a1aa]" />
                                {item.languages}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Botão de Ação Direita */}
                      <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCandidate(item);
                            setDrawerTab(item.resumeUrl ? "pdf" : "ai");
                          }}
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#0a0a0a] px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-[#27272a] active:scale-98"
                        >
                          <Eye className="size-3.5" />
                          Ver Dossiê / PDF
                        </button>
                      </div>
                    </div>

                    {/* Rodapé do Card */}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#f4f4f5] pt-3 text-xs">
                      <div className="flex items-center gap-2 text-[#71717a]">
                        <span>{item.email}</span>
                        {item.phone && (
                          <>
                            <span>•</span>
                            <span>{item.phone}</span>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(`${item.name} <${item.email}>`, item.id);
                          }}
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-[#a1a1aa] hover:bg-[#fafaf9] hover:text-[#0a0a0a]"
                        >
                          {copiedId === item.id ? (
                            <Check className="size-3 text-emerald-600" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                          {copiedId === item.id ? "Copiado!" : "Copiar"}
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        {whatsappUrl && (
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-emerald-700 font-semibold hover:underline"
                          >
                            <MessageCircle className="size-3.5" />
                            WhatsApp
                          </a>
                        )}
                        {item.resumeUrl && (
                          <a
                            href={`/candidaturas/${item.id}/cv`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-[#71717a] hover:text-[#0a0a0a] hover:underline"
                          >
                            <Download className="size-3.5" />
                            PDF
                          </a>
                        )}
                        <Link
                          href={`/candidaturas/${item.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[#71717a] hover:text-[#0a0a0a] hover:underline"
                        >
                          <ExternalLink className="size-3.5" />
                          Página
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* BARRA DE ATALHOS FLUTUANTE (Power Recruiter Bar) */}
      {showHotkeysHelp && (
        <div className="fixed bottom-4 left-1/2 z-40 hidden -translate-x-1/2 items-center gap-3 rounded-full border border-[#e4e4e7] bg-white/95 px-4 py-2 text-[11px] font-semibold text-[#52525b] shadow-xl backdrop-blur-md md:flex animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-1 text-[#0a0a0a]">
            <Keyboard className="size-3.5 text-amber-600" />
            <span>Atalhos:</span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[10px] text-stone-700">J</kbd>
            <kbd className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[10px] text-stone-700">K</kbd>
            Navegar
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[10px] text-stone-700">Enter</kbd>
            Abrir
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[10px] text-stone-700">W</kbd>
            WhatsApp
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[10px] text-stone-700">/</kbd>
            Buscar
          </span>
          <button
            type="button"
            onClick={() => setShowHotkeysHelp(false)}
            className="text-stone-400 hover:text-stone-700 ml-1"
            title="Ocultar barra de atalhos"
          >
            <X className="size-3" />
          </button>
        </div>
      )}

      {/* DRAWER LATERAL MICHELIN: Split Viewer com PDF Real e Dossiê */}
      {selectedCandidate && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-xs transition-opacity animate-in fade-in"
          onClick={() => setSelectedCandidate(null)}
        >
          <div
            className="flex h-full w-full max-w-2xl flex-col bg-white p-6 shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Topo do Drawer */}
            <div className="flex items-start justify-between border-b border-[#e4e4e7] pb-4">
              <div className="flex items-center gap-3.5">
                <CandidateAvatar
                  name={selectedCandidate.name}
                  photoUrl={selectedCandidate.photoUrl}
                  className="size-14 rounded-2xl bg-[#1c1917] text-lg font-bold text-white shadow-xs object-cover"
                />
                <div>
                  <h3 className="text-lg font-bold text-[#0a0a0a]">
                    {selectedCandidate.name}
                  </h3>
                  <p className="text-xs font-medium text-[#71717a]">
                    {selectedCandidate.aiProfile || selectedCandidate.job.title}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#e4e4e7] px-3 py-1.5 text-xs font-semibold text-[#0a0a0a] hover:bg-[#fafaf9]"
                  title="Imprimir Dossiê Executivo"
                >
                  <Printer className="size-3.5" />
                  Imprimir
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCandidate(null)}
                  className="rounded-xl border border-[#e4e4e7] p-2 text-[#71717a] hover:bg-[#fafaf9] hover:text-[#0a0a0a]"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Abas do Visualizador: PDF Real vs Dossiê IA vs Texto */}
            <div className="mt-4 flex border-b border-[#e4e4e7] gap-2">
              {selectedCandidate.resumeUrl && (
                <button
                  type="button"
                  onClick={() => setDrawerTab("pdf")}
                  className={`border-b-2 pb-2.5 text-xs font-bold transition ${
                    drawerTab === "pdf"
                      ? "border-[#0a0a0a] text-[#0a0a0a]"
                      : "border-transparent text-[#71717a] hover:text-[#0a0a0a]"
                  }`}
                >
                  📄 Currículo em PDF Real
                </button>
              )}
              <button
                type="button"
                onClick={() => setDrawerTab("ai")}
                className={`border-b-2 pb-2.5 text-xs font-bold transition ${
                  drawerTab === "ai"
                    ? "border-[#0a0a0a] text-[#0a0a0a]"
                    : "border-transparent text-[#71717a] hover:text-[#0a0a0a]"
                }`}
              >
                ✨ Dossiê da IA
              </button>
              <button
                type="button"
                onClick={() => setDrawerTab("text")}
                className={`border-b-2 pb-2.5 text-xs font-bold transition ${
                  drawerTab === "text"
                    ? "border-[#0a0a0a] text-[#0a0a0a]"
                    : "border-transparent text-[#71717a] hover:text-[#0a0a0a]"
                }`}
              >
                📝 Texto Extraído
              </button>
            </div>

            {/* Conteúdo Dinâmico por Aba */}
            <div className="mt-4 flex-1">
              {/* ABA 1: PDF Viewer Embutido */}
              {drawerTab === "pdf" && selectedCandidate.resumeUrl && (
                <div className="h-[650px] w-full rounded-2xl border border-[#e4e4e7] overflow-hidden bg-stone-100">
                  <iframe
                    src={`/candidaturas/${selectedCandidate.id}/cv#toolbar=1`}
                    className="h-full w-full border-none"
                    title={`Currículo de ${selectedCandidate.name}`}
                  />
                </div>
              )}

              {/* ABA 2: Análise da IA */}
              {drawerTab === "ai" && (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-[#e4e4e7] bg-linear-to-b from-amber-50/40 to-white p-5">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-900">
                        <Sparkles className="size-4 text-amber-500 fill-amber-400" /> Scorecard da IA
                      </span>
                      {selectedCandidate.aiScore !== null && (
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800">
                          {selectedCandidate.aiScore}% de Compatibilidade
                        </span>
                      )}
                    </div>
                    {selectedCandidate.aiReasoning && (
                      <p className="mt-3 text-xs leading-relaxed text-[#52525b]">
                        {selectedCandidate.aiReasoning}
                      </p>
                    )}
                  </div>

                  {/* Detalhes de Contato */}
                  <div className="rounded-2xl border border-[#e4e4e7] p-4 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#71717a]">
                      Dados de Contato
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] text-[#a1a1aa]">E-mail</span>
                        <p className="font-semibold text-[#0a0a0a]">{selectedCandidate.email}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#a1a1aa]">Telefone</span>
                        <p className="font-semibold text-[#0a0a0a]">
                          {selectedCandidate.phone || "Não informado"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Competências */}
                  {selectedCandidate.skills && selectedCandidate.skills.length > 0 && (
                    <div className="rounded-2xl border border-[#e4e4e7] p-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#71717a] mb-2.5">
                        Competências Chave Identificadas
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedCandidate.skills.map((skill) => (
                          <span
                            key={skill}
                            className="rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ABA 3: Texto Completo Extraído */}
              {drawerTab === "text" && (
                <div className="max-h-[600px] overflow-y-auto rounded-2xl border border-[#e4e4e7] bg-[#fafaf9] p-5 text-xs font-mono leading-relaxed text-[#3f3f46] whitespace-pre-wrap">
                  {selectedCandidate.resumeText || (
                    <span className="italic text-[#a1a1aa]">
                      O texto deste currículo ainda não foi lido. Clique em &quot;Sincronizar fotos do CV&quot;
                      para indexar o arquivo PDF.
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Rodapé do Drawer */}
            <div className="mt-6 flex items-center justify-between border-t border-[#e4e4e7] pt-4">
              <Link
                href={`/candidaturas/${selectedCandidate.id}`}
                className="text-xs font-semibold text-[#0a0a0a] hover:underline"
              >
                Abrir processo seletivo completo →
              </Link>
              {selectedCandidate.phone && (
                <a
                  href={`https://wa.me/55${selectedCandidate.phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
                >
                  <MessageCircle className="size-3.5" />
                  Chamar no WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
