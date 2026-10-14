"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  Briefcase,
  Check,
  ChevronRight,
  Copy,
  DollarSign,
  Download,
  ExternalLink,
  FileText,
  Filter,
  GraduationCap,
  Languages,
  MapPin,
  MessageCircle,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  User,
  X,
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
  Liderança: "bg-amber-50 text-amber-800 border-amber-200",
  Sênior: "bg-purple-50 text-purple-800 border-purple-200",
  Pleno: "bg-blue-50 text-blue-800 border-blue-200",
  Júnior: "bg-emerald-50 text-emerald-800 border-emerald-200",
  Operacional: "bg-stone-100 text-stone-700 border-stone-200",
  Estágio: "bg-cyan-50 text-cyan-800 border-cyan-200",
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
  });

  const [sort, setSort] = useState<CvSearchSort>("score");
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateCvCard | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [areaSearch, setAreaSearch] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isExtractingPhotos, startPhotoExtraction] = useTransition();

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

  const hasActiveFilters =
    Boolean(filters.keyword.trim()) ||
    filters.selectedAreas.length > 0 ||
    filters.selectedLevels.length > 0 ||
    Boolean(filters.selectedJobId) ||
    Boolean(filters.selectedStatus) ||
    filters.minScore !== null ||
    filters.onlyWithPhoto ||
    filters.onlyWithPdf;

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
    });
    setAreaSearch("");
  }

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
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
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-[#0a0a0a] px-4 py-3 text-sm text-white shadow-2xl animate-in fade-in slide-in-from-bottom-2">
          <Sparkles className="size-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Michelin */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#e4e4e7] pb-6 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-700">
              <Sparkles className="size-4" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">
              Banco de Talentos · Busca Inteligente
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#0a0a0a] sm:text-3xl">
            Buscar Currículos
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[#71717a]">
            Pesquise no conteúdo completo dos currículos em PDF, filtre por competências, cargos e
            níveis identificados pela IA.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isExtractingPhotos}
            onClick={handleExtractAllPhotos}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#e4e4e7] bg-white px-3.5 text-xs font-semibold text-[#0a0a0a] shadow-sm transition hover:bg-[#fafaf9] disabled:opacity-60"
          >
            <RotateCcw className={`size-3.5 ${isExtractingPhotos ? "animate-spin" : ""}`} />
            {isExtractingPhotos ? "Extraindo fotos…" : "Sincronizar fotos"}
          </button>
          <Link
            href="/candidaturas"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#e4e4e7] bg-white px-3.5 text-xs font-semibold text-[#71717a] shadow-sm transition hover:bg-[#fafaf9] hover:text-[#0a0a0a]"
          >
            Ver funil de vagas →
          </Link>
        </div>
      </div>

      {/* Banner de Estatísticas da Base */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#e4e4e7] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <span className="text-[11px] font-medium text-[#71717a]">Total de Talentos</span>
          <p className="mt-1 text-xl font-bold text-[#0a0a0a]">{candidates.length}</p>
        </div>
        <div className="rounded-2xl border border-[#e4e4e7] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <span className="text-[11px] font-medium text-[#71717a]">Com Foto Extraída</span>
          <p className="mt-1 text-xl font-bold text-[#0a0a0a]">
            {totalWithPhoto}{" "}
            <span className="text-xs font-normal text-[#a1a1aa]">
              ({candidates.length ? Math.round((totalWithPhoto / candidates.length) * 100) : 0}%)
            </span>
          </p>
        </div>
        <div className="rounded-2xl border border-[#e4e4e7] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <span className="text-[11px] font-medium text-[#71717a]">Com Currículo PDF</span>
          <p className="mt-1 text-xl font-bold text-[#0a0a0a]">{totalWithPdf}</p>
        </div>
        <div className="rounded-2xl border border-[#e4e4e7] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <span className="text-[11px] font-medium text-[#71717a]">Resultados Filtrados</span>
          <p className="mt-1 text-xl font-bold text-emerald-600">{sorted.length}</p>
        </div>
      </div>

      {/* Layout de 2 Colunas: Sidebar de Filtros Facetados (Esquerda) + Feed de Currículos (Direita) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[290px_1fr]">
        {/* COLUNA ESQUERDA: Filtros Facetados (Estilo InfoJobs Modernizado) */}
        <aside className="space-y-5">
          <div className="rounded-2xl border border-[#e4e4e7] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#f4f4f5] pb-3">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0a0a0a]">
                <Filter className="size-3.5" /> Filtros
              </span>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  Limpar
                </button>
              )}
            </div>

            {/* 1. Palavra-chave */}
            <div className="mt-4 space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#71717a]">
                Palavra-chave no Currículo
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-[#a1a1aa]" />
                <input
                  type="text"
                  value={filters.keyword}
                  onChange={(e) => setFilters((prev) => ({ ...prev, keyword: e.target.value }))}
                  placeholder="Ex: React, Contábil, Sped, CNH..."
                  className="w-full rounded-xl border border-[#e4e4e7] bg-[#fafaf9] py-2 pl-9 pr-8 text-xs text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[#0a0a0a] focus:bg-white focus:outline-none"
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
              <p className="text-[10px] text-[#a1a1aa]">
                Busca em todo o texto do PDF, cargo e resumo IA.
              </p>
            </div>

            {/* 2. Filtros Rápidos (Toggles Michelin) */}
            <div className="mt-5 space-y-2 border-t border-[#f4f4f5] pt-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#71717a]">
                Filtros Rápidos
              </span>
              <label className="flex cursor-pointer items-center justify-between rounded-lg px-1 py-1 text-xs text-[#0a0a0a] hover:bg-[#fafaf9]">
                <span className="flex items-center gap-2">
                  <span>📸</span> Somente com foto
                </span>
                <input
                  type="checkbox"
                  checked={filters.onlyWithPhoto}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, onlyWithPhoto: e.target.checked }))
                  }
                  className="size-4 accent-[#0a0a0a]"
                />
              </label>
              <label className="flex cursor-pointer items-center justify-between rounded-lg px-1 py-1 text-xs text-[#0a0a0a] hover:bg-[#fafaf9]">
                <span className="flex items-center gap-2">
                  <span>📄</span> Somente com PDF
                </span>
                <input
                  type="checkbox"
                  checked={filters.onlyWithPdf}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, onlyWithPdf: e.target.checked }))
                  }
                  className="size-4 accent-[#0a0a0a]"
                />
              </label>
            </div>

            {/* 3. Aderência Mínima (AI Score) */}
            <div className="mt-5 space-y-2 border-t border-[#f4f4f5] pt-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#71717a]">
                Aderência da IA
              </span>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { label: "Todos", val: null },
                  { label: "60%+", val: 60 },
                  { label: "80%+", val: 80 },
                ].map((item) => {
                  const active = filters.minScore === item.val;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setFilters((prev) => ({ ...prev, minScore: item.val }))}
                      className={`rounded-lg py-1.5 text-[11px] font-medium transition ${
                        active
                          ? "bg-[#0a0a0a] text-white"
                          : "border border-[#e4e4e7] bg-white text-[#71717a] hover:bg-[#fafaf9]"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Área Profissional */}
            <div className="mt-5 space-y-2 border-t border-[#f4f4f5] pt-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#71717a]">
                  Área Profissional
                </span>
                {filters.selectedAreas.length > 0 && (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.2 text-[10px] font-semibold text-amber-800">
                    {filters.selectedAreas.length}
                  </span>
                )}
              </div>

              {allAreas.length > 4 && (
                <input
                  type="text"
                  value={areaSearch}
                  onChange={(e) => setAreaSearch(e.target.value)}
                  placeholder="Filtrar áreas…"
                  className="w-full rounded-lg border border-[#e4e4e7] bg-[#fafaf9] px-2.5 py-1 text-[11px] text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:outline-none"
                />
              )}

              <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
                {visibleAreas.map((area) => {
                  const selected = filters.selectedAreas.includes(area.key);
                  return (
                    <label
                      key={area.key}
                      className={`flex cursor-pointer items-center justify-between rounded-lg px-2 py-1 text-xs transition ${
                        selected
                          ? "bg-[#0a0a0a] text-white font-medium"
                          : "text-[#3f3f46] hover:bg-[#fafaf9]"
                      }`}
                    >
                      <span className="truncate pr-2">{area.label}</span>
                      <span
                        className={`text-[10px] ${
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

            {/* 5. Senioridade / Nível */}
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
                      className={`flex cursor-pointer items-center justify-between rounded-lg px-2 py-1 text-xs transition ${
                        selected
                          ? "bg-[#0a0a0a] text-white font-medium"
                          : "text-[#3f3f46] hover:bg-[#fafaf9]"
                      }`}
                    >
                      <span className="truncate">{lvl.label}</span>
                      <span
                        className={`text-[10px] ${
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

            {/* 6. Vaga de Inscrição */}
            {jobs.length > 0 && (
              <div className="mt-5 space-y-2 border-t border-[#f4f4f5] pt-4">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#71717a]">
                  Vaga de Inscrição
                </span>
                <select
                  value={filters.selectedJobId}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, selectedJobId: e.target.value }))
                  }
                  className="w-full rounded-xl border border-[#e4e4e7] bg-white px-2.5 py-1.5 text-xs text-[#0a0a0a] focus:outline-none"
                >
                  <option value="">Todas as vagas</option>
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

        {/* COLUNA DIREITA: Feed de Candidatos Nível Michelin */}
        <main className="space-y-4">
          {/* Barra de Controle de Resultados e Ordenação */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e4e4e7] bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs text-[#71717a]">
              <span>
                <strong className="text-[#0a0a0a]">{sorted.length}</strong> candidato
                {sorted.length === 1 ? "" : "s"} encontrado{sorted.length === 1 ? "" : "s"}
              </span>
              {hasActiveFilters && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                  Filtros ativos
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-[#a1a1aa]">Ordenar por:</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as CvSearchSort)}
                className="h-8 rounded-lg border border-[#e4e4e7] bg-white px-2.5 text-xs font-medium text-[#0a0a0a] focus:outline-none"
              >
                <option value="score">Maior Aderência IA</option>
                <option value="recent">Mais Recentes</option>
                <option value="name">Nome (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Lista de Cards de Candidatos */}
          {sorted.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#e4e4e7] bg-white p-12 text-center">
              <User className="mx-auto size-8 text-[#a1a1aa]" />
              <h3 className="mt-3 text-sm font-semibold text-[#0a0a0a]">
                Nenhum currículo encontrado
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-xs text-[#71717a]">
                Tente ajustar as palavras-chave ou desmarcar alguns filtros na barra lateral.
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#0a0a0a] px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
                >
                  Limpar todos os filtros
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3.5">
              {sorted.map((item) => {
                const snippet = extractResumeSnippet(item.resumeText, filters.keyword);
                const levelBadgeClass = item.aiLevel ? LEVEL_COLORS[item.aiLevel] ?? "" : "";
                const cleanPhone = item.phone?.replace(/\D/g, "");
                const whatsappUrl = cleanPhone
                  ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(
                      `Olá ${item.name.split(" ")[0]}, tudo bem? Vimos seu perfil para uma oportunidade na nossa empresa.`
                    )}`
                  : null;

                return (
                  <div
                    key={item.id}
                    className="group relative rounded-2xl border border-[#e4e4e7] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition hover:border-[#0a0a0a]/30 hover:shadow-md"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      {/* Avatar + Informações Principais */}
                      <div className="flex min-w-0 items-start gap-4">
                        <CandidateAvatar
                          name={item.name}
                          photoUrl={item.photoUrl}
                          className="size-16 shrink-0 rounded-2xl bg-[#1c1917] text-lg font-bold text-white shadow-sm object-cover"
                        />

                        <div className="min-w-0 flex-1">
                          {/* Título de Cargo / Perfil em Destaque (Estilo InfoJobs Michelin) */}
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-base font-bold text-[#0a0a0a]">
                              {item.aiProfile || item.name}
                            </h2>
                            {item.aiLevel && (
                              <span
                                className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${levelBadgeClass}`}
                              >
                                {item.aiLevel}
                              </span>
                            )}
                            {item.aiArea && (
                              <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                                {item.aiArea}
                              </span>
                            )}
                          </div>

                          {/* Subtítulo: Nome real + Localização */}
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#71717a]">
                            <span className="font-medium text-[#3f3f46]">{item.name}</span>
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

                          {/* Resumo inteligente da IA */}
                          {item.aiReasoning && (
                            <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-[#52525b]">
                              <span className="font-medium text-[#0a0a0a]">Destaque IA:</span>{" "}
                              {item.aiReasoning}
                            </p>
                          )}

                          {/* Snippet do Currículo quando há busca */}
                          {snippet && (
                            <div className="mt-2.5 rounded-xl border border-amber-200 bg-amber-50/50 p-2.5 text-xs text-[#78350f]">
                              <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
                                <FileText className="size-3" /> Trecho do Currículo com a busca:
                              </span>
                              <p className="mt-1 italic leading-relaxed font-sans">{snippet}</p>
                            </div>
                          )}

                          {/* Metadados Extras estruturados (Salário, Formação, Idiomas) */}
                          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#71717a]">
                            {item.salaryExpectation && (
                              <span className="flex items-center gap-1 text-emerald-700">
                                <DollarSign className="size-3.5" />
                                Pretensão: {item.salaryExpectation}
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

                      {/* Score e Botão de Ação Direita */}
                      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#f4f4f5] pt-3 sm:flex-col sm:items-end sm:border-t-0 sm:pt-0">
                        {item.aiScore !== null && (
                          <div
                            className={`flex flex-col items-center rounded-xl px-3 py-1.5 text-center sm:items-end ${
                              item.aiScore >= item.job.aiMinScore
                                ? "bg-emerald-50 text-emerald-800"
                                : "bg-stone-50 text-stone-600"
                            }`}
                          >
                            <span className="text-[10px] font-semibold uppercase tracking-wider">
                              Aderência
                            </span>
                            <span className="text-lg font-bold leading-none">
                              {item.aiScore}%
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedCandidate(item)}
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#0a0a0a] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#27272a]"
                          >
                            Ver currículo
                            <ChevronRight className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Rodapé do Card: Contatos Rápidos e Links */}
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
                          onClick={() => handleCopy(`${item.name} <${item.email}>`, item.id)}
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
                            className="inline-flex items-center gap-1 text-emerald-700 hover:underline"
                          >
                            <MessageCircle className="size-3.5" />
                            Chamar WhatsApp
                          </a>
                        )}
                        {item.resumeUrl && (
                          <a
                            href={`/candidaturas/${item.id}/cv`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#71717a] hover:text-[#0a0a0a] hover:underline"
                          >
                            <Download className="size-3.5" />
                            PDF original
                          </a>
                        )}
                        <Link
                          href={`/candidaturas/${item.id}`}
                          className="inline-flex items-center gap-1 text-[#71717a] hover:text-[#0a0a0a] hover:underline"
                        >
                          <ExternalLink className="size-3.5" />
                          Dossiê completo
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

      {/* DRAWER LATERAL MICHELIN: Pré-visualização Instantânea do Candidato */}
      {selectedCandidate && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
          onClick={() => setSelectedCandidate(null)}
        >
          <div
            className="flex h-full w-full max-w-xl flex-col bg-white p-6 shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Drawer */}
            <div className="flex items-start justify-between border-b border-[#e4e4e7] pb-4">
              <div className="flex items-center gap-3">
                <CandidateAvatar
                  name={selectedCandidate.name}
                  photoUrl={selectedCandidate.photoUrl}
                  className="size-14 rounded-2xl bg-[#1c1917] text-lg font-bold text-white object-cover"
                />
                <div>
                  <h3 className="text-lg font-bold text-[#0a0a0a]">
                    {selectedCandidate.name}
                  </h3>
                  <p className="text-xs text-[#71717a]">
                    {selectedCandidate.aiProfile || selectedCandidate.job.title}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCandidate(null)}
                className="rounded-xl border border-[#e4e4e7] p-2 text-[#71717a] hover:bg-[#fafaf9] hover:text-[#0a0a0a]"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Conteúdo do Drawer */}
            <div className="mt-5 space-y-6">
              {/* Avaliação da IA */}
              <div className="rounded-2xl border border-[#e4e4e7] bg-[#fafaf9] p-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0a0a0a]">
                    <Sparkles className="size-4 text-amber-500" /> Avaliação da IA
                  </span>
                  {selectedCandidate.aiScore !== null && (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                      Score: {selectedCandidate.aiScore}%
                    </span>
                  )}
                </div>
                {selectedCandidate.aiReasoning && (
                  <p className="mt-2 text-xs leading-relaxed text-[#52525b]">
                    {selectedCandidate.aiReasoning}
                  </p>
                )}
              </div>

              {/* Informações de Contato */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#71717a]">
                  Contato & Detalhes
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl border border-[#e4e4e7] p-3">
                    <span className="text-[10px] text-[#a1a1aa]">E-mail</span>
                    <p className="mt-0.5 truncate font-medium text-[#0a0a0a]">
                      {selectedCandidate.email}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#e4e4e7] p-3">
                    <span className="text-[10px] text-[#a1a1aa]">Telefone</span>
                    <p className="mt-0.5 font-medium text-[#0a0a0a]">
                      {selectedCandidate.phone || "Não informado"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Texto Completo do Currículo Extraído */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#71717a]">
                    Texto do Currículo (Indexado)
                  </h4>
                  {selectedCandidate.resumeUrl && (
                    <a
                      href={`/candidaturas/${selectedCandidate.id}/cv`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                      Abrir PDF Original ↗
                    </a>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto rounded-2xl border border-[#e4e4e7] bg-[#fafaf9] p-4 text-xs leading-relaxed text-[#3f3f46] font-mono whitespace-pre-wrap">
                  {selectedCandidate.resumeText || (
                    <span className="italic text-[#a1a1aa]">
                      Texto do currículo ainda não foi indexado. Clique em &quot;Sincronizar fotos&quot;
                      para ler e indexar o PDF.
                    </span>
                  )}
                </div>
              </div>

              {/* Ações do Drawer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#e4e4e7]">
                <Link
                  href={`/candidaturas/${selectedCandidate.id}`}
                  className="rounded-xl border border-[#e4e4e7] bg-white px-4 py-2 text-xs font-semibold text-[#0a0a0a] hover:bg-[#fafaf9]"
                >
                  Abrir Dossiê Completo
                </Link>
                {selectedCandidate.phone && (
                  <a
                    href={`https://wa.me/55${selectedCandidate.phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm"
                  >
                    <MessageCircle className="size-3.5" />
                    Conversar no WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
