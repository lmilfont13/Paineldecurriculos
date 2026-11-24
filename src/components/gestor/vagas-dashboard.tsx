"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  LayoutGrid,
  MapPin,
  Plus,
  Rows3,
  Search,
  Users,
  X,
} from "lucide-react";

import { CopyLink } from "@/components/gestor/copy-link";
import {
  contractLabels,
  formatPublishedAgo,
  jobStatusLabels,
  parseJobTitleAndCity,
  workModeLabels,
  type ManagerJob,
} from "@/server/models/job.model";

const statusStyles = {
  OPEN: {
    badge: "border-emerald-200/90 bg-emerald-50/90 text-emerald-800",
    dot: "bg-emerald-500",
    label: "Aberta",
  },
  PAUSED: {
    badge: "border-amber-200/90 bg-amber-50/90 text-amber-800",
    dot: "bg-amber-500",
    label: "Pausada",
  },
  CLOSED: {
    badge: "border-zinc-200 bg-zinc-100 text-zinc-600",
    dot: "bg-zinc-400",
    label: "Encerrada",
  },
  DRAFT: {
    badge: "border-zinc-200 bg-zinc-100 text-zinc-600",
    dot: "bg-zinc-400",
    label: "Rascunho",
  },
} as const;

type StatusTab = "all" | "OPEN" | "CLOSED";
type ViewMode = "table" | "grid";

interface VagasDashboardProps {
  jobs: ManagerJob[];
  companySlug: string;
  publicUrl: string;
}

