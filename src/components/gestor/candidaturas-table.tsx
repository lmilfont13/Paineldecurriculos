"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState, useTransition } from "react";

import { AiScoreChip } from "@/components/gestor/ai-score-chip";
import { BulkMessageDialog } from "@/components/gestor/bulk-message-dialog";
import { LiveRefresh } from "@/components/gestor/live-refresh";
import { Toast } from "@/components/gestor/toast";
import {
  bulkSetApplicationStatusAction,
  deleteApplicationsAction,
  extractPhotosBulkAction,
  searchCandidatesAction,
  generateCandidatesReportAction,
  type CandidateSummary,
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
  aiRankInGroups,
  groupRowsByJob,
  jobLabel,
  meetsMinimum,
  nextToTriage,
  selectByCutoff,
  selectStage,
  sortRows,
  type CandidaturaRow,
  type CutoffSelection,
  type SortKey,
  type StageKey,
} from "@/server/models/candidate-list.model";
import { CandidateAvatar } from "@/components/gestor/candidate-avatar";

export type { CandidaturaRow };

/** Etapas do funil como abas — a organização segue o processo, não a tabela. */
const TABS: { key: StageKey; label: string }[] = [
  { key: "PENDING", label: "Triagem" },
  { key: "SHORTLISTED", label: "Passou da triagem" },
  { key: "INTERVIEW", label: "Entrevista" },
  { key: "APPROVED", label: "Aprovados" },
  { key: "REJECTED", label: "Reprovados" },
  { key: "ALL", label: "Todos" },
];

const SORT_LABELS: Record<SortKey, string> = {
  WAITING: "Quem espera há mais tempo",
  RECENT: "Mais recentes",
  SCORE: "Maior aderência",
  AI: "Indicação da IA (melhores primeiro)",
};

const statusPill: Record<AppStatusKey, string> = {
  PENDING: "bg-[#f1f0ed] text-[#71717a]",
  SHORTLISTED: "bg-[#eaf1fb] text-[#2f5fa8]",
  INTERVIEW: "bg-[#f7f0e1] text-[#b07818]",
  APPROVED: "bg-[#e4f6ec] text-[#1f7a4d]",
  REJECTED: "bg-[#fbeae8] text-[#c23b3b]",
};

/** Ações em massa por etapa — só o que faz sentido de onde o gestor está. */
const BULK_BY_TAB: Record<StageKey, AppStatusKey[]> = {
  PENDING: ["SHORTLISTED", "INTERVIEW", "REJECTED"],
  SHORTLISTED: ["INTERVIEW", "REJECTED", "PENDING"],
  INTERVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["INTERVIEW"],
  REJECTED: ["PENDING"],
  ALL: ["SHORTLISTED", "INTERVIEW", "APPROVED", "REJECTED"],
};

