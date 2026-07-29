"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import type { AIState, AppStatus } from "@prisma/client";

import { AiScoreChip } from "@/components/gestor/ai-score-chip";
import { LiveRefresh } from "@/components/gestor/live-refresh";
import { Toast } from "@/components/gestor/toast";
import { bulkSetApplicationStatusAction } from "@/server/controllers/application.controller";
import {
  appStatusLabels,
  formatAppliedAt,
  type AppStatusKey,
} from "@/server/models/application.model";
import { personInitials } from "@/server/models/dashboard.model";

export type CandidaturaRow = {
  id: string;
  name: string;
  email: string;
  createdAt: string; // ISO
  status: AppStatus;
  aiState: AIState;
  aiScore: number | null;
  resumeUrl: string | null;
  jobId: string;
  jobTitle: string;
  aiMinScore: number;
};

const statusPill: Record<AppStatusKey, string> = {
  PENDING: "bg-[#f1f0ed] text-[#a1a1aa]",
  INTERVIEW: "bg-[#f7f0e1] text-[#b07818]",
  APPROVED: "bg-[#e4f6ec] text-[#1f7a4d]",
  REJECTED: "bg-[#fbeae8] text-[#c23b3b]",
};

/** E3/E9 · Candidaturas com filtros, seleção em massa e exportação (G11). */
export function CandidaturasTable({
  rows,
  jobs,
  initialJobId,
  initialStatus,
  initialOnlyMeets = false,
}: {
  rows: CandidaturaRow[];
  jobs: { id: string; title: string }[];
  initialJobId?: string;
  initialStatus?: AppStatusKey;
  initialOnlyMeets?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [jobId, setJobId] = useState(initialJobId ?? "");
  const [status, setStatus] = useState<"" | AppStatusKey>(initialStatus ?? "");
  const [onlyMeets, setOnlyMeets] = useState(initialOnlyMeets);
  const [minScore, setMinScore] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<AppStatusKey | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (q && !row.name.toLowerCase().includes(q) && !row.email.toLowerCase().includes(q))
        return false;
      if (jobId && row.jobId !== jobId) return false;
      if (status && row.status !== status) return false;
      if (onlyMeets && (row.aiScore === null || row.aiScore < row.aiMinScore))
        return false;
      if (minScore > 0 && (row.aiScore === null || row.aiScore < minScore))
        return false;
      return true;
    });
  }, [rows, search, jobId, status, minScore, onlyMeets]);

  const visibleSelected = filtered.filter((r) => selected.has(r.id));
  const allVisibleSelected =
    filtered.length > 0 && visibleSelected.length === filtered.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(
      allVisibleSelected ? new Set() : new Set(filtered.map((r) => r.id))
    );
  }

  function clearFilters() {
    setSearch("");
    setJobId("");
    setStatus("");
    setMinScore(0);
    setOnlyMeets(false);
  }

  /** Ações que enviam e-mail ao candidato exigem confirmação (irreversível). */
  function requestBulk(newStatus: AppStatusKey) {
    if (newStatus === "PENDING") return runBulk(newStatus);
    setConfirm(newStatus);
  }

  function runBulk(newStatus: AppStatusKey) {
    const ids = [...selected];
    setConfirm(null);
    startTransition(async () => {
      const { updated } = await bulkSetApplicationStatusAction(ids, newStatus);
      setToast(
        `${updated} candidatura${updated === 1 ? "" : "s"} movida${updated === 1 ? "" : "s"} para "${appStatusLabels[newStatus]}".`
      );
      setSelected(new Set());
    });
  }

  function exportCsv() {
    const rowsToExport = visibleSelected.length > 0 ? visibleSelected : filtered;
    const header = "Nome;E-mail;Vaga;Score IA;Status;Data\n";
    const body = rowsToExport
      .map((r) =>
        [
          r.name,
          r.email,
          r.jobTitle,
          r.aiScore ?? "",
          appStatusLabels[r.status],
          formatAppliedAt(new Date(r.createdAt)),
        ]
          .map((v) => `"${String(v).replaceAll('"', '""')}"`)
          .join(";")
      )
      .join("\n");
    const blob = new Blob(["﻿" + header + body], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "candidaturas.csv";
    a.click();
    URL.revokeObjectURL(url);
    setToast(`CSV exportado (${rowsToExport.length} linhas).`);
  }

  const activeChips: { label: string; clear: () => void }[] = [];
  if (onlyMeets)
    activeChips.push({
      label: "Atendem o mínimo",
      clear: () => setOnlyMeets(false),
    });
  if (minScore > 0)
    activeChips.push({ label: `Score ≥ ${minScore}`, clear: () => setMinScore(0) });
  if (status)
    activeChips.push({
      label: appStatusLabels[status],
      clear: () => setStatus(""),
    });
  if (jobId)
    activeChips.push({
      label: jobs.find((j) => j.id === jobId)?.title ?? "Vaga",
      clear: () => setJobId(""),
    });

  const inputBase =
    "h-full bg-transparent text-[13px] text-[#0a0a0a] focus:outline-none";

  const anyAnalyzing = rows.some(
    (r) => r.aiState === "WAITING" || r.aiState === "PROCESSING"
  );

  return (
    <>
      <LiveRefresh active={anyAnalyzing} />
      <p className="mt-2 text-sm text-[#71717a]">
        {rows.length} no total
        {selected.size > 0 ? ` · ${selected.size} selecionadas` : ""}
        {anyAnalyzing && (
          <span className="ml-2 inline-flex items-center gap-1.5 text-[#8a8781]">
            <span className="size-1.5 animate-pulse rounded-full bg-[#8a8781]" />
            atualizando análises…
          </span>
        )}
      </p>

      {/* Barra de filtros (E9) */}
      <div className="mt-6 flex h-12 items-stretch divide-x divide-[#e4e4e7] overflow-hidden rounded-[10px] border border-[#e4e4e7] bg-white">
        <div className="flex flex-1 items-center gap-2 px-4">
          <span className="text-sm text-[#a1a1aa]" aria-hidden>
            ⌕
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nome ou e-mail…"
            aria-label="Buscar candidaturas"
            className={`${inputBase} w-full placeholder:text-[#a1a1aa]`}
          />
        </div>
        <select
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          aria-label="Filtrar por vaga"
          className={`${inputBase} max-w-[180px] px-3`}
        >
          <option value="">Vaga: todas</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.title}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as "" | AppStatusKey)}
          aria-label="Filtrar por status"
          className={`${inputBase} max-w-[160px] px-3`}
        >
          <option value="">Status: todos</option>
          {Object.entries(appStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-3 px-4 text-[13px] text-[#0a0a0a]">
          Score ≥
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="w-[120px]"
            style={{ accentColor: "var(--brand-primary)" }}
          />
          <span className="w-6 text-sm font-bold">{minScore}</span>
        </label>
        <button
          type="button"
          onClick={clearFilters}
          className="px-4 text-xs font-medium text-[#71717a] hover:text-[#0a0a0a]"
        >
          Limpar filtros
        </button>
      </div>

      {/* Chips de filtros ativos */}
      {activeChips.length > 0 && (
        <div className="mt-4 flex items-center gap-3">
          {activeChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={chip.clear}
              className="flex h-7 items-center gap-2 rounded-full bg-[#e7e5e4] px-3 text-[11px] font-medium text-[#0a0a0a] hover:bg-[#dedcda]"
            >
              {chip.label}
              <span className="text-[#71717a]">✕</span>
            </button>
          ))}
          <span className="text-xs text-[#a1a1aa]">
            {filtered.length} resultado{filtered.length === 1 ? "" : "s"}
          </span>
        </div>
      )}

      {/* Tabela */}
      <div className="mt-6 overflow-hidden rounded-xl border border-[#e4e4e7] bg-white">
        <div className="grid grid-cols-[40px_minmax(200px,2fr)_170px_140px_80px_60px_80px] items-center gap-4 border-b border-[#e4e4e7] px-5 py-3.5">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleAll}
            aria-label="Selecionar todos"
            className="size-4 accent-[#0a0a0a]"
          />
          {["CANDIDATO", "ADERÊNCIA · IA", "STATUS", "DATA", "CV", ""].map(
            (h, i) => (
              <span
                key={i}
                className="text-[11px] font-medium tracking-[0.6px] text-[#a1a1aa]"
              >
                {h}
              </span>
            )
          )}
        </div>
        {filtered.length === 0 && (
          <p className="p-6 text-sm text-[#71717a]">
            Nenhuma candidatura com esses filtros.
          </p>
        )}
        {filtered.map((row) => {
          const isSelected = selected.has(row.id);
          return (
            <div
              key={row.id}
              className={
                "grid grid-cols-[40px_minmax(200px,2fr)_170px_140px_80px_60px_80px] items-center gap-4 border-b border-[#e4e4e7] px-5 py-4 last:border-b-0 " +
                (isSelected ? "bg-[#fafaf9]" : "")
              }
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggle(row.id)}
                aria-label={`Selecionar ${row.name}`}
                className="size-4 accent-[#0a0a0a]"
              />
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1c1917] text-[10px] font-bold text-white">
                  {personInitials(row.name)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-[#0a0a0a]">
                    {row.name}
                  </span>
                  <span className="block truncate text-[11px] text-[#a1a1aa]">
                    {row.jobTitle}
                  </span>
                </span>
              </div>
              <AiScoreChip
                aiScore={row.aiScore}
                aiState={row.aiState}
                meetsMinimum={
                  row.aiScore !== null && row.aiScore >= row.aiMinScore
                }
              />
              <span
                className={`inline-flex h-6 w-fit items-center gap-1.5 rounded-full px-3 text-[11px] font-medium ${statusPill[row.status]}`}
              >
                <span className="size-1.5 rounded-full bg-current" />
                {appStatusLabels[row.status]}
              </span>
              <span className="text-xs text-[#71717a]">
                {formatAppliedAt(new Date(row.createdAt))}
              </span>
              {row.resumeUrl ? (
                <a
                  href={`/candidaturas/${row.id}/cv`}
                  className="text-sm text-[#71717a] hover:text-[#0a0a0a]"
                  title="Baixar currículo"
                >
                  ↓
                </a>
              ) : (
                <span className="text-sm text-[#e4e4e7]">—</span>
              )}
              <Link
                href={`/candidaturas/${row.id}`}
                className="text-right text-xs font-medium hover:underline"
                style={{ color: "var(--brand-primary)" }}
              >
                Abrir ›
              </Link>
            </div>
          );
        })}
      </div>

      {/* Barra de ações em massa (E9) */}
      {selected.size > 0 && (
        <div className="fixed bottom-8 left-1/2 z-40 flex h-14 -translate-x-1/2 items-center gap-3 rounded-2xl bg-[#1c1917] px-5 shadow-[0px_8px_12px_rgba(0,0,0,0.25)]">
          <span className="text-[13px] font-medium text-white">
            {selected.size} selecionado{selected.size === 1 ? "" : "s"}
          </span>
          <span className="h-8 w-px bg-white/15" />
          <button
            type="button"
            disabled={pending}
            onClick={() => requestBulk("INTERVIEW")}
            className="h-[34px] rounded-[10px] bg-white/12 px-4 text-xs font-medium text-white hover:bg-white/20 disabled:opacity-50"
          >
            Mover p/ Entrevista
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => requestBulk("APPROVED")}
            className="h-[34px] rounded-[10px] bg-white/12 px-4 text-xs font-medium text-white hover:bg-white/20 disabled:opacity-50"
          >
            Aprovar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => requestBulk("REJECTED")}
            className="h-[34px] rounded-[10px] bg-[#c86b60]/25 px-4 text-xs font-medium text-[#f5b7b0] hover:bg-[#c86b60]/40 disabled:opacity-50"
          >
            Reprovar
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="h-[34px] rounded-[10px] bg-white/12 px-4 text-xs font-medium text-white hover:bg-white/20"
          >
            Exportar CSV
          </button>
          {selected.size >= 2 && selected.size <= 3 && (
            <Link
              href={`/candidaturas/comparar?ids=${[...selected].join(",")}`}
              className="h-[34px] rounded-[10px] bg-white/12 px-4 text-xs font-medium leading-[34px] text-white hover:bg-white/20"
            >
              Comparar
            </Link>
          )}
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            aria-label="Limpar seleção"
            className="ml-1 text-sm text-white/60 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Confirmação — a ação envia e-mail e não se desfaz (H3/H5) */}
      {confirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirm(null)}
        >
          <div
            className="w-full max-w-[400px] rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-[#0a0a0a]">
              {appStatusLabels[confirm]} {selected.size}{" "}
              candidatura{selected.size === 1 ? "" : "s"}?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#71717a]">
              {confirm === "REJECTED"
                ? "Cada candidato receberá um e-mail informando o fim do processo. Esta ação não pode ser desfeita."
                : "Cada candidato receberá um e-mail sobre a mudança de etapa. Esta ação não pode ser desfeita."}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="h-10 rounded-2xl border border-[#e4e4e7] bg-white px-5 text-[13px] font-medium text-[#71717a] hover:text-[#0a0a0a]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => runBulk(confirm)}
                className={
                  "h-10 rounded-2xl px-5 text-[13px] font-medium text-white hover:opacity-90 " +
                  (confirm === "REJECTED" ? "bg-[#c23b3b]" : "bg-[#0a0a0a]")
                }
              >
                {confirm === "REJECTED" ? "Reprovar" : `Confirmar`}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  );
}