export function VagasDashboard({ jobs, companySlug, publicUrl }: VagasDashboardProps) {
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  // Persistência do modo de exibição no localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("triagem_gestor_vagas_view");
      if (saved === "table" || saved === "grid") {
        setViewMode(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSetViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem("triagem_gestor_vagas_view", mode);
    } catch {
      // ignore
    }
  };

  // Cálculos globais de métricas
  const totalJobs = jobs.length;
  const openCount = useMemo(() => jobs.filter((j) => j.status === "OPEN").length, [jobs]);
  const closedCount = useMemo(
    () => jobs.filter((j) => j.status === "CLOSED" || j.status === "PAUSED").length,
    [jobs]
  );
  const totalCandidates = useMemo(
    () => jobs.reduce((acc, j) => acc + (j.applicationCount || 0), 0),
    [jobs]
  );
  const totalPending = useMemo(
    () => jobs.reduce((acc, j) => acc + (j.pendingCount || 0), 0),
    [jobs]
  );
  const maxCandidates = useMemo(
    () => Math.max(1, ...jobs.map((j) => j.applicationCount || 0)),
    [jobs]
  );

  // Filtragem
  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((j) => {
      // Filtro de aba
      if (statusTab === "OPEN" && j.status !== "OPEN") return false;
      if (statusTab === "CLOSED" && j.status !== "CLOSED" && j.status !== "PAUSED") return false;

      // Filtro de texto
      if (!q) return true;
      const codeMatch = j.code ? `#${j.code}`.toLowerCase().includes(q) || String(j.code).includes(q) : false;
      const titleMatch = j.title.toLowerCase().includes(q);
      const locMatch = j.location ? j.location.toLowerCase().includes(q) : false;
      return codeMatch || titleMatch || locMatch;
    });
  }, [jobs, statusTab, search]);

  return (
    <div className="space-y-6">
      {/* ─── Topo: Cabeçalho Executivo + Ações Globais ─── */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200/70 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Vagas</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {openCount} {openCount === 1 ? "vaga aberta" : "vagas abertas"}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Painel corporativo de vagas, funis de seleção e triagem de candidatos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CopyLink url={publicUrl} compact />

          <a
            href="/relatorio-geral"
            target="_blank"
            rel="noopener noreferrer"
            title="Relatório em PDF com todas as vagas e perfil dos candidatos"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 text-xs font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
          >
            <FileText className="size-3.5 text-zinc-500" />
            <span>Relatório geral (PDF)</span>
          </a>

          <Link
            href="/vagas/nova"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-xs font-semibold text-white shadow-2xs transition-opacity hover:opacity-95"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            <Plus className="size-4" strokeWidth={2.5} />
            <span>Nova vaga</span>
          </Link>
        </div>
      </div>

      {/* ─── Linha de KPIs / Métricas Executivas (4 Cards Compactos) ─── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {/* Total de Vagas */}
        <div className="flex flex-col justify-between rounded-xl border border-zinc-200/80 bg-white p-3.5 shadow-2xs sm:p-4">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-medium">Total de Vagas</span>
            <Briefcase className="size-4 text-zinc-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-zinc-950 tabular-nums">
              {totalJobs}
            </span>
            <span className="text-[11px] text-zinc-500">cadastradas</span>
          </div>
        </div>

        {/* Vagas Abertas */}
        <div className="flex flex-col justify-between rounded-xl border border-zinc-200/80 bg-white p-3.5 shadow-2xs sm:p-4">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-medium">Vagas Abertas</span>
            <CheckCircle2 className="size-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-emerald-700 tabular-nums">
              {openCount}
            </span>
            <span className="text-[11px] text-emerald-600 font-medium">recebendo CVs</span>
          </div>
        </div>

        {/* Total de Candidatos */}
        <div className="flex flex-col justify-between rounded-xl border border-zinc-200/80 bg-white p-3.5 shadow-2xs sm:p-4">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-medium">Candidatos no Funil</span>
            <Users className="size-4 text-zinc-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-zinc-950 tabular-nums">
              {totalCandidates}
            </span>
            <span className="text-[11px] text-zinc-500">inscritos</span>
          </div>
        </div>

        {/* Aguardando Resposta */}
        <div className="flex flex-col justify-between rounded-xl border border-zinc-200/80 bg-white p-3.5 shadow-2xs sm:p-4">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-medium">Fila de Triagem</span>
            <Clock className={`size-4 ${totalPending > 0 ? "text-amber-500" : "text-emerald-500"}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold tracking-tight tabular-nums ${
                totalPending > 0 ? "text-amber-700" : "text-emerald-700"
              }`}
            >
              {totalPending}
            </span>
            <span className="text-[11px] text-zinc-500">
              {totalPending > 0 ? "esperando resposta" : "fila em dia"}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Barra de Controles: Busca + Filtros de Status + Alternador de Visualização ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200/80 bg-white p-2.5 shadow-2xs">
        {/* Campo de Busca Rápida */}
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cargo, código (#1139) ou cidade…"
            className="h-9 w-full rounded-xl border border-zinc-200 bg-zinc-50/50 pl-9 pr-8 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Abas de Status & Toggle de Visualização */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Abas */}
          <div className="flex items-center rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setStatusTab("all")}
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                statusTab === "all"
                  ? "bg-white font-semibold text-zinc-900 shadow-2xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Todas <span className="ml-1 text-[11px] text-zinc-400">({totalJobs})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusTab("OPEN")}
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                statusTab === "OPEN"
                  ? "bg-white font-semibold text-emerald-800 shadow-2xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Abertas <span className="ml-1 text-[11px] text-emerald-600 font-bold">({openCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusTab("CLOSED")}
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                statusTab === "CLOSED"
                  ? "bg-white font-semibold text-zinc-900 shadow-2xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Encerradas <span className="ml-1 text-[11px] text-zinc-400">({closedCount})</span>
            </button>
          </div>

          <div className="h-5 w-px bg-zinc-200" />

          {/* Toggle de Modo: Tabela Executiva vs Cards */}
          <div className="flex items-center rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-0.5">
            <button
              type="button"
              onClick={() => handleSetViewMode("table")}
              title="Visão Tabela Executiva (FastRH / Linear / Alta Densidade)"
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                viewMode === "table"
                  ? "bg-white font-semibold text-zinc-900 shadow-2xs"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              <Rows3 className="size-3.5" />
              <span className="hidden sm:inline">Tabela</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode("grid")}
              title="Visão Cards Modernos (SaaS Pro / 2 colunas)"
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                viewMode === "grid"
                  ? "bg-white font-semibold text-zinc-900 shadow-2xs"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              <LayoutGrid className="size-3.5" />
              <span className="hidden sm:inline">Cards</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Conteúdo: Tabela Executiva ou Grid de Cards ─── */}
      {filteredJobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-12 text-center">
          <Briefcase className="mx-auto size-8 text-zinc-300" />
          <p className="mt-3 text-sm font-semibold text-zinc-900">Nenhuma vaga encontrada</p>
          <p className="mt-1 text-xs text-zinc-500">
            {search
              ? `Nenhum resultado corresponde à busca "${search}".`
              : "Não há vagas para a aba selecionada."}
          </p>
          {(search || statusTab !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatusTab("all");
              }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition-colors"
            >
              Limpar filtros
            </button>
          )}
        </div>
      ) : viewMode === "table" ? (
        /* ─── MODO TABELA EXECUTIVA (FAST-RH / GPS / LINEAR STYLE) ─── */
        <div className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200/80 bg-zinc-50/80 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="py-3 pl-4 pr-2 font-semibold">Cód</th>
                  <th className="py-3 px-3 font-semibold">Cargo & Praça</th>
                  <th className="py-3 px-3 font-semibold hidden md:table-cell">Regime / Modalidade</th>
                  <th className="py-3 px-3 font-semibold">Candidatos</th>
                  <th className="py-3 px-3 font-semibold hidden sm:table-cell">Fila de Triagem</th>
                  <th className="py-3 px-3 font-semibold">Status</th>
                  <th className="py-3 pl-3 pr-4 text-right font-semibold">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredJobs.map((job) => {
                  const { role, city } = parseJobTitleAndCity(job.title);
                  const style = statusStyles[job.status];
                  const ratio = Math.min(100, Math.round((job.applicationCount / maxCandidates) * 100));

                  return (
                    <tr
                      key={job.id}
                      className="group transition-colors hover:bg-zinc-50/80"
                    >
                      {/* Código da Vaga */}
                      <td className="py-3.5 pl-4 pr-2 font-mono text-[11px] font-bold text-zinc-600 tabular-nums">
                        {job.code ? (
                          <span className="rounded-md border border-zinc-200/80 bg-zinc-100/70 px-1.5 py-0.5">
                            #{job.code}
                          </span>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>

                      {/* Cargo & Praça */}
                      <td className="py-3.5 px-3">
                        <Link
                          href={`/vagas/${job.id}`}
                          className="font-bold text-zinc-900 group-hover:text-[var(--brand-primary)] transition-colors"
                        >
                          {role}
                        </Link>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          {city && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-600">
                              <MapPin className="size-3 text-zinc-400" />
                              {city}
                            </span>
                          )}
                          <span className="text-[10px] text-zinc-400">
                            · publicada {formatPublishedAgo(job.createdAt).replace("publicada ", "")}
                          </span>
                        </div>
                      </td>

                      {/* Regime / Modalidade */}
                      <td className="py-3.5 px-3 hidden md:table-cell text-zinc-600">
                        <span>{workModeLabels[job.workMode]}</span>
                        <span className="mx-1 text-zinc-300">·</span>
                        <span>{contractLabels[job.contract]}</span>
                      </td>

                      {/* Volume de Candidatos */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-900 tabular-nums">
                            {job.applicationCount}
                          </span>
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-100 hidden sm:block">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.max(6, ratio)}%`,
                                backgroundColor: "var(--brand-primary)",
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Fila de Triagem */}
                      <td className="py-3.5 px-3 hidden sm:table-cell">
                        {job.pendingCount > 0 ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/90 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 tabular-nums">
                            <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                            {job.pendingCount} esperando
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/90 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                            ✓ em dia
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${style.badge}`}
                        >
                          <span className={`size-1.5 rounded-full ${style.dot}`} />
                          {style.label}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 pl-3 pr-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/vagas/${job.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-50 hover:text-zinc-950 transition-colors"
                          >
                            <span>Abrir funil</span>
                            <ArrowRight className="size-3 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ─── MODO GRID DE CARDS REFINADOS (SAAS PRO / 2 COLUNAS) ─── */
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          {filteredJobs.map((job) => {
            const { role, city } = parseJobTitleAndCity(job.title);
            const style = statusStyles[job.status];

            return (
              <div
                key={job.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-2xs transition-all hover:border-zinc-300 hover:shadow-md"
              >
                {/* Linha da marca na borda esquerda no hover */}
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-1 opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ backgroundColor: "var(--brand-primary)" }}
                />

                {/* Topo do Card: Código + Título + Status */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        {job.code && (
                          <span className="rounded-md border border-zinc-200/80 bg-zinc-100/70 px-2 py-0.5 font-mono text-[10px] font-bold text-zinc-600 tabular-nums">
                            #{job.code}
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${style.badge}`}
                        >
                          <span className={`size-1.5 rounded-full ${style.dot}`} />
                          {style.label}
                        </span>
                      </div>

                      <Link
                        href={`/vagas/${job.id}`}
                        className="text-sm font-bold tracking-tight text-zinc-950 group-hover:text-[var(--brand-primary)] transition-colors truncate"
                      >
                        {role}
                      </Link>
                    </div>

                    <Link
                      href={`/vagas/${job.id}`}
                      className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-zinc-200/90 bg-zinc-50/80 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-100 hover:text-zinc-950 transition-colors"
                    >
                      <span>Abrir</span>
                      <ArrowRight className="size-3 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </div>

                  {/* Informações de Localidade e Contrato */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    {city && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100/80 px-2 py-0.5 font-medium text-zinc-700 text-[11px]">
                        <MapPin className="size-3 text-zinc-400" />
                        {city}
                      </span>
                    )}
                    <span>{workModeLabels[job.workMode]}</span>
                    <span>·</span>
                    <span>{contractLabels[job.contract]}</span>
                    <span>·</span>
                    <span className="text-[11px] text-zinc-400">
                      {formatPublishedAgo(job.createdAt).replace("publicada ", "")}
                    </span>
                  </div>
                </div>

                {/* Rodapé do Card: Contadores e Fila */}
                <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Users className="size-3.5 text-zinc-400" />
                    <span className="font-bold text-zinc-900 tabular-nums">
                      {job.applicationCount}
                    </span>
                    <span className="text-zinc-500">
                      {job.applicationCount === 1 ? "candidato" : "candidatos"}
                    </span>
                  </div>

                  <div>
                    {job.pendingCount > 0 ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/90 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 tabular-nums">
                        <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                        {job.pendingCount} na triagem
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/90 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                        ✓ em dia
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