const BULK_LABELS: Record<AppStatusKey, string> = {
  PENDING: "Voltar p/ triagem",
  SHORTLISTED: "Passou da triagem",
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
  messageTemplates = [],
  companyName = "",
}: {
  rows: CandidaturaRow[];
  jobs: { id: string; title: string; code?: string | null }[];
  initialJobId?: string;
  initialStatus?: AppStatusKey;
  initialOnlyMeets?: boolean;
  /** Recados salvos da empresa, para o envio em massa. */
  messageTemplates?: { id: string; subject: string; body: string }[];
  companyName?: string;
}) {
  const pendingTotal = rows.filter((r) => r.status === "PENDING").length;

  const [tab, setTab] = useState<StageKey>(
    initialStatus ?? (pendingTotal > 0 ? "PENDING" : "ALL")
  );
  const [search, setSearch] = useState("");
  const [jobId, setJobId] = useState(initialJobId ?? "");
  const [onlyMeets, setOnlyMeets] = useState(initialOnlyMeets);
  const [sort, setSort] = useState<SortKey>("WAITING");
  const [sortInfoOpen, setSortInfoOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"list" | "cards">("cards");
  const [onlyPhoto, setOnlyPhoto] = useState(false);
  const [contentMatches, setContentMatches] = useState<Set<string> | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [messageOpen, setMessageOpen] = useState(false);
  const [confirm, setConfirm] = useState<AppStatusKey | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [report, setReport] = useState<CandidateSummary[] | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  // Busca no conteúdo do currículo (servidor), com debounce; nome/e-mail filtram na hora.
  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) {
      setContentMatches(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      searchCandidatesAction(term)
        .then((ids) => {
          if (!cancelled) setContentMatches(new Set(ids));
        })
        .catch(() => {
          if (!cancelled) setContentMatches(null);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  async function extractPhotos(ids?: string[]) {
    setPhotoBusy(true);
    try {
      const r = await extractPhotosBulkAction(ids);
      setToast(
        r.processed === 0
          ? "Nenhum currículo pendente de foto."
          : `${r.found} foto(s) extraída(s) de ${r.processed} currículo(s).`
      );
    } catch {
      setToast("Não foi possível extrair as fotos agora.");
    } finally {
      setPhotoBusy(false);
    }
  }

  /** Tudo menos a aba — é a base das contagens de cada aba (scent honesto). */
  const scoped = useMemo(
    () => applyFilters(rows, { search, jobId, onlyMeets, onlyPhoto, contentMatches }),
    [rows, search, jobId, onlyMeets, onlyPhoto, contentMatches]
  );
  const counts = useMemo(() => countByStage(scoped), [scoped]);
  // "Triar agora" abre quem espera há mais tempo (respeitando vaga e busca ativas).
  const nextCandidate = useMemo(() => nextToTriage(scoped), [scoped]);
  const filtered = useMemo(
    () => sortRows(selectStage(scoped, tab), sort),
    [scoped, tab, sort]
  );

  // Com várias vagas e sem filtro de vaga, os candidatos ficam agrupados por vaga.
  const showGroups = !jobId && jobs.length > 1;
  const ordered = useMemo(
    () => (showGroups ? groupRowsByJob(filtered) : filtered),
    [filtered, showGroups]
  );
  const visible = ordered.slice(0, limit);
  // Na ordenação pela IA, cada candidato mostra a posição que ocupa dentro da própria vaga.
  const aiRanks = useMemo(() => (sort === "AI" ? aiRankInGroups(ordered) : null), [sort, ordered]);
  const jobCounts = useMemo(
    () =>
      filtered.reduce<Record<string, number>>((acc, r) => {
        acc[r.jobId] = (acc[r.jobId] ?? 0) + 1;
        return acc;
      }, {}),
    [filtered]
  );

  /** Cabeçalho da vaga, antes do primeiro candidato de cada grupo. */
  function groupHeader(row: CandidaturaRow, index: number, className: string) {
    if (!showGroups || (index > 0 && visible[index - 1].jobId === row.jobId)) return null;
    return (
      <div className={className}>
        <span className="text-[13px] font-semibold text-[#0a0a0a]">
          {jobLabel(row.jobTitle, row.jobCode)}
        </span>
        <span className="ml-2 text-[12px] text-[#71717a]">
          {jobCounts[row.jobId]} {jobCounts[row.jobId] === 1 ? "candidato" : "candidatos"}
        </span>
      </div>
    );
  }
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
    // Voltar para a triagem e "passou da triagem" não avisam o candidato por e-mail: sem confirmação.
    if (newStatus === "PENDING" || newStatus === "SHORTLISTED") return runBulk(newStatus);
    setConfirm(newStatus);
  }

  /** Quem está na triagem e já atingiu a nota mínima da própria vaga (respeita os filtros da tela). */
  const readyToPass = filtered.filter((r) => r.status === "PENDING" && meetsMinimum(r));

  function passAllMeetingMinimum() {
    if (!window.confirm(`Passar ${readyToPass.length} candidato${readyToPass.length === 1 ? "" : "s"} que atingiram a nota mínima para "Passou da triagem"?`)) return;
    runBulk("SHORTLISTED", readyToPass.map((r) => r.id));
  }

  function runBulk(newStatus: AppStatusKey, only?: string[]) {
    const ids = only ?? [...selected];
    setConfirm(null);
    startTransition(async () => {
      // A ação aceita até 100 por chamada: manda em lotes para não deixar ninguém de fora.
      let updated = 0;
      for (let i = 0; i < ids.length; i += 100) {
        updated += (await bulkSetApplicationStatusAction(ids.slice(i, i + 100), newStatus)).updated;
      }
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

  async function generateReport() {
    setReportLoading(true);
    const result = await generateCandidatesReportAction([...selected]);
    setReportLoading(false);
    if (result.ok) {
      setReport(result.reports);
    } else {
      setToast(result.error);
    }
  }

  function copyReportText() {
    if (!report) return;
    const lines = report.map((r) => {
      const pontos = r.pontos_fortes.map((p) => `  • ${p}`).join("\n");
      return [
        `${r.name} — ${r.jobTitle}`,
        r.resumo,
        r.pontos_fortes.length > 0 ? `Pontos fortes:\n${pontos}` : "",
        r.justificativa ? `Por que entrevistar: ${r.justificativa}` : "",
        r.error ? `(Atenção: ${r.error})` : "",
      ]
        .filter(Boolean)
        .join("\n");
    });
    navigator.clipboard
      .writeText(lines.join("\n\n---\n\n"))
      .then(() => setToast("Relatório copiado."))
      .catch(() => setToast("Falha ao copiar."));
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
        <div className="flex items-center gap-2">
          <Link
            href="/buscar-cvs"
            className="flex h-9 items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 text-[12px] font-semibold text-amber-900 transition hover:bg-amber-100"
          >
            🔍 Buscar CVs
          </Link>
          <Link
            href="/candidaturas/novo"
            className="flex h-9 items-center rounded-xl border border-[#e4e4e7] bg-white px-3.5 text-[12px] font-semibold text-[#0a0a0a] hover:bg-[#fafaf9]"
          >
            + Adicionar candidatos
          </Link>
          <button
            type="button"
            disabled={photoBusy}
            onClick={() => extractPhotos()}
            className="flex h-9 items-center rounded-xl border border-[#e4e4e7] bg-white px-3.5 text-[12px] font-semibold text-[#0a0a0a] hover:bg-[#fafaf9] disabled:opacity-60"
          >
            {photoBusy ? "Extraindo fotos…" : "Extrair fotos dos currículos"}
          </button>
          {nextCandidate && (
            <Link href={`/candidaturas/${nextCandidate.id}`} className="flex h-9 items-center rounded-xl px-4 text-[12px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90" style={{ backgroundColor: "var(--brand-primary)" }}>
              Triar agora →
            </Link>
          )}
        </div>
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
            placeholder="Buscar nome, e-mail ou palavra no currículo…"
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
                {jobLabel(job.title, job.code)}
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
        <div className="relative">
          <button
            type="button"
            onClick={() => setSortInfoOpen((o) => !o)}
            aria-label="Entenda a diferença entre maior aderência e indicação da IA"
            aria-expanded={sortInfoOpen}
            className="flex size-7 items-center justify-center rounded-full border border-[#d4d4d8] bg-white text-[12px] font-semibold italic text-[#71717a] hover:border-[#0a0a0a] hover:text-[#0a0a0a]"
          >
            i
          </button>
          {sortInfoOpen && (
            <div
              role="dialog"
              className="absolute right-0 top-9 z-30 w-[320px] rounded-xl border border-[#e4e4e7] bg-white p-4 text-[12px] leading-5 text-[#44403c] shadow-lg"
            >
              <p className="font-semibold text-[#0a0a0a]">Maior aderência × Indicação da IA</p>
              <p className="mt-2">
                <strong className="text-[#0a0a0a]">Maior aderência</strong> ordena só pela nota da triagem (0 a 100): quanto o
                currículo atende os critérios da vaga.
              </p>
              <p className="mt-2">
                <strong className="text-[#0a0a0a]">Indicação da IA</strong> coloca primeiro quem atinge a nota mínima da vaga e,
                dentro disso, ordena pelo índice de decisão: 60% a nota + 40% dos critérios atendidos, um a um. Por isso duas
                pessoas com a mesma nota podem ficar em ordem diferente.
              </p>
              <p className="mt-2 text-[#71717a]">O &quot;1º&quot;, &quot;2º&quot; no cartão é a posição dentro da própria vaga.</p>
              <button type="button" onClick={() => setSortInfoOpen(false)} className="mt-3 text-[11px] font-medium underline underline-offset-2">
                Fechar
              </button>
            </div>
          )}
        </div>

        <select
          value=""
          onChange={(e) => {
            const mode = e.target.value;
            if (mode === "NONE") setSelected(new Set());
            else if (mode) setSelected(new Set(selectByCutoff(filtered, mode as CutoffSelection).map((r) => r.id)));
          }}
          aria-label="Selecionar candidatos em massa"
          className="h-10 rounded-xl border border-[#e4e4e7] bg-white px-3 text-[13px] text-[#0a0a0a] focus:border-[#0a0a0a] focus:outline-none"
        >
          <option value="">Selecionar…</option>
          <option value="ALL">Todos ({selectByCutoff(filtered, "ALL").length})</option>
          <option value="ABOVE">Acima do corte ({selectByCutoff(filtered, "ABOVE").length})</option>
          <option value="BELOW">Abaixo do corte ({selectByCutoff(filtered, "BELOW").length})</option>
          <option value="UNANALYZED">Sem análise ({selectByCutoff(filtered, "UNANALYZED").length})</option>
          <option value="NONE">Limpar seleção</option>
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

        <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-[#e4e4e7] bg-white px-3 text-[13px] text-[#0a0a0a]">
          <input
            type="checkbox"
            checked={onlyPhoto}
            onChange={(e) => setOnlyPhoto(e.target.checked)}
            className="size-3.5 accent-[#0a0a0a]"
          />
          Somente com foto
        </label>

        {(tab === "PENDING" || tab === "ALL") && readyToPass.length > 0 && (
          <button
            type="button"
            disabled={pending}
            onClick={passAllMeetingMinimum}
            title="Move para 'Passou da triagem' todos da triagem que atingiram a nota mínima da vaga"
            className="h-10 rounded-xl px-4 text-[13px] font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-foreground)" }}
          >
            Passar quem atende o mínimo ({readyToPass.length})
          </button>
        )}

        <div className="ml-auto flex h-10 items-center gap-0.5 rounded-xl border border-[#e4e4e7] bg-white p-1">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            aria-label="Visão lista"
            className={"flex h-8 w-8 items-center justify-center rounded-lg text-base transition-colors " + (viewMode === "list" ? "bg-[#f1f0ed] text-[#0a0a0a]" : "text-[#a1a1aa] hover:text-[#0a0a0a]")}
          >☰</button>
          <button
            type="button"
            onClick={() => setViewMode("cards")}
            aria-label="Visão cards"
            className={"flex h-8 w-8 items-center justify-center rounded-lg text-base transition-colors " + (viewMode === "cards" ? "bg-[#f1f0ed] text-[#0a0a0a]" : "text-[#a1a1aa] hover:text-[#0a0a0a]")}
          >▦</button>
        </div>
      </div>

      {/* Cards de perfil */}
      {viewMode === "cards" && (
        <div className="mt-5">
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-[#71717a]">Nenhum candidato nesta etapa.</p>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visible.map((row, index) => {
              const isSelected = selected.has(row.id);
              const levelColors: Record<string, string> = {
                Operacional: "bg-[#f1f0ed] text-[#57534e]",
                Júnior: "bg-[#e4f6ec] text-[#1f7a4d]",
                Pleno: "bg-[#e8f0fe] text-[#1a56db]",
                Sênior: "bg-[#f5f3ff] text-[#6d28d9]",
                Liderança: "bg-[#fef9c3] text-[#854d0e]",
              };
              const levelClass = row.aiLevel ? (levelColors[row.aiLevel] ?? "bg-[#f1f0ed] text-[#57534e]") : "";
              return (
                <Fragment key={row.id}>
                {groupHeader(row, index, "col-span-full mt-2 border-b border-[#e4e4e7] pb-2 first:mt-0")}
                <div
                  className={"group relative flex flex-col rounded-2xl border bg-white transition-shadow hover:shadow-md " + (isSelected ? "border-[#0a0a0a]" : "border-[#e4e4e7]")}
                >
                  {aiRanks?.get(row.id) !== undefined && (
                    <span
                      className={"absolute left-2.5 top-2.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold " + ((aiRanks.get(row.id) as number) <= 3 ? "text-white" : "bg-[#f1f0ed] text-[#71717a]")}
                      style={(aiRanks.get(row.id) as number) <= 3 ? { backgroundColor: "var(--brand-primary)" } : undefined}
                      title="Posição pela indicação da IA nesta vaga"
                    >
                      {aiRanks.get(row.id)}º
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => toggle(row.id)}
                    aria-label={`Selecionar ${row.name}`}
                    className={"absolute right-2.5 top-2.5 flex size-5 items-center justify-center rounded-full border-2 transition-colors " + (isSelected ? "border-[#0a0a0a] bg-[#0a0a0a]" : "border-[#d4d4d8] bg-white")}
                  >
                    {isSelected && <span className="text-[10px] text-white">✓</span>}
                  </button>

                  <Link href={`/candidaturas/${row.id}`} className="flex flex-col items-center px-4 pb-4 pt-5 focus-visible:outline-none">
                    <CandidateAvatar
                      name={row.name}
                      photoUrl={row.photoUrl}
                      className="size-16 shrink-0 rounded-full bg-[#1c1917] text-lg font-bold text-white flex items-center justify-center object-cover"
                    />
                    <p className="mt-3 line-clamp-2 text-center text-[13px] font-semibold text-[#0a0a0a] leading-snug">{row.name}</p>
                    {row.age != null && (
                      <p
                        className="mt-0.5 text-center text-[10px] text-[#a1a1aa] opacity-0 transition-opacity group-hover:opacity-100"
                        title="Só para sua conferência: não entra na nota nem vai para a IA"
                      >
                        {row.age} anos
                      </p>
                    )}
                    {row.aiArea && (
                      <p className="mt-0.5 text-center text-[11px] text-[#71717a] line-clamp-1">{row.aiArea}</p>
                    )}
                    {row.aiProfile && (
                      <p className="mt-0.5 text-center text-[12px] text-[#3f3f46] font-medium line-clamp-1">{row.aiProfile}</p>
                    )}
                    {row.aiLevel && (
                      <span className={"mt-2 rounded-full px-2.5 py-0.5 text-[10px] font-semibold " + levelClass}>{row.aiLevel}</span>
                    )}
                    {row.infoState && (
                      <span
                        className={"mt-2 rounded-full px-2.5 py-0.5 text-[10px] font-semibold " + (row.infoState === "ANSWERED" ? "bg-[#e4f6ec] text-[#1f7a4d]" : "bg-[#fff7e6] text-[#a16207]")}
                      >
                        {row.infoState === "ANSWERED" ? "Respondeu a pré-entrevista" : "Aguardando informações"}
                      </span>
                    )}
                    {!row.aiArea && !row.aiProfile && !row.aiLevel && (
                      <p className="mt-2 text-[11px] text-[#a1a1aa]">{row.aiState === "DONE" ? "Sem perfil identificado" : row.aiState === "FAILED" ? "Análise falhou" : "Analisando…"}</p>
                    )}
                  </Link>

                  <div className="border-t border-[#f1f0ed] px-4 py-2.5 flex items-center justify-between">
                    <span className="text-[11px] text-[#71717a] truncate">{jobLabel(row.jobTitle, row.jobCode)}</span>
                    {row.aiScore !== null && (
                      <span className={"ml-2 shrink-0 text-[11px] font-semibold " + (row.aiScore >= row.aiMinScore ? "text-[#1f7a4d]" : "text-[#a1a1aa]")}>{row.aiScore}</span>
                    )}
                  </div>
                </div>
                </Fragment>
              );
            })}
          </div>
          {filtered.length > visible.length && (
            <button
              type="button"
              onClick={() => setLimit((l) => l + PAGE)}
              className="mt-4 w-full rounded-xl border border-[#e4e4e7] bg-white py-3 text-[13px] font-medium text-[#71717a] hover:bg-[#fafaf9] hover:text-[#0a0a0a]"
            >
              Mostrar mais ({filtered.length - visible.length} restantes)
            </button>
          )}
        </div>
      )}

      {/* Lista */}
      {viewMode === "list" && (
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

        {visible.map((row, index) => {
          const isSelected = selected.has(row.id);
          const waiting = row.status === "PENDING";
          return (
            <Fragment key={row.id}>
            {groupHeader(row, index, "border-b border-[#e4e4e7] bg-[#fafaf9] px-5 py-2.5")}
            <div
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
                <CandidateAvatar
                  name={row.name}
                  photoUrl={row.photoUrl}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1c1917] text-[10px] font-bold text-white"
                />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-[#0a0a0a]">
                    {aiRanks?.get(row.id) !== undefined && (
                      <span
                        className={"mr-1.5 rounded-full px-1.5 py-0.5 align-middle text-[10px] font-bold " + ((aiRanks.get(row.id) as number) <= 3 ? "text-white" : "bg-[#f1f0ed] text-[#71717a]")}
                        style={(aiRanks.get(row.id) as number) <= 3 ? { backgroundColor: "var(--brand-primary)" } : undefined}
                        title="Posição pela indicação da IA nesta vaga"
                      >
                        {aiRanks.get(row.id)}º
                      </span>
                    )}
                    {row.name}
                    {row.preRegistered && (
                      <span className="ml-1.5 rounded-full bg-[#fff7e6] px-1.5 py-0.5 align-middle text-[10px] font-medium text-[#a16207]">
                        Cadastro incompleto
                      </span>
                    )}
                    {row.infoState && (
                      <span
                        className={"ml-1.5 rounded-full px-1.5 py-0.5 align-middle text-[10px] font-medium " + (row.infoState === "ANSWERED" ? "bg-[#e4f6ec] text-[#1f7a4d]" : "bg-[#fff7e6] text-[#a16207]")}
                      >
                        {row.infoState === "ANSWERED" ? "Respondeu" : "Aguardando informações"}
                      </span>
                    )}
                    {row.isDemo && (
                      <span className="ml-1.5 rounded-full bg-[#f5f3ff] px-1.5 py-0.5 align-middle text-[10px] font-medium text-[#6d28d9]">
                        Demonstração
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[11px] text-[#a1a1aa]">
                    {jobLabel(row.jobTitle, row.jobCode)}
                    {row.age != null && <span title="Só para sua conferência: não entra na nota nem vai para a IA">{" · "}{row.age} anos</span>}
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
            </Fragment>
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
      )}

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
          <button
            type="button"
            disabled={pending || photoBusy}
            onClick={() => extractPhotos([...selected])}
            className="h-[34px] shrink-0 rounded-[10px] bg-white/12 px-4 text-xs font-medium text-white hover:bg-white/20 disabled:opacity-50"
          >
            {photoBusy ? "Extraindo…" : "Extrair fotos"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setMessageOpen(true)}
            className="h-[34px] shrink-0 rounded-[10px] bg-white px-4 text-xs font-semibold text-[#1c1917] hover:bg-white/90 disabled:opacity-50"
          >
            Enviar mensagem
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
            disabled={pending || reportLoading}
            onClick={generateReport}
            className="h-[34px] shrink-0 rounded-[10px] bg-white/12 px-4 text-xs font-medium text-white hover:bg-white/20 disabled:opacity-50"
          >
            {reportLoading ? "Gerando…" : "Relatório p/ direção"}
          </button>
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

      {messageOpen && selected.size > 0 && (() => {
        const chosen = rows.filter((r) => selected.has(r.id));
        const first = chosen[0];
        return (
          <BulkMessageDialog
            ids={[...selected]}
            names={chosen.slice(0, 3).map((r) => r.name)}
            sample={first ? { firstName: first.name.split(" ")[0] ?? "", jobTitle: first.jobTitle } : null}
            companyName={companyName}
            templates={messageTemplates}
            onClose={() => setMessageOpen(false)}
            onDone={() => setSelected(new Set())}
          />
        );
      })()}

      {/* Modal do relatório gerencial */}
      {report && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-6"
          role="dialog"
          aria-modal="true"
          onClick={() => setReport(null)}
        >
          <div
            className="my-8 w-full max-w-[640px] rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#e4e4e7] px-6 py-4">
              <h2 className="text-base font-semibold text-[#0a0a0a]">
                Relatório para a diretoria ({report.length})
              </h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={copyReportText}
                  className="text-xs font-medium text-[#71717a] hover:text-[#0a0a0a]"
                >
                  Copiar texto
                </button>
                <button
                  type="button"
                  onClick={() => setReport(null)}
                  aria-label="Fechar"
                  className="text-sm text-[#a1a1aa] hover:text-[#0a0a0a]"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="divide-y divide-[#e4e4e7]">
              {report.map((r) => (
                <div key={r.applicationId} className="px-6 py-5">
                  <p className="text-[13px] font-semibold text-[#0a0a0a]">
                    {r.name}
                    <span className="ml-2 font-normal text-[#71717a]">{r.jobTitle}</span>
                  </p>
                  {r.error && (
                    <p className="mt-1 text-xs text-[#c23b3b]">{r.error}</p>
                  )}
                  {r.resumo && (
                    <p className="mt-2 text-sm leading-relaxed text-[#3f3f46]">{r.resumo}</p>
                  )}
                  {r.pontos_fortes.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.6px] text-[#a1a1aa]">
                        Pontos fortes
                      </p>
                      <ul className="mt-1.5 space-y-1">
                        {r.pontos_fortes.map((p, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-[#3f3f46]">
                            <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#22c55e]" />
                            {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {r.justificativa && (
                    <div className="mt-3 rounded-xl bg-[#f7f7f6] px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.6px] text-[#a1a1aa]">
                        Por que vale a pena entrevistar
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-[#3f3f46]">
                        {r.justificativa}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  );
}
