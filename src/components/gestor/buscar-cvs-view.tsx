"use client";

import { formatPhone } from "@/lib/phone";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  AtSign,
  Award,
  BookOpen,
  Briefcase,
  Calendar,
  Car,
  Check,
  ChevronRight,
  Command,
  Building2,
  Compass,
  Copy,
  DollarSign,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  GraduationCap,
  HeartHandshake,
  Home,
  Keyboard,
  Languages,
  Layers,
  List,
  MapPin,
  MessageCircle,
  Printer,
  RotateCcw,
  Rows3,
  Search,
  SlidersHorizontal,
  Sparkles,
  Target,
  User,
  X,
  Zap,
} from "lucide-react";

import { ZoomableCandidateAvatar } from "@/components/gestor/zoomable-candidate-avatar";
import { instagramUrl } from "@/server/models/instagram.model";
import { extractPhotosBulkAction } from "@/server/controllers/application.controller";
import {
  calculateAge,
  computeAreaFacets,
  computeDesiredRoleFacets,
  computeLevelFacets,
  computeNeighborhoodFacets,
  computeCompanyFacets,
  normalizeText,
  extractResumeSnippet,
  dedupeCandidatesByPerson,
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
    nameQuery: "",
    selectedAreas: [],
    selectedLevels: [],
    selectedJobId: "",
    selectedStatus: "",
    minScore: null,
    onlyWithPhoto: false,
    onlyWithPdf: false,
    onlyRemote: false,
    selectedNeighborhood: "",
    selectedCity: "",
    selectedDesiredRole: "",
    selectedWorkPreference: "",
    selectedCnh: "",
    onlyPcd: false,
    ageBracket: "",
    salaryBracket: "",
  });

  const [sort, setSort] = useState<CvSearchSort>("score");
  const [viewMode, setViewMode] = useState<"detailed" | "compact">(() => {
    if (typeof window === "undefined") return "detailed";
    const stored = window.localStorage.getItem("buscar-cvs-view-mode");
    return stored === "detailed" || stored === "compact" ? stored : "detailed";
  });
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateCvCard | null>(null);
  const [drawerTab, setDrawerTab] = useState<"pdf" | "ai" | "text">("pdf");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [areaSearch, setAreaSearch] = useState("");
  const [neighborhoodSearch, setNeighborhoodSearch] = useState("");
  const [roleSearch, setRoleSearch] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showHotkeysHelp, setShowHotkeysHelp] = useState(true);
  const [isExtractingPhotos, startPhotoExtraction] = useTransition();
  const [, startViewTransition] = useTransition();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Lembra o modo de exibição escolhido (Dossiê x Compacto) entre visitas
  useEffect(() => {
    window.localStorage.setItem("buscar-cvs-view-mode", viewMode);
  }, [viewMode]);

  // Facetas calculadas da base inteira
  // Uma entrada por pessoa: quem se candidatou a várias vagas não aparece repetido.
  const people = useMemo(() => dedupeCandidatesByPerson(candidates), [candidates]);

  const allAreas = useMemo(() => computeAreaFacets(people), [people]);
  const allLevels = useMemo(() => computeLevelFacets(people), [people]);
  const allNeighborhoods = useMemo(() => computeNeighborhoodFacets(people), [people]);
  const allRoles = useMemo(() => computeDesiredRoleFacets(people), [people]);

  // Filtros de busca rápida dentro das listas da sidebar
  const visibleAreas = useMemo(() => {
    if (!areaSearch.trim()) return allAreas;
    const q = areaSearch.toLowerCase();
    return allAreas.filter((a) => a.label.toLowerCase().includes(q));
  }, [allAreas, areaSearch]);

  const visibleNeighborhoods = useMemo(() => {
    if (!neighborhoodSearch.trim()) return allNeighborhoods;
    const q = neighborhoodSearch.toLowerCase();
    return allNeighborhoods.filter((n) => n.label.toLowerCase().includes(q));
  }, [allNeighborhoods, neighborhoodSearch]);

  // Empresas encontradas nos históricos dos currículos (escolha por clique)
  const allCompanies = useMemo(() => computeCompanyFacets(people), [people]);
  const selectedCompanies = useMemo(
    () =>
      (filters.previousCompany ?? "")
        .split(/[,;]/)
        .map((c) => c.trim())
        .filter(Boolean),
    [filters.previousCompany]
  );
  const visibleCompanies = useMemo(() => {
    const typing = (filters.previousCompany ?? "").split(/[,;]/).pop() ?? "";
    const q = normalizeText(typing);
    return q ? allCompanies.filter((c) => normalizeText(c.label).includes(q)) : allCompanies;
  }, [allCompanies, filters.previousCompany]);

  function toggleCompany(label: string) {
    const key = normalizeText(label);
    const exists = selectedCompanies.some((c) => normalizeText(c) === key);
    const next = exists
      ? selectedCompanies.filter((c) => normalizeText(c) !== key)
      : [...selectedCompanies, label];
    setFilters((p) => ({ ...p, previousCompany: next.length ? next.join(", ") + ", " : "" }));
  }

  const visibleRoles = useMemo(() => {
    if (!roleSearch.trim()) return allRoles;
    const q = roleSearch.toLowerCase();
    return allRoles.filter((r) => r.label.toLowerCase().includes(q));
  }, [allRoles, roleSearch]);

  // Candidatos filtrados e ordenados
  // Filtra as candidaturas (para o filtro de vaga valer) e só então junta por pessoa.
  const filtered = useMemo(
    () => dedupeCandidatesByPerson(filterCandidates(candidates, filters)),
    [candidates, filters]
  );
  const sorted = useMemo(() => sortCandidates(filtered, sort), [filtered, sort]);

  // Estatísticas rápidas
  const totalWithPhoto = useMemo(() => people.filter((c) => Boolean(c.photoUrl)).length, [people]);
  const totalWithPdf = useMemo(() => people.filter((c) => Boolean(c.resumeUrl)).length, [people]);
  const topMatches = useMemo(() => people.filter((c) => (c.aiScore ?? 0) >= 80).length, [people]);

  const hasActiveFilters =
    Boolean(filters.keyword.trim()) ||
    Boolean(filters.nameQuery?.trim()) ||
    filters.selectedAreas.length > 0 ||
    filters.selectedLevels.length > 0 ||
    Boolean(filters.selectedJobId) ||
    Boolean(filters.selectedStatus) ||
    filters.minScore !== null ||
    filters.onlyWithPhoto ||
    filters.onlyWithPdf ||
    Boolean(filters.onlyRemote) ||
    Boolean(filters.selectedNeighborhood) ||
    Boolean(filters.selectedCity) ||
    Boolean(filters.selectedDesiredRole) ||
    Boolean(filters.selectedWorkPreference) ||
    Boolean(filters.selectedCnh) ||
    Boolean(filters.onlyPcd) ||
    Boolean(filters.ageBracket) ||
    Boolean(filters.salaryBracket) ||
    Boolean(filters.previousCompany?.trim());

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
      nameQuery: "",
      selectedAreas: [],
      selectedLevels: [],
      selectedJobId: "",
      selectedStatus: "",
      minScore: null,
      onlyWithPhoto: false,
      onlyWithPdf: false,
      onlyRemote: false,
      selectedNeighborhood: "",
      selectedCity: "",
      selectedDesiredRole: "",
      selectedWorkPreference: "",
      selectedCnh: "",
      onlyPcd: false,
      ageBracket: "",
      salaryBracket: "",
      previousCompany: "",
    });
    setAreaSearch("");
    setNeighborhoodSearch("");
    setRoleSearch("");
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
                Talent Intelligence · Base Aberta
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
            <a
              href="/buscar-cvs/relatorio"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9.5 items-center gap-2 rounded-xl border border-amber-300 bg-linear-to-b from-amber-50 to-amber-100/70 px-4 text-xs font-bold text-amber-950 shadow-xs transition hover:from-amber-100 hover:to-amber-200/80 hover:border-amber-400 active:scale-98"
              title="Baixar Dashboard Executivo Completo em PDF (Gênero, Idade, Cargos, Empresas e Experiências)"
            >
              <FileText className="size-3.5 text-amber-800" />
              <span>Dashboard PDF</span>
            </a>
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
        {/* Fixa no desktop com rolagem própria, independente da rolagem da lista de candidatos */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
          <div className="rounded-3xl border border-[#e4e4e7] bg-white p-5 shadow-xs">
            <div className="mb-4 flex items-center justify-between border-b border-[#f4f4f5] pb-3.5">
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0a0a0a]">
                <Filter className="size-3.5 text-[#a1a1aa]" /> Filtros
              </span>
              <span className="text-[11px] font-medium tabular-nums text-[#71717a]">
                {sorted.length} de {people.length}
              </span>
            </div>

            {/* Nome do candidato — só no nome, sem acento/maiúscula */}
            <FilterSection icon={User} title="Nome do candidato">
              <FilterTextInput
                value={filters.nameQuery ?? ""}
                onChange={(v) => setFilters((p) => ({ ...p, nameQuery: v }))}
                placeholder="Ex: joao silva, marilia…"
              />
            </FilterSection>

            {/* Palavra-chave no currículo (booleana) */}
            <FilterSection icon={Search} title="Palavra-chave no currículo">
              <FilterTextInput
                inputRef={searchInputRef}
                value={filters.keyword}
                onChange={(v) => setFilters((p) => ({ ...p, keyword: v }))}
                placeholder="Ex: vendas, caixa, CNH…"
              />
              <FilterHint>
                Também aceita <code className="rounded bg-stone-100 px-1">AND</code>{" "}
                <code className="rounded bg-stone-100 px-1">OR</code>{" "}
                <code className="rounded bg-stone-100 px-1">NOT</code>. Ignora acentos.
              </FilterHint>
            </FilterSection>

            {/* Área profissional */}
            <FilterSection
              icon={Layers}
              title="Área profissional"
              selectedCount={filters.selectedAreas.length}
              onClear={
                filters.selectedAreas.length > 0
                  ? () => setFilters((p) => ({ ...p, selectedAreas: [] }))
                  : undefined
              }
            >
              {allAreas.length > 4 && (
                <FilterTextInput
                  value={areaSearch}
                  onChange={setAreaSearch}
                  placeholder="Pesquisar áreas…"
                  className="mb-2"
                />
              )}
              <FacetRows
                items={visibleAreas}
                isSelected={(key) => filters.selectedAreas.includes(key)}
                onToggle={toggleArea}
                scroll
              />
            </FilterSection>

            {/* Senioridade */}
            <FilterSection
              icon={Award}
              title="Senioridade"
              selectedCount={filters.selectedLevels.length}
              onClear={
                filters.selectedLevels.length > 0
                  ? () => setFilters((p) => ({ ...p, selectedLevels: [] }))
                  : undefined
              }
            >
              <FacetRows
                items={allLevels}
                isSelected={(key) => filters.selectedLevels.includes(key)}
                onToggle={toggleLevel}
              />
            </FilterSection>

            {/* Vaga de origem */}
            {jobs.length > 0 && (
              <FilterSection icon={Briefcase} title="Vaga de origem">
                <FilterSelect
                  value={filters.selectedJobId}
                  onChange={(v) => setFilters((p) => ({ ...p, selectedJobId: v }))}
                  options={[
                    { value: "", label: "Todas as vagas da empresa" },
                    ...jobs.map((j) => ({ value: j.id, label: j.title })),
                  ]}
                />
              </FilterSection>
            )}

            {/* Função pretendida */}
            <FilterSection
              icon={Target}
              title="Função pretendida"
              onClear={
                filters.selectedDesiredRole
                  ? () => {
                      setRoleSearch("");
                      setFilters((p) => ({ ...p, selectedDesiredRole: "" }));
                    }
                  : undefined
              }
            >
              <FilterTextInput
                value={filters.selectedDesiredRole || roleSearch}
                onChange={(v) => {
                  setRoleSearch(v);
                  setFilters((p) => ({ ...p, selectedDesiredRole: v }));
                }}
                placeholder="Ex: Assistente, Vendedor…"
              />
              {!filters.selectedDesiredRole && (
                <FacetChips
                  items={visibleRoles.slice(0, 12)}
                  isSelected={() => false}
                  onToggle={(key) => setFilters((p) => ({ ...p, selectedDesiredRole: key }))}
                />
              )}
            </FilterSection>

            {/* Bairro / região */}
            <FilterSection
              icon={Home}
              title="Bairro / região"
              onClear={
                filters.selectedNeighborhood
                  ? () => {
                      setNeighborhoodSearch("");
                      setFilters((p) => ({ ...p, selectedNeighborhood: "" }));
                    }
                  : undefined
              }
            >
              <FilterTextInput
                value={filters.selectedNeighborhood || neighborhoodSearch}
                onChange={(v) => {
                  setNeighborhoodSearch(v);
                  setFilters((p) => ({ ...p, selectedNeighborhood: v }));
                }}
                placeholder="Ex: Centro, Aldeota…"
              />
              {!filters.selectedNeighborhood && (
                <FacetChips
                  items={visibleNeighborhoods.slice(0, 12)}
                  isSelected={() => false}
                  onToggle={(key) => setFilters((p) => ({ ...p, selectedNeighborhood: key }))}
                />
              )}
            </FilterSection>

            {/* Já trabalhou em */}
            <FilterSection
              icon={Building2}
              title="Já trabalhou em"
              selectedCount={selectedCompanies.length}
              onClear={
                filters.previousCompany
                  ? () => setFilters((p) => ({ ...p, previousCompany: "" }))
                  : undefined
              }
            >
              <FilterTextInput
                value={filters.previousCompany ?? ""}
                onChange={(v) => setFilters((p) => ({ ...p, previousCompany: v }))}
                placeholder="Ex: Assaí, Pague Menos…"
              />
              <FilterHint>
                {allCompanies.length > 0
                  ? `${allCompanies.length} empresas lidas nos currículos. Pode marcar várias.`
                  : "Digite o nome da empresa. Separe várias por vírgula."}
              </FilterHint>
              <FacetChips
                items={visibleCompanies.slice(0, 40)}
                isSelected={(_, label) =>
                  selectedCompanies.some((c) => normalizeText(c) === normalizeText(label))
                }
                onToggle={(_, label) => toggleCompany(label)}
              />
            </FilterSection>

            {/* Faixa etária */}
            <FilterSection icon={Calendar} title="Faixa etária">
              <FilterSelect
                value={filters.ageBracket || ""}
                onChange={(v) => setFilters((p) => ({ ...p, ageBracket: v }))}
                options={[
                  { value: "", label: "Todas as idades" },
                  { value: "18_24", label: "18 a 24 anos" },
                  { value: "25_34", label: "25 a 34 anos" },
                  { value: "35_44", label: "35 a 44 anos" },
                  { value: "45_54", label: "45 a 54 anos" },
                  { value: "55_PLUS", label: "55 anos ou mais" },
                ]}
              />
            </FilterSection>

            {/* Pretensão salarial */}
            <FilterSection icon={DollarSign} title="Pretensão salarial">
              <FilterSelect
                value={filters.salaryBracket || ""}
                onChange={(v) => setFilters((p) => ({ ...p, salaryBracket: v }))}
                options={[
                  { value: "", label: "Qualquer pretensão" },
                  { value: "Até R$ 2.000", label: "Até R$ 2.000" },
                  { value: "R$ 2.000 a R$ 3.500", label: "R$ 2.000 a R$ 3.500" },
                  { value: "R$ 3.500 a R$ 5.000", label: "R$ 3.500 a R$ 5.000" },
                  { value: "R$ 5.000 a R$ 8.000", label: "R$ 5.000 a R$ 8.000" },
                  { value: "R$ 8.000 a R$ 12.000", label: "R$ 8.000 a R$ 12.000" },
                  { value: "Acima de R$ 12.000", label: "Acima de R$ 12.000" },
                ]}
              />
            </FilterSection>

            {/* Modalidade */}
            <FilterSection icon={Compass} title="Modalidade de trabalho">
              <FilterSelect
                value={filters.selectedWorkPreference || ""}
                onChange={(v) => setFilters((p) => ({ ...p, selectedWorkPreference: v }))}
                options={[
                  { value: "", label: "Qualquer modalidade" },
                  { value: "ONSITE", label: "Presencial" },
                  { value: "HYBRID", label: "Híbrido" },
                  { value: "REMOTE", label: "100% remoto" },
                ]}
              />
            </FilterSection>

            {/* CNH */}
            <FilterSection icon={Car} title="Carteira de motorista (CNH)">
              <FilterSelect
                value={filters.selectedCnh || ""}
                onChange={(v) => setFilters((p) => ({ ...p, selectedCnh: v }))}
                options={[
                  { value: "", label: "Com ou sem CNH" },
                  { value: "A", label: "Categoria A (moto)" },
                  { value: "B", label: "Categoria B (carro)" },
                  { value: "AB", label: "Categoria AB (carro e moto)" },
                  { value: "C_D_E", label: "Categoria C, D ou E (pesados)" },
                ]}
              />
            </FilterSection>

            {/* PCD */}
            <FilterSection icon={HeartHandshake} title="Inclusão">
              <label className="flex h-9 cursor-pointer items-center gap-2.5 rounded-xl border border-[#e4e4e7] bg-[#fafaf9] px-3 text-xs text-[#3f3f46] transition hover:bg-white">
                <input
                  type="checkbox"
                  checked={filters.onlyPcd || false}
                  onChange={(e) => setFilters((p) => ({ ...p, onlyPcd: e.target.checked }))}
                  className="size-4 rounded border-[#d4d4d8] accent-[#0a0a0a]"
                />
                Só pessoas com deficiência (PcD)
              </label>
            </FilterSection>
          </div>
        </aside>

        {/* FEED PRINCIPAL: Dossiês Executivos de Candidatos (Direita) */}
        <main className="space-y-4">
          {/*
            Header da lista, fixo ao rolar. Gruda no topo da tela (abaixo da
            barra superior no celular) com uma faixa opaca da cor da página
            cobrindo o vão acima — os cards somem por baixo dela, sem aparecer
            por trás. -mt-6/pt-6 mantém a posição original antes de rolar e
            alinha o card com a barra de filtros (top-6) quando fixo.
          */}
          <div className="sticky top-14 z-20 -mt-6 bg-[#fafaf9] pt-6 md:top-0">
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
              {/* Alternância de modo de exibição: Dossiê (detalhado) x Compacto */}
              <div className="flex items-center rounded-xl border border-[#e4e4e7] bg-[#fafaf9] p-0.5">
                <button
                  type="button"
                  onClick={() => startViewTransition(() => setViewMode("detailed"))}
                  title="Modo Dossiê: cards detalhados"
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
                    viewMode === "detailed"
                      ? "bg-white text-[#0a0a0a] shadow-xs"
                      : "text-[#71717a] hover:text-[#0a0a0a]"
                  }`}
                >
                  <Rows3 className="size-3.5" />
                  Dossiê
                </button>
                <button
                  type="button"
                  onClick={() => startViewTransition(() => setViewMode("compact"))}
                  title="Modo Compacto: linhas resumidas"
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
                    viewMode === "compact"
                      ? "bg-white text-[#0a0a0a] shadow-xs"
                      : "text-[#71717a] hover:text-[#0a0a0a]"
                  }`}
                >
                  <List className="size-3.5" />
                  Compacto
                </button>
              </div>

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
            {/* Esfumaçado sob a faixa: os cards se dissolvem em vez de cortar seco */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-full h-4 bg-linear-to-b from-[#fafaf9] to-transparent"
            />
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
            <div className={viewMode === "compact" ? "divide-y divide-[#f0f0ef] rounded-3xl border border-[#e4e4e7] bg-white shadow-xs" : "space-y-4"}>
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

                if (viewMode === "compact") {
                  return (
                    <div
                      key={item.id}
                      ref={(el) => {
                        cardRefs.current[index] = el;
                      }}
                      onClick={() => setSelectedIndex(index)}
                      className={`group flex cursor-pointer items-center gap-3 px-4 py-2.5 transition ${
                        isSelected ? "bg-stone-50 ring-1 ring-inset ring-[#0a0a0a]/10" : "hover:bg-[#fafaf9]"
                      }`}
                    >
                      <div className="relative shrink-0">
                        <ZoomableCandidateAvatar
                          applicationId={item.id}
                          name={item.name}
                          photoUrl={item.photoUrl}
                          className="size-9 rounded-xl bg-[#1c1917] text-xs font-bold text-white object-cover"
                        />
                        {isTopMatch && (
                          <Sparkles className="absolute -right-1 -top-1 size-3 fill-amber-400 text-amber-500" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/candidaturas/${item.id}`}
                            onClick={(e) => e.stopPropagation()}
                            title="Abrir o cadastro"
                            className="truncate text-xs font-bold text-[#0a0a0a] underline-offset-2 hover:underline"
                          >
                            {item.name}
                          </Link>
                          {item.hasImpediment && (
                            <span className="shrink-0 inline-flex items-center gap-1 rounded bg-black px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm" title={item.impedimentReason ? `Motivo: ${item.impedimentReason}` : "Impedimento de contratação ativo"}>
                              <span className="size-1.5 rounded-full bg-red-500 animate-pulse" />
                              <span>Tarja Preta</span>
                            </span>
                          )}
                          {item.aiLevel && (
                            <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${levelBadgeClass}`}>
                              {item.aiLevel}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-[#71717a]">
                          <span className="truncate">{item.desiredRole || item.aiProfile || item.job.title}</span>
                          {item.allJobs && item.allJobs.length > 1 && (
                            <span
                              className="rounded bg-[#f4f4f5] px-1 py-0.2 text-[9px] font-semibold text-[#52525b] shrink-0"
                              title={`Também em: ${item.allJobs.filter((j) => j !== item.job.title).join(", ")}`}
                            >
                              +{item.allJobs.length - 1}
                            </span>
                          )}
                          {(item.neighborhood || item.city) && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-0.5 shrink-0">
                                <MapPin className="size-2.5 text-[#a1a1aa]" />
                                {[item.neighborhood, item.city].filter(Boolean).join(", ")}
                              </span>
                            </>
                          )}
                          {item.salaryExpectation && (
                            <>
                              <span>•</span>
                              <span className="shrink-0">{item.salaryExpectation}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <span
                        className="hidden shrink-0 text-[10px] tabular-nums text-[#a1a1aa] sm:inline"
                        title={`Cadastro em ${formatCadastro(item.createdAt, true)}`}
                      >
                        {formatCadastro(item.createdAt)}
                      </span>
                      {item.aiScore !== null && (
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            item.aiScore >= 80
                              ? "bg-emerald-50 text-emerald-700"
                              : item.aiScore >= 60
                              ? "bg-amber-50 text-amber-700"
                              : "bg-stone-100 text-stone-600"
                          }`}
                        >
                          {item.aiScore}%
                        </span>
                      )}

                      <div className="flex shrink-0 items-center gap-1">
                        {item.instagram && (
                          <a
                            href={instagramUrl(item.instagram)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title={`Instagram: @${item.instagram}`}
                            className="inline-flex size-7 items-center justify-center rounded-lg text-[#71717a] hover:bg-stone-100 hover:text-[#0a0a0a]"
                          >
                            <AtSign className="size-4" />
                          </a>
                        )}
                        {/* Sem Instagram: mesmo espaço, para data e nota ficarem alinhadas entre as linhas. */}
                        {!item.instagram && <span aria-hidden className="inline-block size-7" />}
                        {whatsappUrl && (
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="WhatsApp"
                            className="inline-flex size-7 items-center justify-center rounded-lg text-emerald-700 hover:bg-emerald-50"
                          >
                            <MessageCircle className="size-4" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCandidate(item);
                            setDrawerTab(item.resumeUrl ? "pdf" : "ai");
                          }}
                          title="Ver Dossiê / PDF"
                          className="inline-flex size-7 items-center justify-center rounded-lg text-[#71717a] hover:bg-stone-100 hover:text-[#0a0a0a]"
                        >
                          <Eye className="size-4" />
                        </button>
                      </div>
                    </div>
                  );
                }

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
                          <ZoomableCandidateAvatar
                            applicationId={item.id}
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
                          {/* Nome do candidato — sempre o título em destaque, igual ao modo Compacto */}
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-base sm:text-lg font-bold text-[#0a0a0a]">
                              <Link
                                href={`/candidaturas/${item.id}`}
                                onClick={(e) => e.stopPropagation()}
                                title="Abrir o cadastro"
                                className="underline-offset-4 hover:underline"
                              >
                                {item.name}
                              </Link>
                            </h2>
                            {item.hasImpediment && (
                              <span className="rounded bg-black px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm inline-flex items-center gap-1.5" title={item.impedimentReason ? `Motivo: ${item.impedimentReason}` : "Impedimento de contratação ativo"}>
                                <span className="size-1.5 rounded-full bg-red-500 animate-pulse" />
                                <span>Tarja Preta · Impedimento</span>
                              </span>
                            )}
                            {item.isPcd && (
                              <span className="rounded-md bg-purple-100 border border-purple-300 px-2 py-0.5 text-[10px] font-extrabold text-purple-900">
                                ♿ PCD
                              </span>
                            )}
                            {item.age !== null && item.age !== undefined && (
                              <span className="rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-900">
                                🎂 {item.age} anos
                              </span>
                            )}
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

                          {/* Cargo Pretendido/Perfil IA + Localização / Bairro + Vaga */}
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#71717a]">
                            {(item.desiredRole || item.aiProfile) && (
                              <>
                                <span className="flex items-center gap-1 font-semibold text-[#0a0a0a]">
                                  <Target className="size-3 text-indigo-600" />
                                  {item.desiredRole || item.aiProfile}
                                </span>
                                <span>•</span>
                              </>
                            )}
                            {(item.neighborhood || item.city) ? (
                              <span className="flex items-center gap-1 font-medium text-emerald-950 bg-emerald-50/80 rounded px-1.5 py-0.5 border border-emerald-200/60">
                                <MapPin className="size-3 text-emerald-600" />
                                {[item.neighborhood, item.city].filter(Boolean).join(", ")}{item.state ? ` - ${item.state}` : ""}
                              </span>
                            ) : item.job.location ? (
                              <span className="flex items-center gap-1">
                                <MapPin className="size-3 text-[#a1a1aa]" />
                                {item.job.location}
                              </span>
                            ) : null}
                            <span>•</span>
                            <span
                              className="flex items-center gap-1"
                              title={item.allJobs && item.allJobs.length > 1 ? `Candidaturas unificadas nesta pessoa: ${item.allJobs.join(" • ")}` : undefined}
                            >
                              <Briefcase className="size-3 text-[#a1a1aa]" />
                              <span>{item.job.title}</span>
                              {item.allJobs && item.allJobs.length > 1 && (
                                <span className="rounded bg-[#f4f4f5] px-1.5 py-0.5 text-[10px] font-semibold text-[#52525b]">
                                  +{item.allJobs.length - 1} {item.allJobs.length === 2 ? "outra vaga" : "outras vagas"}
                                </span>
                              )}
                            </span>
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
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#71717a]">
                            {item.salaryExpectation && (
                              <span className="flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                                <DollarSign className="size-3.5 text-emerald-600" />
                                Pretensão: {item.salaryExpectation}
                              </span>
                            )}
                            {item.workPreference && item.workPreference !== "ANY" && (
                              <span className="flex items-center gap-1 rounded-md border border-stone-200 bg-stone-50 px-2 py-0.5 text-xs font-medium text-stone-700">
                                <Compass className="size-3 text-stone-500" />
                                {item.workPreference === "ONSITE"
                                  ? "Presencial"
                                  : item.workPreference === "HYBRID"
                                  ? "Híbrido"
                                  : "100% Remoto"}
                              </span>
                            )}
                            {item.hasCnh && item.hasCnh !== "NONE" && (
                              <span className="flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800">
                                <Car className="size-3 text-blue-600" />
                                CNH {item.hasCnh}
                              </span>
                            )}
                            {item.availability && item.availability !== "NEGOTIABLE" && (
                              <span className="flex items-center gap-1 rounded-md border border-stone-200 bg-stone-50 px-2 py-0.5 text-xs font-medium text-stone-700">
                                ⏱️ Início{" "}
                                {item.availability === "IMMEDIATE"
                                  ? "Imediato"
                                  : item.availability === "15_DAYS"
                                  ? "em 15 dias"
                                  : "em 30 dias"}
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
                      <div className="flex flex-wrap items-center gap-2 text-[#71717a]">
                        <span
                          className="tabular-nums text-[#a1a1aa]"
                          title={`Cadastro em ${formatCadastro(item.createdAt, true)}`}
                        >
                          Cadastro {formatCadastro(item.createdAt)}
                        </span>
                        <span className="text-[#d4d4d8]">•</span>
                        <span>{item.email}</span>
                        {item.phone && (
                          <>
                            <span>•</span>
                            <span>{formatPhone(item.phone)}</span>
                          </>
                        )}
                        {item.instagram && (
                          <>
                            <span>•</span>
                            <a
                              href={instagramUrl(item.instagram)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="Abrir o Instagram"
                              className="inline-flex items-center gap-0.5 font-medium text-[#0a0a0a] hover:underline"
                            >
                              <AtSign className="size-3" />
                              {item.instagram}
                            </a>
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
                <ZoomableCandidateAvatar
                  applicationId={selectedCandidate.id}
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
                          {formatPhone(selectedCandidate.phone) || "Não informado"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Critérios Essenciais de Triagem (Cadastro do Candidato) */}
                  <div className="rounded-2xl border border-stone-200 bg-[#fafaf9] p-4 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#0a0a0a] flex items-center gap-1.5">
                      <Target className="size-3.5 text-indigo-600" />
                      Dados Essenciais de Triagem
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] text-[#71717a]">Função Pretendida</span>
                        <p className="font-bold text-indigo-900">
                          {selectedCandidate.desiredRole || "Não especificada"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#71717a]">Pretensão Salarial</span>
                        <p className="font-semibold text-emerald-800">
                          {selectedCandidate.salaryExpectation || "A combinar"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#71717a]">Data de Nasc. / Idade</span>
                        <p className="font-medium text-[#0a0a0a]">
                          {selectedCandidate.birthDate
                            ? `${new Date(selectedCandidate.birthDate).toLocaleDateString("pt-BR")}${
                                selectedCandidate.age ? ` (${selectedCandidate.age} anos)` : ""
                              }`
                            : selectedCandidate.age
                            ? `${selectedCandidate.age} anos`
                            : "Não informada"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#71717a]">Localização / Bairro</span>
                        <p className="font-medium text-[#0a0a0a]">
                          {[selectedCandidate.neighborhood, selectedCandidate.city, selectedCandidate.state]
                            .filter(Boolean)
                            .join(" - ") || "Não informado"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#71717a]">Modalidade Preferida</span>
                        <p className="font-medium text-[#0a0a0a]">
                          {selectedCandidate.workPreference === "ONSITE"
                            ? "Presencial"
                            : selectedCandidate.workPreference === "HYBRID"
                            ? "Híbrido"
                            : selectedCandidate.workPreference === "REMOTE"
                            ? "100% Remoto"
                            : "Qualquer modalidade"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#71717a]">Disponibilidade</span>
                        <p className="font-medium text-[#0a0a0a]">
                          {selectedCandidate.availability === "IMMEDIATE"
                            ? "Imediata"
                            : selectedCandidate.availability === "15_DAYS"
                            ? "Em até 15 dias"
                            : selectedCandidate.availability === "30_DAYS"
                            ? "Em até 30 dias"
                            : "A combinar"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#71717a]">Carteira CNH</span>
                        <p className="font-medium text-[#0a0a0a]">
                          {!selectedCandidate.hasCnh || selectedCandidate.hasCnh === "NONE"
                            ? "Não possui CNH"
                            : `Categoria ${selectedCandidate.hasCnh}`}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#71717a]">Condição PCD</span>
                        <p className="font-medium text-[#0a0a0a]">
                          {selectedCandidate.isPcd ? (
                            <span className="font-bold text-purple-900">
                              Sim {selectedCandidate.pcdDetails ? `(${selectedCandidate.pcdDetails})` : ""}
                            </span>
                          ) : (
                            "Não"
                          )}
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

/* ───────────── Peças da barra de filtros (um padrão só para todas) ───────────── */

type FacetItem = { key: string; label: string; count: number };

/** Seção de filtro: mesmo espaçamento, título e ícone neutro em todas. */
function FilterSection({
  icon: Icon,
  title,
  selectedCount = 0,
  onClear,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  selectedCount?: number;
  onClear?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-[#f4f4f5] py-4 first-of-type:border-t-0 first-of-type:pt-0 last:pb-0">
      <div className="mb-2 flex h-5 items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#71717a]">
          <Icon className="size-3.5 shrink-0 text-[#a1a1aa]" />
          <span className="truncate">{title}</span>
          {selectedCount > 0 && (
            <span className="rounded-full bg-[#0a0a0a] px-1.5 text-[10px] font-semibold tabular-nums leading-4 text-white">
              {selectedCount}
            </span>
          )}
        </h3>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 text-[11px] font-medium text-[#71717a] transition hover:text-[#0a0a0a]"
          >
            Limpar
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

const FIELD_BASE =
  "h-9 w-full rounded-xl border border-[#e4e4e7] text-xs text-[#0a0a0a] transition focus:border-[#0a0a0a] focus:outline-none";

/** Campo de texto padrão (lupa à esquerda, X para limpar). */
function FilterTextInput({
  value,
  onChange,
  placeholder,
  inputRef,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputRef?: React.Ref<HTMLInputElement>;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#a1a1aa]" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${FIELD_BASE} bg-[#fafaf9] pl-8 pr-8 placeholder:text-[#a1a1aa] focus:bg-white`}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Limpar campo"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#a1a1aa] hover:text-[#0a0a0a]"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** Lista de seleção padrão. */
function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${FIELD_BASE} bg-white px-3 ${value ? "font-semibold" : ""}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Linhas marcáveis com contagem (área, senioridade). */
function FacetRows({
  items,
  isSelected,
  onToggle,
  scroll = false,
}: {
  items: FacetItem[];
  isSelected: (key: string) => boolean;
  onToggle: (key: string) => void;
  scroll?: boolean;
}) {
  if (items.length === 0) return <FilterHint>Nada para filtrar ainda.</FilterHint>;
  return (
    <div className={`space-y-0.5 ${scroll ? "max-h-44 overflow-y-auto pr-1" : ""}`}>
      {items.map((item) => {
        const selected = isSelected(item.key);
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onToggle(item.key)}
            aria-pressed={selected}
            className={`flex h-8 w-full items-center justify-between gap-2 rounded-lg px-2.5 text-left text-xs transition ${
              selected ? "bg-[#0a0a0a] font-medium text-white" : "text-[#3f3f46] hover:bg-[#fafaf9]"
            }`}
          >
            <span className="truncate" title={item.label}>
              {item.label}
            </span>
            <span className={`shrink-0 text-[10px] tabular-nums ${selected ? "text-white/70" : "text-[#a1a1aa]"}`}>
              {item.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Etiquetas clicáveis com contagem (função, bairro, empresa): mesmo tamanho e alinhamento. */
function FacetChips({
  items,
  isSelected,
  onToggle,
}: {
  items: FacetItem[];
  isSelected: (key: string, label: string) => boolean;
  onToggle: (key: string, label: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-2 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto pr-1">
      {items.map((item) => {
        const selected = isSelected(item.key, item.label);
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onToggle(item.key, item.label)}
            aria-pressed={selected}
            title={item.label}
            className={`inline-flex h-7 max-w-full items-center gap-1 rounded-lg border px-2 text-left text-[11px] transition ${
              selected
                ? "border-[#0a0a0a] bg-[#0a0a0a] text-white"
                : "border-[#e4e4e7] bg-[#fafaf9] text-[#3f3f46] hover:border-[#d4d4d8] hover:bg-white"
            }`}
          >
            <span className="truncate">{titleCaseLabel(item.label)}</span>
            <span className={`shrink-0 tabular-nums ${selected ? "text-white/70" : "text-[#a1a1aa]"}`}>
              {item.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Texto de ajuda padrão, abaixo do campo. */
function FilterHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-[10px] leading-snug text-[#a1a1aa]">{children}</p>;
}

/**
 * "AMAZONAS IMPORTAÇÕES" → "Amazonas Importações": currículo escrito todo em
 * maiúsculas não pode destoar das outras etiquetas. Siglas curtas (S/A, CE) ficam.
 */
const LOWER_CONNECTORS = new Set(["e", "de", "da", "do", "das", "dos", "em", "na", "no"]);
const KEEP_UPPER = /[/&]|^(sa|ltda|me|epp|eireli)$/;

function titleCaseLabel(label: string): string {
  if (label !== label.toUpperCase()) return label;
  return label
    .toLowerCase()
    .split(" ")
    .map((w, i) => {
      if (!w) return w;
      if (KEEP_UPPER.test(w)) return w.toUpperCase();
      if (i > 0 && LOWER_CONNECTORS.has(w)) return w;
      return w[0].toUpperCase() + w.slice(1);
    })
    .join(" ");
}

/**
 * Data de cadastro discreta: "03/11/26"; com `full`, data e hora para o
 * tooltip. Sempre no fuso de Brasília, igual para todo gestor.
 */
function formatCadastro(iso: string, full = false): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: full ? "numeric" : "2-digit",
    ...(full ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}
