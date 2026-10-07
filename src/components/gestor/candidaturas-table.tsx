"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { AiScoreChip } from "@/components/gestor/ai-score-chip";
import { LiveRefresh } from "@/components/gestor/live-refresh";
import { Toast } from "@/components/gestor/toast";
import {
  bulkSetApplicationStatusAction,
  deleteApplicationsAction,
} from "@/server/controllers/application.controller";
import {
  appStatusLabels,
  formatAppliedAt,
  formatWaiting,
  type AppStatusKey,
} from "@/server/models/application.model";
import {
  applyFilters,
  countByStage,
  meetsMinimum,
  selectStage,
  sortRows,
  type CandidaturaRow,
  type SortKey,
  type StageKey,
} from "@/server/models/candidate-list.model";
import { personInitials } from "@/server/models/dashboard.model";

export type { CandidaturaRow };

/** Etapas do funil como abas — a organização segue o processo, não a tabela. */
const TABS: { key: StageKey; label: string }[] = [
  { key: "PENDING", label: "Triagem" },
  { key: "INTERVIEW", label: "Entrevista" },
  { key: "APPROVED", label: "Aprovados" },
  { key: "REJECTED", label: "Reprovados" },
  { key: "ALL", label: "Todos" },
];

const SORT_LABELS: Record<SortKey, string> = {
  WAITING: "Quem espera há mais tempo",
  RECENT: "Mais recentes",
  SCORE: "Maior aderência",
};

const statusPill: Record<AppStatusKey, string> = {
  PENDING: "bg-[#f1f0ed] text-[#71717a]",
  INTERVIEW: "bg-[#f7f0e1] text-[#b07818]",
  APPROVED: "bg-[#e4f6ec] text-[#1f7a4d]",
  REJECTED: "bg-[#fbeae8] text-[#c23b3b]",
};

/** Ações em massa por etapa — só o que faz sentido de onde o gestor está. */
const BULK_BY_TAB: Record<StageKey, AppStatusKey[]> = {
  PENDING: ["INTERVIEW", "REJECTED"],
  INTERVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["INTERVIEW"],
  REJECTED: ["PENDING"],
  ALL: ["INTERVIEW", "APPROVED", "REJECTED"],
};

const BULK_LABELS: Record<AppStatusKey, string> = {
  PENDING: "Voltar p/ triagem",
  INTERVIEW: "Chamar p/ entrevista",
  APPROVED: "Aprovar",
  REJECTED: "Reprovar",
};

const PAGE = 40;

