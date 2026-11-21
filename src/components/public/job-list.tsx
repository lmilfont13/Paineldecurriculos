"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  CheckCircle2,
  ChevronDown,
  Clock,
  LayoutGrid,
  MapPin,
  Rows3,
  Search,
  Sparkles,
  X,
} from "lucide-react";

import {
  contractLabels,
  formatPublishedAgo,
  requirementsToBullets,
  workModeLabels,
  type PublicJob,
} from "@/server/models/job.model";
import { jobSummary } from "@/server/models/job-description.model";
import { jobCity, splitJobTitle } from "@/server/models/job-title.model";
import { StructuredJobDescription } from "@/components/public/structured-job-description";

const NEW_DAYS = 7;
const isNew = (d: Date | string) =>
  Date.now() - new Date(d).getTime() < NEW_DAYS * 86_400_000;

/* ─── CARD EM GRADE / CARDS MODERNOS (2 COLUNAS NO DESKTOP) ─── */

function JobCardGrid({
  job,
  slug,
  applied,
  open,
  onToggle,
}: {
  job: PublicJob;
  slug: string;
  applied: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const bullets = requirementsToBullets(job.requirements ?? "");
  const summary = jobSummary(job.description);
  const panelId = `vaga-grid-${job.id}`;
  const title = splitJobTitle(job.title, job.location);
  const href = `/${slug}/vagas/${job.id}`;

  return (
    <li className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-stone-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(28,25,23,0.05)] transition-all hover:border-stone-400/80 hover:shadow-[0_4px_16px_rgba(28,25,23,0.08)]">
      {/* Faixa da marca à esquerda ao passar o mouse */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1 opacity-0 transition-opacity group-hover:opacity-100"
        style={{ backgroundColor: "var(--brand-primary)" }}
      />

      <div>
        {/* Linha superior: Localidade + Badges */}
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {job.location && (
              <span
                className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold"
                style={{ backgroundColor: "var(--brand-tint)", color: "var(--brand-primary)" }}
              >
                <MapPin className="size-3 shrink-0" />
                <span className="truncate max-w-[180px]">{job.location}</span>
              </span>
            )}
            {isNew(job.createdAt) && (
              <span className="rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                Nova
              </span>
            )}
            {applied && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                <CheckCircle2 className="size-3" />
                Inscrito
              </span>
            )}
          </div>

          {job.code && (
            <span className="font-mono text-[11px] font-semibold text-stone-500" title={`Código da vaga: #${job.code}`}>
              #{job.code}
            </span>
          )}
        </div>

        {/* Título da Vaga */}
        <h3 className="mt-2 text-[15px] font-bold leading-snug tracking-tight text-stone-900 group-hover:text-[var(--brand-primary)] transition-colors">
          <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
            {title}
          </Link>
        </h3>

        {/* Metadados: Modalidade · Contrato · Publicação */}
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-stone-600">
          <span className="inline-flex items-center gap-1">
            <Briefcase className="size-3 text-stone-400" />
            {workModeLabels[job.workMode]} · {contractLabels[job.contract]}
          </span>
          <span className="inline-flex items-center gap-1 text-stone-600">
            <Clock className="size-3 text-stone-400" />
            {formatPublishedAgo(job.createdAt)}
          </span>
        </div>

        {/* Resumo compacto de 1 linha */}
        {summary && (
          <p className="mt-2 line-clamp-1 text-[12px] leading-relaxed text-stone-600">
            {summary}
          </p>
        )}
      </div>

      {/* Ações inferiores: Detalhes + Botão Candidatar-se */}
      <div className="relative z-10 mt-3 flex items-center justify-between gap-2 border-t border-stone-100 pt-2.5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="inline-flex items-center gap-1 text-[11.5px] font-medium text-stone-500 hover:text-stone-900 transition-colors"
        >
          <span>{open ? "Menos" : "Detalhes"}</span>
          <ChevronDown className={`size-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>

        <Link
          href={href}
          className="inline-flex h-8 items-center justify-center rounded-lg px-3.5 text-[12px] font-bold shadow-2xs transition hover:opacity-90"
          style={{
            backgroundColor: "var(--brand-primary)",
            color: "var(--brand-foreground)",
          }}
        >
          {applied ? "Ver vaga" : "Candidatar-se"}
        </Link>
      </div>

      {/* Painel expandido inline */}
      {open && (
        <div
          id={panelId}
          className="relative z-10 mt-3 border-t border-stone-200 bg-stone-50/80 -mx-4 -mb-4 p-3.5 text-[12.5px] text-stone-700 space-y-3"
        >
          <div>
            <p className="font-semibold text-stone-900 text-xs">Sobre a vaga</p>
            <StructuredJobDescription text={job.description} compact />
          </div>

          {bullets.length > 0 && (
            <div>
              <p className="font-semibold text-stone-900 text-xs">Requisitos e qualificações</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
                {bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/* ─── LINHA EXECUTIVA COMPACTA (ESTILO ERP GPS / FASTRH - ALTA DENSIDADE) ─── */

function JobRowCompact({
  job,
  slug,
  applied,
  open,
  onToggle,
}: {
  job: PublicJob;
  slug: string;
  applied: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const bullets = requirementsToBullets(job.requirements ?? "");
  const panelId = `vaga-row-${job.id}`;
  const title = splitJobTitle(job.title, job.location);
  const href = `/${slug}/vagas/${job.id}`;

  return (
    <li className="group relative overflow-hidden rounded-xl border border-stone-200/90 bg-white transition hover:border-stone-400/80 hover:bg-stone-50/50 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3.5 py-2.5">
        
        {/* Esquerda: Identificação + Título + Badges inline */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0 flex-1">
          {/* Indicador de novidade ou código */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isNew(job.createdAt) ? (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase text-amber-800">
                Nova
              </span>
            ) : (
              <span className="size-1.5 rounded-full bg-stone-300" />
            )}
            {job.code && (
              <span className="font-mono text-[11px] font-bold text-stone-500">
                #{job.code}
              </span>
            )}
          </div>

          {/* Título da vaga */}
          <Link
            href={href}
            className="text-[13.5px] sm:text-[14px] font-bold text-stone-900 group-hover:text-[var(--brand-primary)] transition-colors truncate max-w-[260px] sm:max-w-[340px]"
          >
            {title}
          </Link>

          {/* Localidade */}
          {job.location && (
            <span
              className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold shrink-0"
              style={{ backgroundColor: "var(--brand-tint)", color: "var(--brand-primary)" }}
            >
              <MapPin className="size-2.5" />
              {job.location}
            </span>
          )}

          {/* Modelo & Contrato */}
          <span className="text-[11.5px] text-stone-600 hidden md:inline">
            {workModeLabels[job.workMode]} · {contractLabels[job.contract]}
          </span>

          {/* Tempo publicado */}
          <span className="text-[11px] text-stone-600 hidden lg:inline">
            {formatPublishedAgo(job.createdAt)}
          </span>

          {/* Inscrito */}
          {applied && (
            <span className="inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800">
              <CheckCircle2 className="size-2.5" />
              Inscrito
            </span>
          )}
        </div>

        {/* Direita: Ações compactas */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={panelId}
            className="inline-flex items-center gap-0.5 px-2 py-1 text-[11px] font-medium text-stone-500 hover:text-stone-900 transition-colors"
          >
            <span>{open ? "Menos" : "Detalhes"}</span>
            <ChevronDown className={`size-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
          </button>

          <Link
            href={href}
            className="inline-flex h-7 items-center justify-center rounded-md px-3 text-[11.5px] font-bold shadow-2xs transition hover:opacity-90"
            style={{
              backgroundColor: "var(--brand-primary)",
              color: "var(--brand-foreground)",
            }}
          >
            {applied ? "Ver" : "Candidatar-se"}
          </Link>
        </div>
      </div>

      {/* Painel expandido inline */}
      {open && (
        <div
          id={panelId}
          className="border-t border-stone-200 bg-stone-50/80 p-3.5 text-[12.5px] text-stone-700 space-y-3"
        >
          <div>
            <p className="font-semibold text-stone-900 text-xs">Sobre a vaga</p>
            <StructuredJobDescription text={job.description} compact />
          </div>

          {bullets.length > 0 && (
            <div>
              <p className="font-semibold text-stone-900 text-xs">Requisitos e qualificações</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
                {bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/* ─── LISTA PRINCIPAL (TOOLBAR INTEGRADA + VIEW MODES) ─── */

export function JobList({
  slug,
  jobs,
  companyName,
  loggedIn,
  appliedJobIds = [],
}: {
  slug: string;
  jobs: PublicJob[];
  companyName: string;
  loggedIn: boolean;
  appliedJobIds?: string[];
}) {
  const [query, setQuery] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [contractFilter, setContractFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  // Modo de visualização: "grid" (grade 2 colunas) ou "compact" (linhas estilo ERP/GPS)
  const [viewMode, setViewMode] = useState<"grid" | "compact">(() => {
    if (typeof window === "undefined") return "grid";
    const saved = window.localStorage.getItem("tarhget_vagas_view_mode");
    return saved === "compact" || saved === "grid" ? saved : "grid";
  });

  useEffect(() => {
    try {
      window.localStorage.setItem("tarhget_vagas_view_mode", viewMode);
    } catch {}
  }, [viewMode]);

  // Contagens para os filtros
  const modeCounts = useMemo(
    () =>
      jobs.reduce<Record<string, number>>((acc, j) => {
        acc[j.workMode] = (acc[j.workMode] ?? 0) + 1;
        return acc;
      }, {}),
    [jobs],
  );

  const contractCounts = useMemo(
    () =>
      jobs.reduce<Record<string, number>>((acc, j) => {
        acc[j.contract] = (acc[j.contract] ?? 0) + 1;
        return acc;
      }, {}),
    [jobs],
  );

  const cityCounts = useMemo(
    () =>
      jobs.reduce<Record<string, number>>((acc, j) => {
        const city = jobCity(j.location);
        if (city) acc[city] = (acc[city] ?? 0) + 1;
        return acc;
      }, {}),
    [jobs],
  );

  const cityOptions = Object.keys(cityCounts)
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .map((city) => ({ value: city, label: city }));

  const hasActiveFilters = Boolean(query || modeFilter || contractFilter || cityFilter);

  function clearAllFilters() {
    setQuery("");
    setModeFilter("");
    setContractFilter("");
    setCityFilter("");
  }

  // Filtragem das vagas
  const filteredJobs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs.filter((j) => {
      if (modeFilter && j.workMode !== modeFilter) return false;
      if (contractFilter && j.contract !== contractFilter) return false;
      if (cityFilter && jobCity(j.location) !== cityFilter) return false;
      if (!q) return true;
      return (
        j.title.toLowerCase().includes(q) ||
        (j.code ?? "").toLowerCase().includes(q) ||
        j.description.toLowerCase().includes(q) ||
        (j.location ?? "").toLowerCase().includes(q)
      );
    });
  }, [jobs, query, modeFilter, contractFilter, cityFilter]);

  return (
    <>
      {jobs.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-base font-semibold text-[#1c1917]">
            Nenhuma vaga aberta agora
          </p>
          <p className="mx-auto mt-2 max-w-[400px] text-sm leading-6 text-[#78716c]">
            Quando a {companyName} abrir uma vaga, ela aparece aqui.
          </p>
          {loggedIn ? (
            <Link
              href={`/${slug}/minhas-candidaturas`}
              className="mt-6 inline-block text-[13px] font-medium underline-offset-2 hover:underline"
              style={{ color: "var(--brand-primary)" }}
            >
              Ver minhas candidaturas
            </Link>
          ) : (
            <Link
              href={`/${slug}/entrar?next=${encodeURIComponent(
                `/${slug}/minhas-candidaturas`,
              )}&modo=entrar`}
              className="mt-6 inline-block text-[13px] font-medium underline-offset-2 hover:underline"
              style={{ color: "var(--brand-primary)" }}
            >
              Já se candidatou? Entre para acompanhar
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* BARRA DE CONTROLE COMPACTA E INTELIGENTE (ESTILO MICHELIN) */}
          <div className="rounded-xl border border-stone-200/90 bg-white p-2.5 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              
              {/* Campo de Busca Rápida */}
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-stone-600" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar cargo, código ou cidade…"
                  aria-label="Buscar vagas"
                  className="h-8.5 w-full rounded-lg border border-stone-200 bg-stone-50/60 pl-8.5 pr-8 text-[12.5px] text-stone-900 placeholder:text-stone-600 focus:border-stone-400 focus:bg-white focus:outline-none transition shadow-2xs"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-stone-600 hover:text-stone-700"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Contagem e Alternância de Visualização */}
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold text-stone-600 whitespace-nowrap">
                  {filteredJobs.length} {filteredJobs.length === 1 ? "vaga" : "vagas"}
                </span>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="text-[11.5px] font-bold text-amber-800 hover:text-amber-900 underline underline-offset-2"
                  >
                    Limpar filtros
                  </button>
                )}

                {/* Alternador de Modo de Exibição */}
                <div className="flex items-center rounded-lg border border-stone-200 bg-stone-100 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    title="Exibição em Cards (Grade)"
                    className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold transition ${
                      viewMode === "grid"
                        ? "bg-white text-stone-900 shadow-2xs"
                        : "text-stone-500 hover:text-stone-800"
                    }`}
                  >
                    <LayoutGrid className="size-3" />
                    <span className="hidden sm:inline">Cards</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("compact")}
                    title="Exibição Executiva (Linhas Compactas - Estilo ERP)"
                    className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold transition ${
                      viewMode === "compact"
                        ? "bg-white text-stone-900 shadow-2xs"
                        : "text-stone-500 hover:text-stone-800"
                    }`}
                  >
                    <Rows3 className="size-3" />
                    <span className="hidden sm:inline">Executivo</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Pílulas de Cidades (Rolo horizontal compacto) */}
            {cityOptions.length > 1 && (
              <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-1 border-t border-stone-100 text-[11px]">
                <span className="font-bold uppercase tracking-wider text-[10px] text-stone-600 shrink-0 mr-1">
                  Cidade:
                </span>
                <button
                  type="button"
                  onClick={() => setCityFilter("")}
                  className={`rounded-full px-2.5 py-0.5 font-semibold transition shrink-0 ${
                    cityFilter === ""
                      ? "bg-[var(--brand-primary)] text-white"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                >
                  Todas ({jobs.length})
                </button>
                {cityOptions.map((c) => {
                  const active = cityFilter === c.value;
                  const count = cityCounts[c.value] ?? 0;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCityFilter(active ? "" : c.value)}
                      className={`rounded-full px-2.5 py-0.5 font-semibold transition shrink-0 ${
                        active
                          ? "bg-[var(--brand-primary)] text-white"
                          : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                      }`}
                    >
                      {c.label} ({count})
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* LISTA DE VAGAS CONFORME MODO ESCOLHIDO */}
          {filteredJobs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center">
              <p className="text-sm font-semibold text-stone-700">
                Nenhuma vaga encontrada para os filtros aplicados.
              </p>
              <button
                type="button"
                onClick={clearAllFilters}
                className="mt-2 text-xs font-bold underline"
                style={{ color: "var(--brand-primary)" }}
              >
                Limpar todos os filtros
              </button>
            </div>
          ) : viewMode === "compact" ? (
            /* MODO EXECUTIVO (LINHAS COMPACTAS) */
            <ul className="space-y-1.5">
              {filteredJobs.map((job) => (
                <JobRowCompact
                  key={job.id}
                  job={job}
                  slug={slug}
                  applied={appliedJobIds.includes(job.id)}
                  open={openId === job.id}
                  onToggle={() =>
                    setOpenId((cur) => (cur === job.id ? null : job.id))
                  }
                />
              ))}
            </ul>
          ) : (
            /* MODO GRADE (CARDS 2 COLUNAS NO DESKTOP) */
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredJobs.map((job) => (
                <JobCardGrid
                  key={job.id}
                  job={job}
                  slug={slug}
                  applied={appliedJobIds.includes(job.id)}
                  open={openId === job.id}
                  onToggle={() =>
                    setOpenId((cur) => (cur === job.id ? null : job.id))
                  }
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