/**
 * Candidatos (E3/E9). A etapa do funil é o organizador da tela: cada aba traz
 * a contagem, então o gestor vê onde está o trabalho antes de filtrar às
 * cegas. Dentro da triagem, a ordem padrão é por tempo de espera — a fila
 * começa por quem foi deixado esperando.
 */
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
  const pendingTotal = rows.filter((r) => r.status === "PENDING").length;

  const [tab, setTab] = useState<StageKey>(
    initialStatus ?? (pendingTotal > 0 ? "PENDING" : "ALL")
  );
  const [search, setSearch] = useState("");
  const [jobId, setJobId] = useState(initialJobId ?? "");
  const [onlyMeets, setOnlyMeets] = useState(initialOnlyMeets);
  const [sort, setSort] = useState<SortKey>("WAITING");
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<AppStatusKey | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  /** Tudo menos a aba — é a base das contagens de cada aba (scent honesto). */
  const scoped = useMemo(
    () => applyFilters(rows, { search, jobId, onlyMeets }),
    [rows, search, jobId, onlyMeets]
  );
  const counts = useMemo(() => countByStage(scoped), [scoped]);
  const filtered = useMemo(
    () => sortRows(selectStage(scoped, tab), sort),
    [scoped, tab, sort]
  );

  const visible = filtered.slice(0, limit);
  const visibleSelected = filtered.filter((r) => selected.has(r.id));
  const allVisibleSelected =
    visible.length > 0 && visible.every((r) => selected.has(r.id));

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
      allVisibleSelected ? new Set() : new Set(visible.map((r) => r.id))
    );
  }

  function changeTab(key: StageKey) {
    setTab(key);
    setSelected(new Set());
    setLimit(PAGE);
    setSort(key === "PENDING" ? "WAITING" : "RECENT");
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
        `${updated} candidato${updated === 1 ? "" : "s"} movido${updated === 1 ? "" : "s"} para "${appStatusLabels[newStatus]}".`
      );
      setSelected(new Set());
    });
  }

  function runDelete() {
    const ids = [...selected];
    setConfirmDelete(false);
    startTransition(async () => {
      const { deleted } = await deleteApplicationsAction(ids);
      setToast(
        `${deleted} candidatura${deleted === 1 ? "" : "s"} excluída${deleted === 1 ? "" : "s"}.`
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
    a.download = "candidatos.csv";
    a.click();
    URL.revokeObjectURL(url);
    setToast(`CSV exportado (${rowsToExport.length} linhas).`);
  }

  const anyAnalyzing = rows.some(
    (r) => r.aiState === "WAITING" || r.aiState === "PROCESSING"
  );
  const cols =
    "grid-cols-[28px_minmax(0,1fr)_auto] md:grid-cols-[36px_minmax(180px,2fr)_150px_minmax(120px,1fr)_44px_72px]";

  return (
    <>
      <LiveRefresh active={anyAnalyzing} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#0a0a0a]">Candidatos</h1>
          <span className="rounded-full bg-[#f1f0ed] px-2.5 py-1 text-[11px] font-medium text-[#57534e]">{rows.length}</span>
        </div>
        <p className="text-sm text-[#71717a]">
          {rows.length} no total
          {pendingTotal > 0 && (
            <>
              {" · "}
              <span className="font-medium text-[#b07818]">
                {pendingTotal} esperando sua resposta
              </span>
            </>
          )}
          {anyAnalyzing && (
            <span className="ml-2 inline-flex items-center gap-1.5 text-[#8a8781]">
              <span className="size-1.5 animate-pulse rounded-full bg-[#8a8781]" />
              atualizando análises…
            </span>
          )}
        </p>
        </div>
        {pendingTotal > 0 && (
          <Link href="/candidaturas?status=PENDING" className="hidden h-9 items-center rounded-xl px-4 text-[12px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90 sm:flex" style={{ backgroundColor: "var(--brand-primary)" }}>
            Triar agora →
          </Link>
        )}
      </div>

      {/* Etapas do funil com contagem — onde está o trabalho, sem filtrar às cegas */}
      <div
        role="tablist"
        aria-label="Etapa do processo"
        className="mt-7 flex gap-1 overflow-x-auto border-b border-[#e4e4e7]"
      >
        {TABS.map((item) => {
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => changeTab(item.key)}
              className={
                "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3.5 pb-2.5 pt-1 text-[13px] transition-colors " +
                (active
                  ? "font-medium text-[#0a0a0a]"
                  : "border-transparent text-[#71717a] hover:text-[#0a0a0a]")
              }
              style={
                active ? { borderColor: "var(--brand-primary)" } : undefined
              }
            >
              {item.label}
              <span
                className={
                  "rounded-full px-1.5 text-[11px] font-medium " +
                  (active
                    ? "bg-[#e7e5e4] text-[#0a0a0a]"
                    : "bg-[#f1f0ed] text-[#a1a1aa]")
                }
              >
                {counts[item.key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Controles secundários: refinam a aba, não competem com ela */}
      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <div className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-[#e4e4e7] bg-white px-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <span className="text-sm text-[#a1a1aa]" aria-hidden>
            ⌕
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nome ou e-mail…"
            aria-label="Buscar candidatos"
            className="w-full bg-transparent text-[13px] text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:outline-none"
          />
        </div>

        {jobs.length > 1 && (
          <select
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            aria-label="Filtrar por vaga"
            className="h-10 max-w-[220px] rounded-xl border border-[#e4e4e7] bg-white px-3 text-[13px] text-[#0a0a0a] focus:border-[#0a0a0a] focus:outline-none"
          >
            <option value="">Todas as vagas</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </select>
        )}

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Ordenar por"
          className="h-10 rounded-xl border border-[#e4e4e7] bg-white px-3 text-[13px] text-[#0a0a0a] focus:border-[#0a0a0a] focus:outline-none"
        >
          {Object.entries(SORT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-[#e4e4e7] bg-white px-3 text-[13px] text-[#0a0a0a]">
          <input
            type="checkbox"
            checked={onlyMeets}
            onChange={(e) => setOnlyMeets(e.target.checked)}
            className="size-3.5 accent-[#0a0a0a]"
          />
          Só quem atende o mínimo
        </label>
      </div>

      {/* Lista */}
      <div className="mt-5 overflow-hidden rounded-2xl border border-[#e4e4e7] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div
          className={`hidden md:grid ${cols} items-center gap-4 border-b border-[#e4e4e7] px-5 py-3`}
        >
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleAll}
            aria-label="Selecionar todos"
            className="size-4 accent-[#0a0a0a]"
          />
          {[
            "CANDIDATO",
            "ADERÊNCIA · IA",
            tab === "PENDING" ? "ESPERANDO" : "QUANDO",
            "CV",
            "",
          ].map((h, i) => (
            <span
              key={i}
              className="text-[11px] font-medium tracking-[0.6px] text-[#a1a1aa]"
            >
              {h}
            </span>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="p-6 text-sm text-[#71717a]">
            {tab === "PENDING"
              ? "Ninguém esperando resposta. Fila limpa."
              : "Nenhum candidato nesta etapa."}
          </p>
        )}

        {visible.map((row) => {
          const isSelected = selected.has(row.id);
          const waiting = row.status === "PENDING";
          return (
            <div
              key={row.id}
              className={
                `grid ${cols} items-center gap-3 border-b border-[#e4e4e7] px-4 py-4 transition-colors last:border-b-0 hover:bg-[#fafaf9] md:gap-4 md:px-5 ` +
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
              <Link
                href={`/candidaturas/${row.id}`}
                className="flex min-w-0 items-center gap-3 focus-visible:outline-none"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1c1917] text-[10px] font-bold text-white">
                  {personInitials(row.name)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-[#0a0a0a]">
                    {row.name}
                    {row.isDemo && (
                      <span className="ml-1.5 rounded-full bg-[#f5f3ff] px-1.5 py-0.5 align-middle text-[10px] font-medium text-[#6d28d9]">
                        Demonstração
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[11px] text-[#a1a1aa]">
                    {row.jobTitle}
                    {waiting && (
                      <span className="font-medium text-[#b07818] md:hidden">
                        {" · "}
                        {formatWaiting(new Date(row.createdAt))}
                      </span>
                    )}
                  </span>
                </span>
              </Link>
              <AiScoreChip
                aiScore={row.aiScore}
                aiState={row.aiState}
                meetsMinimum={meetsMinimum(row)}
              />
              <span className="hidden min-w-0 text-xs text-[#71717a] md:block">
                {waiting ? (
                  <span className="font-medium text-[#b07818]">
                    {formatWaiting(new Date(row.createdAt))}
                  </span>
                ) : (
                  formatAppliedAt(new Date(row.createdAt))
                )}
                {tab === "ALL" && (
                  <span
                    className={`ml-2 inline-flex h-5 items-center rounded-full px-2 text-[10px] font-medium ${statusPill[row.status]}`}
                  >
                    {appStatusLabels[row.status]}
                  </span>
                )}
              </span>
              {row.resumeUrl ? (
                <a
                  href={`/candidaturas/${row.id}/cv`}
                  className="hidden text-sm text-[#71717a] hover:text-[#0a0a0a] md:inline"
                  title="Baixar currículo"
                >
                  ↓
                </a>
              ) : (
                <span className="hidden text-sm text-[#e4e4e7] md:inline">–</span>
              )}
              <Link
                href={`/candidaturas/${row.id}`}
                className="hidden text-right text-xs font-medium hover:underline md:block"
                style={{ color: "var(--brand-primary)" }}
              >
                Abrir ›
              </Link>
            </div>
          );
        })}

        {filtered.length > visible.length && (
          <button
            type="button"
            onClick={() => setLimit((l) => l + PAGE)}
            className="w-full border-t border-[#e4e4e7] py-3 text-[13px] font-medium text-[#71717a] hover:bg-[#fafaf9] hover:text-[#0a0a0a]"
          >
            Mostrar mais ({filtered.length - visible.length} restantes)
          </button>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={exportCsv}
          className="text-xs font-medium text-[#a1a1aa] hover:text-[#0a0a0a]"
        >
          Exportar CSV
        </button>
      </div>

      {/* Barra de ações em massa (E9) */}
      {selected.size > 0 && (
        <div className="fixed bottom-20 left-1/2 z-50 flex h-14 max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-3 overflow-x-auto rounded-2xl bg-[#1c1917] px-4 shadow-[0px_8px_12px_rgba(0,0,0,0.25)] md:bottom-8 md:px-5">
          <span className="shrink-0 text-[13px] font-medium text-white">
            {selected.size} selecionado{selected.size === 1 ? "" : "s"}
          </span>
          <span className="h-8 w-px bg-white/15" />
          {BULK_BY_TAB[tab].map((target) => (
            <button
              key={target}
              type="button"
              disabled={pending}
              onClick={() => requestBulk(target)}
              className={
                "h-[34px] shrink-0 rounded-[10px] px-4 text-xs font-medium disabled:opacity-50 " +
                (target === "REJECTED"
                  ? "bg-[#c86b60]/25 text-[#f5b7b0] hover:bg-[#c86b60]/40"
                  : "bg-white/12 text-white hover:bg-white/20")
              }
            >
              {BULK_LABELS[target]}
            </button>
          ))}
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmDelete(true)}
            className="h-[34px] shrink-0 rounded-[10px] bg-[#c86b60]/25 px-4 text-xs font-medium text-[#f5b7b0] hover:bg-[#c86b60]/40 disabled:opacity-50"
          >
            Excluir
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
              {BULK_LABELS[confirm]}: {selected.size} candidato
              {selected.size === 1 ? "" : "s"}?
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
                {confirm === "REJECTED" ? "Reprovar" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exclusão definitiva — confirmação obrigatória */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmDelete(false)}
        >
          <div
            className="w-full max-w-[400px] rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-[#0a0a0a]">
              Excluir {selected.size} candidatura
              {selected.size === 1 ? "" : "s"}?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#71717a]">
              Somem do painel junto com respostas, histórico, notas e
              currículos enviados para a vaga. Ninguém é avisado. Não dá para
              desfazer.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="h-10 rounded-2xl border border-[#e4e4e7] bg-white px-5 text-[13px] font-medium text-[#71717a] hover:text-[#0a0a0a]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={runDelete}
                className="h-10 rounded-2xl bg-[#c23b3b] px-5 text-[13px] font-medium text-white hover:opacity-90"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  );
}
