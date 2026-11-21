"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Building2, ChevronDown, ChevronUp, Download, ExternalLink, MapPin } from "lucide-react";

import { AiScoreChip } from "@/components/gestor/ai-score-chip";
import { BulkMessageDialog } from "@/components/gestor/bulk-message-dialog";
import { CompanyDossierModal } from "@/components/gestor/company-dossier-modal";
import { ScoreRulerTrigger } from "@/components/gestor/score-ruler-legend";
import { LiveRefresh } from "@/components/gestor/live-refresh";
import { Toast } from "@/components/gestor/toast";
import {
  bulkSetApplicationStatusAction,
  deleteApplicationsAction,
  extractPhotosBulkAction,
  reanalyzeBatchAction,
  searchCandidatesAction,
  generateCandidatesReportAction,
  getCompanyReportAction,
  type CandidateSummary,
  type CompanyCandidateDossierItem,
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
import { ResumeLightboxButton } from "@/components/gestor/resume-lightbox-button";
import { getJobAccentTheme, parseJobTitleAndCity } from "@/server/models/job.model";

export type { CandidaturaRow };

/** Etapas do funil como abas — a organização segue o processo, não a tabela. */
const TABS: { key: StageKey; label: string }[] = [
  { key: "PENDING", label: "Triagem" },
  { key: "SHORTLISTED", label: "Em análise" },
  { key: "INTERVIEW", label: "Entrevista" },
  { key: "STANDBY", label: "Stand-by" },
  { key: "APPROVED", label: "Aprovados" },
  { key: "REJECTED", label: "Banco de dados" },
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
  STANDBY: "bg-[#e6f4f1] text-[#0e7a6b]",
  APPROVED: "bg-[#e4f6ec] text-[#1f7a4d]",
  REJECTED: "bg-[#fbeae8] text-[#c23b3b]",
};

/** Ações em massa por etapa — só o que faz sentido de onde o gestor está. */
const BULK_BY_TAB: Record<StageKey, AppStatusKey[]> = {
  PENDING: ["SHORTLISTED", "INTERVIEW", "STANDBY", "REJECTED"],
  SHORTLISTED: ["INTERVIEW", "STANDBY", "REJECTED", "PENDING"],
  INTERVIEW: ["APPROVED", "STANDBY", "REJECTED"],
  STANDBY: ["SHORTLISTED", "INTERVIEW", "APPROVED", "REJECTED", "PENDING"],
  APPROVED: ["INTERVIEW", "STANDBY"],
  REJECTED: ["PENDING", "STANDBY"],
  ALL: ["SHORTLISTED", "INTERVIEW", "STANDBY", "APPROVED", "REJECTED"],
};

const BULK_LABELS: Record<AppStatusKey, string> = {
  PENDING: "Voltar p/ triagem",
  SHORTLISTED: "Em análise",
  INTERVIEW: "Chamar p/ entrevista",
  STANDBY: "Colocar em stand-by",
  APPROVED: "Aprovar",
  REJECTED: "Banco de dados",
};

const PAGE = 40;

function compactDuration(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/\s*anos?\s*e\s*/gi, "a ")
    .replace(/\s*anos?\b/gi, "a")
    .replace(/\s*m[eê]s(es)?\b/gi, "m")
    .trim();
}

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
  hasOpenJobs = true,
}: {
  rows: CandidaturaRow[];
  jobs: { id: string; title: string; code?: string | null }[];
  initialJobId?: string;
  initialStatus?: AppStatusKey;
  initialOnlyMeets?: boolean;
  /** Recados salvos da empresa, para o envio em massa. */
  messageTemplates?: { id: string; subject: string; body: string }[];
  companyName?: string;
  /** Se a empresa tem vagas abertas — muda a apresentação dos pendentes. */
  hasOpenJobs?: boolean;
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
  const [moreOpen, setMoreOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"list" | "cards">("cards");
  const [onlyPhoto, setOnlyPhoto] = useState(false);
  const [onlyWithoutPhoto, setOnlyWithoutPhoto] = useState(false);
  const [contentMatches, setContentMatches] = useState<Set<string> | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoProgress, setPhotoProgress] = useState<{
    scanned: number;
    found: number;
    remaining: number;
  } | null>(null);
  const stopPhotoScanRef = useRef(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [messageOpen, setMessageOpen] = useState(false);
  const [confirm, setConfirm] = useState<AppStatusKey | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [report, setReport] = useState<CandidateSummary[] | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [companyDossierOpen, setCompanyDossierOpen] = useState(false);
  const [companyDossierData, setCompanyDossierData] = useState<{
    companyName: string;
    jobTitle?: string;
    candidates: CompanyCandidateDossierItem[];
  } | null>(null);
  const [companyDossierLoading, setCompanyDossierLoading] = useState(false);
  const [quickPeekRow, setQuickPeekRow] = useState<CandidaturaRow | null>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
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

  const missingPhotoCount = useMemo(
    () => rows.filter((r) => !r.photoUrl).length,
    [rows]
  );

  async function extractPhotos(ids?: string[]) {
    if (photoBusy) return;
    stopPhotoScanRef.current = false;
    setPhotoBusy(true);
    setPhotoProgress({
      scanned: 0,
      found: 0,
      remaining: ids ? ids.length : missingPhotoCount,
    });

    try {
      if (ids && ids.length > 0) {
        let totalProcessed = 0;
        let totalFound = 0;
        for (let i = 0; i < ids.length; i += 8) {
          if (stopPhotoScanRef.current) break;
          const chunk = ids.slice(i, i + 8);
          const r = await extractPhotosBulkAction({ ids: chunk, limit: 8 });
          totalProcessed += r.processed;
          totalFound += r.found;
          setPhotoProgress({
            scanned: totalProcessed,
            found: totalFound,
            remaining: Math.max(0, ids.length - totalProcessed),
          });
          if (r.found > 0) router.refresh();
        }
        router.refresh();
        setToast(
          totalProcessed === 0
            ? "Nenhum currículo pendente de foto."
            : `${totalFound} foto(s) extraída(s) após verificar ${totalProcessed} currículo(s).`
        );
        return;
      }

      const checkedIds = new Set<string>();
      let totalScanned = 0;
      let totalFound = 0;

      while (!stopPhotoScanRef.current) {
        const r = await extractPhotosBulkAction({
          excludeIds: Array.from(checkedIds),
          limit: 8,
        });
        if (r.processed === 0) break;
        for (const id of r.processedIds) checkedIds.add(id);
        totalScanned += r.processed;
        totalFound += r.found;
        setPhotoProgress({
          scanned: totalScanned,
          found: totalFound,
          remaining: r.remaining,
        });
        if (r.found > 0) router.refresh();
        if (r.remaining === 0) break;
      }

      router.refresh();
      if (totalScanned === 0) {
        setToast("Todos os currículos com foto disponível já foram verificados.");
      } else if (stopPhotoScanRef.current) {
        setToast(
          `Busca pausada: ${totalFound} foto(s) extraída(s) em ${totalScanned} currículo(s) verificados.`
        );
      } else {
        setToast(
          `Varredura concluída: ${totalFound} foto(s) extraída(s) após analisar ${totalScanned} currículo(s) sem foto.`
        );
      }
    } catch {
      setToast("Não foi possível extrair as fotos agora.");
    } finally {
      setPhotoBusy(false);
      setPhotoProgress(null);
    }
  }

  async function reanalyzeBatch(ids?: string[]) {
    setAiBusy(true);
    try {
      const r = await reanalyzeBatchAction({
        applicationIds: ids,
        jobId: !ids && jobId ? jobId : undefined,
      });
      setToast(
        r.queued === 0
          ? "Todos os candidatos com currículo já foram avaliados."
          : `Avaliação iniciada para ${r.queued} candidato(s) em segundo plano.`
      );
      if (ids) setSelected(new Set());
    } catch {
      setToast("Não foi possível iniciar a avaliação em lote agora.");
    } finally {
      setAiBusy(false);
    }
  }

  /** Tudo menos a aba — é a base das contagens de cada aba (scent honesto). */
  const scoped = useMemo(
    () =>
      applyFilters(rows, {
        search,
        jobId,
        onlyMeets,
        onlyPhoto,
        onlyWithoutPhoto,
        contentMatches,
      }),
    [rows, search, jobId, onlyMeets, onlyPhoto, onlyWithoutPhoto, contentMatches]
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

  const [collapsedJobIds, setCollapsedJobIds] = useState<Set<string>>(new Set());
  function toggleCollapseJob(targetJobId: string) {
    setCollapsedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(targetJobId)) next.delete(targetJobId);
      else next.add(targetJobId);
      return next;
    });
  }

  const jobThemeMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getJobAccentTheme>>();
    let idx = 0;
    for (const r of ordered) {
      if (!map.has(r.jobId)) {
        map.set(r.jobId, getJobAccentTheme(r.jobId || idx));
        idx++;
      }
    }
    return map;
  }, [ordered]);

  const jobSections = useMemo(() => {
    if (!showGroups) {
      return [{ jobId: jobId ?? "single", jobTitle: "", jobCode: null, rows: visible }];
    }
    const map = new Map<string, { jobId: string; jobTitle: string; jobCode?: string | null; rows: CandidaturaRow[] }>();
    const list: { jobId: string; jobTitle: string; jobCode?: string | null; rows: CandidaturaRow[] }[] = [];
    for (const r of visible) {
      let group = map.get(r.jobId);
      if (!group) {
        group = { jobId: r.jobId, jobTitle: r.jobTitle, jobCode: r.jobCode, rows: [] };
        map.set(r.jobId, group);
        list.push(group);
      }
      group.rows.push(r);
    }
    return list;
  }, [visible, showGroups, jobId]);

  /** Cabeçalho da vaga com cor e identificação de praça/cidade na visão de tabela. */
  function groupHeader(row: CandidaturaRow, index: number, mode: "cards" | "list") {
    if (!showGroups || (index > 0 && visible[index - 1].jobId === row.jobId)) return null;
    const theme = jobThemeMap.get(row.jobId) ?? {
      bar: "bg-zinc-700",
      code: "bg-zinc-800 text-white",
      cityTag: "border-zinc-300 bg-white text-zinc-800",
      sectionBorder: "border-zinc-200",
      sectionBg: "bg-zinc-50/50",
      countBadge: "border-zinc-200 bg-white text-zinc-700",
    };
    const { role, city } = parseJobTitleAndCity(row.jobTitle);
    const count = jobCounts[row.jobId] ?? 0;

    return (
      <div className={`flex flex-wrap items-center justify-between gap-2 border-y border-zinc-200/80 px-4 py-2.5 ${theme.sectionBg} mt-4 first:mt-0`}>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className={`h-4.5 w-1.5 shrink-0 rounded-full ${theme.bar}`} aria-hidden />
          {row.jobCode != null && (
            <span className={`rounded-lg px-2 py-0.5 text-[11px] font-bold tabular-nums shadow-2xs ${theme.code}`}>
              #{row.jobCode}
            </span>
          )}
          <span className="text-[13px] font-bold text-[#0a0a0a]">
            {role}
          </span>
          {city && (
            <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide shadow-2xs ${theme.cityTag}`}>
              <MapPin className="size-3 shrink-0 opacity-75" />
              {city}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tabular-nums shadow-2xs ${theme.countBadge}`}>
            {count} {count === 1 ? "candidato" : "candidatos"}
          </span>
          <button
            type="button"
            onClick={() => setJobId(row.jobId)}
            className="rounded-lg border border-zinc-200/80 bg-white px-2 py-0.5 text-[11px] font-medium text-[#52525b] shadow-2xs transition hover:bg-zinc-50 hover:text-[#0a0a0a]"
            title="Filtrar tela apenas para esta vaga"
          >
            Filtrar vaga →
          </button>
          <Link
            href={`/vagas/${row.jobId}`}
            className="rounded-lg border border-zinc-200/80 bg-white p-1 text-[11px] font-medium text-[#52525b] shadow-2xs transition hover:bg-zinc-50 hover:text-[#0a0a0a]"
            title="Abrir funil desta vaga"
          >
            <ExternalLink className="size-3" />
          </Link>
        </div>
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
    // Voltar para a triagem e "em análise" não avisam o candidato por e-mail: sem confirmação.
    if (newStatus === "PENDING" || newStatus === "SHORTLISTED") return runBulk(newStatus);
    setConfirm(newStatus);
  }

  /** Quem está na triagem e já atingiu a nota mínima da própria vaga (respeita os filtros da tela). */
  const readyToPass = filtered.filter((r) => r.status === "PENDING" && !r.hasImpediment && meetsMinimum(r));

  function passAllMeetingMinimum() {
    if (!window.confirm(`Passar ${readyToPass.length} candidato${readyToPass.length === 1 ? "" : "s"} que atingiram a nota mínima para "Em análise"?`)) return;
    runBulk("SHORTLISTED", readyToPass.map((r) => r.id));
  }

  function runBulk(newStatus: AppStatusKey, only?: string[]) {
    const rawIds = only ?? [...selected];
    const blocked = rawIds.filter((id) => rows.find((r) => r.id === id)?.hasImpediment);
    const ids =
      newStatus === "INTERVIEW" || newStatus === "APPROVED"
        ? rawIds.filter((id) => !rows.find((r) => r.id === id)?.hasImpediment)
        : rawIds;

    if (ids.length === 0 && blocked.length > 0) {
      setToast("Candidato(s) possuem impedimento de contratação (Tarja Preta) e não podem avançar para Entrevista ou Aprovação.");
      setConfirm(null);
      return;
    }

    setConfirm(null);
    startTransition(async () => {
      // A ação aceita até 100 por chamada: manda em lotes para não deixar ninguém de fora.
      let updated = 0;
      for (let i = 0; i < ids.length; i += 100) {
        updated += (await bulkSetApplicationStatusAction(ids.slice(i, i + 100), newStatus)).updated;
      }
      const blockedMsg =
        blocked.length > 0 && (newStatus === "INTERVIEW" || newStatus === "APPROVED")
          ? ` (${blocked.length} bloqueado${blocked.length === 1 ? "" : "s"} por Tarja Preta)`
          : "";
      setToast(
        `${updated} candidato${updated === 1 ? "" : "s"} movido${updated === 1 ? "" : "s"} para "${appStatusLabels[newStatus]}"${blockedMsg}.`
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

  async function openCompanyDossier() {
    if (selected.size === 0) return;
    setCompanyDossierLoading(true);
    const res = await getCompanyReportAction([...selected]);
    setCompanyDossierLoading(false);
    if (res.ok) {
      setCompanyDossierData({
        companyName: res.companyName,
        jobTitle: res.jobTitle,
        candidates: res.candidates,
      });
      setCompanyDossierOpen(true);
    } else {
      setToast(res.error || "Falha ao gerar dossiê para empresa.");
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
    const header = "Nome;CPF;RG;Telefone;E-mail;Vaga;Score IA;Status;Data\n";
    const body = rowsToExport
      .map((r) =>
        [
          r.name,
          r.cpf ? r.cpf.replace(/\*/g, "") : "",
          r.rg ? r.rg.replace(/\*/g, "") : "",
          r.phone ?? "",
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

  const anyAnalyzing =
    aiBusy ||
    rows.some(
      (r) =>
        r.aiState === "WAITING" ||
        r.aiState === "PROCESSING" ||
        r.aiState === "FAILED"
    );
  const unevaluatedCount = useMemo(
    () =>
      scoped.filter(
        (r) =>
          !r.hasImpediment &&
          (r.aiScore === null || r.aiState === "FAILED" || r.aiState === "WAITING") &&
          r.aiState !== "NO_RESUME"
      ).length,
    [scoped]
  );
  const cols =
    "grid-cols-[28px_minmax(0,1fr)_auto] md:grid-cols-[36px_minmax(180px,2fr)_150px_minmax(120px,1fr)_164px_64px]";

  function downloadSelectedResumes() {
    const ids = [...selected];
    ids.forEach((appId, idx) => {
      setTimeout(() => {
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.src = `/candidaturas/${appId}/cv?download=1`;
        document.body.appendChild(iframe);
        setTimeout(() => iframe.remove(), 30_000);
      }, idx * 450);
    });
    setToast(`Iniciando download de ${ids.length} currículo${ids.length === 1 ? "" : "s"} em PDF…`);
  }

  if (!hasOpenJobs) {
    return (
      <>
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#0a0a0a]">Candidatos</h1>
          <p className="mt-1 text-sm text-[#71717a]">Nenhuma vaga aberta no momento</p>
        </div>
        <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-[#e4e4e7] bg-white px-6 py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-[#f5f3ff]">
            <svg className="size-6 text-[#71717a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </div>
          <p className="mt-4 text-sm font-medium text-[#0a0a0a]">Nenhuma vaga aberta</p>
          <p className="mx-auto mt-1.5 max-w-sm text-[13px] text-[#71717a]">
            Publique uma vaga para receber candidaturas. Enquanto isso, os talentos cadastrados ficam no{" "}
            <Link href="/talentos" className="font-medium underline" style={{ color: "var(--brand-primary)" }}>
              Banco de talentos
            </Link>.
          </p>
          <Link
            href="/vagas/nova"
            className="mt-5 flex h-9 items-center rounded-xl px-4 text-[13px] font-semibold text-white"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            + Nova vaga
          </Link>
        </div>
      </>
    );
  }

  function renderCandidateCard(row: CandidaturaRow) {
    const isSelected = selected.has(row.id);
    const rank = aiRanks?.get(row.id);
    const subtitleParts = [
      row.aiProfile || row.aiArea,
      row.aiLevel,
      row.age != null ? `${row.age}a` : null,
    ].filter(Boolean);
    const subtitleLine =
      subtitleParts.length > 0
        ? subtitleParts.join(" · ")
        : row.aiState === "DONE"
          ? "Sem perfil identificado"
          : row.aiState === "FAILED"
            ? "Análise pendente"
            : "Analisando…";

    const shortAvg = compactDuration(row.tenureAvg || row.tenureMedian);
    const firstCompany = row.tenureCompanies?.[0]?.empresa ?? null;
    const extraCompanies =
      row.tenureCompanies && row.tenureCompanies.length > 1
        ? ` +${row.tenureCompanies.length - 1}`
        : "";
    const stabilityDot =
      row.tenureStability === "ALTA"
        ? "bg-emerald-500"
        : row.tenureStability === "BAIXA"
          ? "bg-rose-500"
          : "bg-sky-500";

    return (
      <div
        key={row.id}
        onClick={() => router.push(`/candidaturas/${row.id}`)}
        className={
          "group relative cursor-pointer rounded-2xl border bg-white p-3.5 transition-all hover:border-[#d4d4d8] hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] " +
          (isSelected
            ? "border-[#0a0a0a] ring-1 ring-[#0a0a0a]/10"
            : "border-[#e4e4e7]")
        }
      >
        <div className="flex items-start gap-3">
          {/* Avatar + Checkbox discreto no hover */}
          <div className="relative shrink-0">
            <CandidateAvatar
              name={row.name}
              photoUrl={row.photoUrl}
              className="flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold object-cover"
            />
            {rank !== undefined && !isSelected && (
              <span
                className={
                  "absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold shadow-2xs " +
                  (rank <= 3 ? "text-white" : "bg-[#f1f0ed] text-[#57534e]")
                }
                style={rank <= 3 ? { backgroundColor: "var(--brand-primary)" } : undefined}
                title="Posição pela indicação da IA nesta vaga"
              >
                {rank}º
              </span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggle(row.id);
              }}
              aria-label={`Selecionar ${row.name}`}
              className={
                "absolute -left-1 -top-1 flex size-4.5 items-center justify-center rounded-full border transition-all " +
                (isSelected
                  ? "border-[#0a0a0a] bg-[#0a0a0a] text-white opacity-100"
                  : "border-[#d4d4d8] bg-white text-transparent opacity-0 group-hover:opacity-100 hover:border-[#0a0a0a]")
              }
            >
              <span className="text-[9px] leading-none">✓</span>
            </button>
          </div>

          {/* 3 Linhas Limpas (Nome + Score / Cargo · Nível · Idade / Permanência + Ações no hover) */}
          <div className="min-w-0 flex-1">
            {/* Linha 1: Nome completo + Nota em pílula discreta */}
            <div className="flex items-center justify-between gap-2">
              <Link
                href={`/candidaturas/${row.id}`}
                onClick={(e) => e.stopPropagation()}
                className="truncate text-[13px] font-semibold text-[#0a0a0a] transition-colors group-hover:text-[#7c1d3c] hover:underline"
              >
                {row.name}
              </Link>

              {row.hasImpediment ? (
                <span
                  className="shrink-0 inline-flex items-center gap-1 rounded-full border border-zinc-200/80 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-600"
                  title={row.impedimentReason ? `Motivo: ${row.impedimentReason}` : "Impedimento de contratação ativo"}
                >
                  <span className="size-1.5 rounded-full bg-rose-500/80" />
                  <span>Tarja preta</span>
                </span>
              ) : row.aiScore !== null ? (
                <span
                  className={
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums " +
                    (row.aiScore >= row.aiMinScore
                      ? "bg-emerald-50 text-emerald-700"
                      : row.aiScore >= 60
                        ? "bg-amber-50 text-amber-700"
                        : "bg-zinc-100 text-zinc-600")
                  }
                >
                  {row.aiScore}
                </span>
              ) : null}
            </div>

            {/* Linha 2: Perfil · Senioridade · Idade */}
            <p className="mt-0.5 truncate text-[11px] text-[#71717a]">
              {subtitleLine}
            </p>

            {/* Linha 3: 1 linha única de permanência/empresa + ações discretas no hover */}
            <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-[#71717a]">
              <span
                className="inline-flex min-w-0 items-center gap-1.5 truncate"
                title={
                  row.tenureAvg || row.tenureMedian
                    ? `Média: ${row.tenureAvg || "-"} · Mediana: ${row.tenureMedian || row.tenureAvg || "-"}${
                        row.tenureCompanies?.length
                          ? "\n" +
                            row.tenureCompanies
                              .map((c) => `• ${c.empresa}: ${c.duracaoFormatada}`)
                              .join("\n")
                          : ""
                      }`
                    : undefined
                }
              >
                {row.hasImpediment ? (
                  <span className="truncate text-rose-600">
                    {row.impedimentReason || "Restrição em todas as vagas"}
                  </span>
                ) : shortAvg ? (
                  <>
                    <span className={`size-1.5 shrink-0 rounded-full ${stabilityDot}`} />
                    <span className="truncate">
                      {shortAvg} média
                      {firstCompany ? ` · ${firstCompany}${extraCompanies}` : ""}
                    </span>
                  </>
                ) : !showGroups ? (
                  <span className="truncate text-[#a1a1aa]">
                    {jobLabel(row.jobTitle, row.jobCode)}
                  </span>
                ) : (
                  <span className="truncate text-[#a1a1aa]">
                    {row.status === "PENDING"
                      ? `espera ${formatWaiting(new Date(row.createdAt))}`
                      : appStatusLabels[row.status]}
                  </span>
                )}
              </span>

              <div
                className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <ResumeLightboxButton
                  applicationId={row.id}
                  candidateName={row.name}
                  label="CV"
                  showIcon={false}
                  className="rounded px-1.5 py-0.5 text-[11px] font-medium text-[#52525b] hover:bg-[#f4f4f5] hover:text-[#0a0a0a]"
                />
                <a
                  href={`/candidaturas/${row.id}/cv?download=1`}
                  className="inline-flex size-5 items-center justify-center rounded text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#0a0a0a]"
                  title="Baixar currículo em PDF"
                  aria-label="Baixar currículo em PDF"
                >
                  <Download className="size-3" strokeWidth={1.75} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <LiveRefresh active={anyAnalyzing} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#0a0a0a]">
            Candidatos
          </h1>
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
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/candidaturas/novo"
            className="flex h-9 items-center rounded-xl border border-[#e4e4e7] bg-white px-3.5 text-[12px] font-semibold text-[#0a0a0a] hover:bg-[#fafaf9]"
          >
            + Adicionar
          </Link>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreMenuOpen((o) => !o)}
              aria-label="Mais ações"
              aria-expanded={moreMenuOpen}
              className="flex h-9 items-center gap-1 rounded-xl border border-[#e4e4e7] bg-white px-3 text-[12px] font-semibold text-[#52525b] transition hover:bg-[#fafaf9] hover:text-[#0a0a0a]"
            >
              <span>⋯</span>
              {(photoBusy || aiBusy) && (
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
              )}
            </button>

            {moreMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-10 z-30 w-64 rounded-2xl border border-[#e4e4e7] bg-white p-1.5 shadow-xl"
              >
                <button
                  type="button"
                  disabled={photoBusy}
                  onClick={() => {
                    setMoreMenuOpen(false);
                    void extractPhotos();
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium text-[#0a0a0a] hover:bg-[#fafaf9] disabled:opacity-50"
                >
                  <span>
                    {photoBusy
                      ? "Buscando fotos…"
                      : "Buscar todas as fotos pendentes"}
                  </span>
                  {missingPhotoCount > 0 && (
                    <span className="rounded-full bg-[#f4f4f5] px-2 py-0.5 text-[10px] font-semibold text-[#52525b]">
                      {missingPhotoCount}
                    </span>
                  )}
                </button>

                {unevaluatedCount > 0 && (
                  <button
                    type="button"
                    disabled={aiBusy}
                    onClick={() => {
                      setMoreMenuOpen(false);
                      void reanalyzeBatch();
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium text-[#0a0a0a] hover:bg-[#fafaf9] disabled:opacity-50"
                  >
                    <span>{aiBusy ? "Avaliando pendentes…" : "Avaliar sem nota com IA"}</span>
                    <span className="rounded-full bg-[#f4f4f5] px-2 py-0.5 text-[10px] font-semibold text-[#52525b]">
                      {unevaluatedCount}
                    </span>
                  </button>
                )}

                <Link
                  href="/buscar-cvs"
                  onClick={() => setMoreMenuOpen(false)}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-[#0a0a0a] hover:bg-[#fafaf9]"
                >
                  <span>Buscar CVs (Base aberta)</span>
                  <span className="text-[#71717a]">↗</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    exportCsv();
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium text-[#0a0a0a] hover:bg-[#fafaf9]"
                >
                  <span>Exportar lista (CSV)</span>
                  <span className="text-[#71717a]">↓</span>
                </button>
              </div>
            )}
          </div>

          {nextCandidate && (
            <Link href={`/candidaturas/${nextCandidate.id}`} className="flex h-9 items-center rounded-xl px-4 text-[12px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90" style={{ backgroundColor: "var(--brand-primary)" }}>
              Triar agora →
            </Link>
          )}
        </div>
      </div>

      {photoBusy && photoProgress && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e4e4e7] bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="size-2.5 animate-pulse rounded-full bg-emerald-500" />
            <div>
              <p className="text-[13px] font-semibold text-[#0a0a0a]">
                Varrendo todos os currículos sem foto automaticamente…
              </p>
              <p className="text-[12px] text-[#71717a]">
                <strong>{photoProgress.scanned}</strong> currículo(s) verificado(s) ·{" "}
                <strong className="text-emerald-700">{photoProgress.found}</strong> foto(s) extraída(s) ·{" "}
                <strong>{photoProgress.remaining}</strong> restante(s) na fila
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopPhotoScanRef.current = true;
            }}
            className="h-8 rounded-xl border border-[#e4e4e7] bg-[#fafaf9] px-3 text-[12px] font-semibold text-[#0a0a0a] hover:bg-[#f4f4f5]"
          >
            Pausar varredura
          </button>
        </div>
      )}

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
                    : "bg-[#f1f0ed] text-[#71717a]")
                }
              >
                {counts[item.key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Controles secundários: 1 linha enxuta e minimalista */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex h-9 min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-[#e4e4e7] bg-white px-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <span className="text-xs text-[#71717a]" aria-hidden>
            ⌕
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar candidato ou palavra no CV…"
            aria-label="Buscar candidatos"
            className="w-full bg-transparent text-[12px] text-[#0a0a0a] placeholder:text-[#8b8b94] focus:outline-none"
          />
        </div>

        {jobs.length > 1 && (
          <select
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            aria-label="Filtrar por vaga"
            className="h-9 max-w-[190px] rounded-xl border border-[#e4e4e7] bg-white px-2.5 text-[12px] text-[#52525b] focus:border-[#0a0a0a] focus:outline-none"
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
          className="h-9 rounded-xl border border-[#e4e4e7] bg-white px-2.5 text-[12px] text-[#52525b] focus:border-[#0a0a0a] focus:outline-none"
        >
          {Object.entries(SORT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <ScoreRulerTrigger variant="pill" label="Régua de Notas" />
        <div className="relative">
          <button
            type="button"
            onClick={() => setSortInfoOpen((o) => !o)}
            aria-label="Entenda a diferença entre maior aderência e indicação da IA"
            aria-expanded={sortInfoOpen}
            className="flex size-6 items-center justify-center rounded-full border border-[#d4d4d8] bg-white text-[11px] font-semibold italic text-[#71717a] hover:border-[#0a0a0a] hover:text-[#0a0a0a]"
          >
            i
          </button>
          {sortInfoOpen && (
            <div
              role="dialog"
              className="absolute right-0 top-8 z-30 w-[320px] rounded-xl border border-[#e4e4e7] bg-white p-4 text-[12px] leading-5 text-[#44403c] shadow-lg"
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


        <button
          type="button"
          onClick={() => setOnlyMeets((v) => !v)}
          className={
            "flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[12px] font-medium transition-all " +
            (onlyMeets
              ? "border-[#0a0a0a] bg-[#0a0a0a] text-white"
              : "border-[#e4e4e7] bg-white text-[#52525b] hover:bg-[#fafaf9] hover:text-[#0a0a0a]")
          }
        >
          <span>✨</span>
          <span>Acima do corte</span>
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            aria-expanded={moreOpen}
            className={
              "flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[12px] font-medium transition-colors " +
              (moreOpen || onlyPhoto || onlyWithoutPhoto
                ? "border-[#0a0a0a] bg-white text-[#0a0a0a]"
                : "border-[#e4e4e7] bg-white text-[#52525b] hover:text-[#0a0a0a]")
            }
          >
            Mais opções
            {(onlyPhoto || onlyWithoutPhoto) && (
              <span className="rounded-full bg-[#0a0a0a] px-1.5 text-[10px] font-semibold text-white">1</span>
            )}
            <span aria-hidden className={`text-[10px] transition-transform ${moreOpen ? "rotate-180" : ""}`}>▾</span>
          </button>
          {moreOpen && (
            <div className="absolute left-0 top-11 z-30 w-[260px] space-y-3 rounded-xl border border-[#e4e4e7] bg-white p-3 shadow-lg">
              <label className="block space-y-1">
                <span className="text-[11px] font-semibold text-[#52525b]">Foto do candidato</span>
                <select
                  value={onlyPhoto ? "WITH" : onlyWithoutPhoto ? "WITHOUT" : "ALL"}
                  onChange={(e) => {
                    const v = e.target.value;
                    setOnlyPhoto(v === "WITH");
                    setOnlyWithoutPhoto(v === "WITHOUT");
                  }}
                  aria-label="Filtrar por foto"
                  className={
                    "h-9 w-full rounded-xl border px-3 text-[12px] font-medium focus:outline-none " +
                    (onlyPhoto || onlyWithoutPhoto
                      ? "border-[#0a0a0a] bg-[#0a0a0a] text-white"
                      : "border-[#e4e4e7] bg-white text-[#52525b]")
                  }
                >
                  <option value="ALL" className="bg-white text-[#0a0a0a]">Foto: Todos</option>
                  <option value="WITH" className="bg-white text-[#0a0a0a]">Com foto</option>
                  <option value="WITHOUT" className="bg-white text-[#0a0a0a]">Sem foto ({missingPhotoCount})</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] font-semibold text-[#52525b]">Selecionar em massa</span>
                <select
                  value=""
                  onChange={(e) => {
                    const mode = e.target.value;
                    if (mode === "NONE") setSelected(new Set());
                    else if (mode) setSelected(new Set(selectByCutoff(filtered, mode as CutoffSelection).map((r) => r.id)));
                  }}
                  aria-label="Selecionar candidatos em massa"
                  className="h-9 w-full rounded-xl border border-[#e4e4e7] bg-white px-2.5 text-[12px] text-[#52525b] focus:border-[#0a0a0a] focus:outline-none"
                >
                  <option value="">Selecionar…</option>
                  <option value="ALL">Todos ({selectByCutoff(filtered, "ALL").length})</option>
                  <option value="ABOVE">Acima do corte ({selectByCutoff(filtered, "ABOVE").length})</option>
                  <option value="BELOW">Abaixo do corte ({selectByCutoff(filtered, "BELOW").length})</option>
                  <option value="UNANALYZED">Sem análise ({selectByCutoff(filtered, "UNANALYZED").length})</option>
                  <option value="NONE">Limpar seleção</option>
                </select>
              </label>
            </div>
          )}
        </div>

        {/* Sempre à vista quando há foto pendente (o filtro de foto fica em "Mais opções"). */}
        {!onlyWithoutPhoto && missingPhotoCount > 0 && (
          <button
            type="button"
            disabled={photoBusy}
            onClick={() => void extractPhotos()}
            title="Busca a foto no currículo de quem ainda está sem foto"
            className="h-9 rounded-xl border border-[#e4e4e7] bg-white px-3 text-[12px] font-semibold text-[#0a0a0a] transition hover:bg-[#fafaf9] disabled:opacity-50"
          >
            {photoBusy ? "Extraindo fotos…" : `Extrair fotos (${missingPhotoCount})`}
          </button>
        )}

        {onlyWithoutPhoto && filtered.length > 0 && !photoBusy && (
          <button
            type="button"
            onClick={() => extractPhotos(filtered.map((r) => r.id))}
            className="h-9 rounded-xl border border-[#e4e4e7] bg-[#fafaf9] px-3 text-[12px] font-semibold text-[#0a0a0a] transition hover:bg-[#f4f4f5]"
          >
            Extrair fotos ({filtered.length})
          </button>
        )}

        {(tab === "PENDING" || tab === "ALL") && readyToPass.length > 0 && (
          <button
            type="button"
            disabled={pending}
            onClick={passAllMeetingMinimum}
            title="Move para 'Em análise' todos da triagem que atingiram a nota mínima da vaga"
            className="h-9 rounded-xl px-3.5 text-[12px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--brand-tint)", color: "var(--brand-primary)" }}
          >
            Aprovar {readyToPass.length} acima do corte
          </button>
        )}

        <div className="ml-auto flex h-9 items-center gap-0.5 rounded-xl border border-[#e4e4e7] bg-white p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            aria-label="Visão lista"
            className={"flex h-7 w-7 items-center justify-center rounded-lg text-sm transition-colors " + (viewMode === "list" ? "bg-[#f1f0ed] text-[#0a0a0a]" : "text-[#71717a] hover:text-[#0a0a0a]")}
          >☰</button>
          <button
            type="button"
            onClick={() => setViewMode("cards")}
            aria-label="Visão cards"
            className={"flex h-7 w-7 items-center justify-center rounded-lg text-sm transition-colors " + (viewMode === "cards" ? "bg-[#f1f0ed] text-[#0a0a0a]" : "text-[#71717a] hover:text-[#0a0a0a]")}
          >▦</button>
        </div>
      </div>

      {/* Cards de perfil — Agrupados com distinção cristalina por vaga */}
      {viewMode === "cards" && (
        <div className="mt-5">
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-[#71717a]">Nenhum candidato nesta etapa.</p>
          )}

          {showGroups ? (
            <div className="space-y-6">
              {jobSections.map((section) => {
                const theme = jobThemeMap.get(section.jobId) ?? {
                  bar: "bg-zinc-700",
                  code: "bg-zinc-800 text-white",
                  cityTag: "border-zinc-300 bg-white text-zinc-800",
                  sectionBorder: "border-zinc-200",
                  sectionBg: "bg-zinc-50/50",
                  countBadge: "border-zinc-200 bg-white text-zinc-700",
                };
                const { role, city } = parseJobTitleAndCity(section.jobTitle);
                const count = jobCounts[section.jobId] ?? section.rows.length;
                const isCollapsed = collapsedJobIds.has(section.jobId);

                return (
                  <section
                    key={section.jobId}
                    className={`rounded-3xl border ${theme.sectionBorder} ${theme.sectionBg} p-4 sm:p-5 transition-all shadow-2xs space-y-3.5`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                        <span className={`h-5 w-1.5 shrink-0 rounded-full ${theme.bar}`} aria-hidden />
                        {section.jobCode != null && (
                          <span className={`rounded-lg px-2.5 py-0.5 text-[11px] font-bold tabular-nums shadow-2xs ${theme.code}`}>
                            #{section.jobCode}
                          </span>
                        )}
                        <h3 className="text-[14px] font-bold text-zinc-900 tracking-tight">
                          {role}
                        </h3>
                        {city && (
                          <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide shadow-2xs ${theme.cityTag}`}>
                            <MapPin className="size-3 shrink-0 opacity-80" strokeWidth={2.5} />
                            {city}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tabular-nums shadow-2xs ${theme.countBadge}`}>
                          {count} {count === 1 ? "candidato" : "candidatos"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setJobId(section.jobId)}
                          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200/80 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 shadow-2xs transition hover:bg-zinc-50 hover:text-zinc-900"
                          title="Filtrar tela apenas para esta vaga"
                        >
                          Filtrar vaga →
                        </button>
                        <Link
                          href={`/vagas/${section.jobId}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200/80 bg-white p-1 text-[11px] font-medium text-zinc-700 shadow-2xs transition hover:bg-zinc-50 hover:text-zinc-900"
                          title="Abrir funil desta vaga"
                        >
                          <ExternalLink className="size-3 text-zinc-500" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => toggleCollapseJob(section.jobId)}
                          className="inline-flex size-7 items-center justify-center rounded-lg border border-zinc-200/80 bg-white text-zinc-600 shadow-2xs transition hover:bg-zinc-50 hover:text-zinc-900"
                          title={isCollapsed ? "Expandir candidatos desta vaga" : "Recolher candidatos desta vaga"}
                        >
                          {isCollapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
                        </button>
                      </div>
                    </div>

                    {!isCollapsed ? (
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {section.rows.map((row) => renderCandidateCard(row))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-zinc-200 bg-white/60 px-3 py-2 text-center text-[12px] text-zinc-500">
                        {section.rows.length} candidato{section.rows.length === 1 ? "" : "s"} nesta vaga (recolhida). Clique na seta para expandir.
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visible.map((row) => renderCandidateCard(row))}
            </div>
          )}
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
              className="text-[11px] font-medium tracking-[0.6px] text-[#71717a]"
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
            {groupHeader(row, index, "list")}
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
                    {row.hasImpediment && (
                      <span
                        className="ml-1.5 inline-flex items-center gap-1.5 rounded-full border border-zinc-200/80 bg-zinc-50 px-2 py-0.5 align-middle text-[10px] font-medium text-zinc-600"
                        title={row.impedimentReason ? `Motivo do impedimento: ${row.impedimentReason}` : "Impedimento de contratação ativo"}
                      >
                        <span className="size-1.5 rounded-full bg-rose-500/80" />
                        <span>Tarja preta</span>
                      </span>
                    )}
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
                  <span className="block truncate text-[11px] text-[#71717a]">
                    {jobLabel(row.jobTitle, row.jobCode)}
                    {row.age != null && <span title="Só para sua conferência: não entra na nota nem vai para a IA">{" · "}{row.age} anos</span>}
                    {(row.tenureAvg || row.tenureMedian) && (
                      <span
                        className={`ml-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-medium ${
                          row.tenureStability === "ALTA"
                            ? "bg-[#e4f6ec] text-[#1f7a4d]"
                            : row.tenureStability === "BAIXA"
                              ? "bg-[#fbeae8] text-[#c23b3b]"
                              : "bg-[#f4f4f5] text-[#52525b]"
                        }`}
                        title={`Permanência nas empresas:\nMédia: ${row.tenureAvg || "-"}\nMediana: ${row.tenureMedian || "-"}${
                          row.tenureCompanies?.length ? "\nHistórico:\n" + row.tenureCompanies.map(c => "• " + c.empresa + ": " + c.duracaoFormatada + " (" + c.periodo + ")").join("\n") : ""
                        }`}
                      >
                        {row.tenureStability === "BAIXA" ? "⚠ " : ""}
                        <span>Média {row.tenureAvg}</span>
                        {row.tenureMedian && (
                          <span className="text-[#71717a]">· Mediana {row.tenureMedian}</span>
                        )}
                        {row.tenureCompanies && row.tenureCompanies.length > 0 && (
                          <span className="text-[#71717a]">({row.tenureCompanies.length} emp.)</span>
                        )}
                      </span>
                    )}
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
              <div className="col-span-full flex items-center justify-end gap-1 md:col-span-1 md:justify-start">
                <ResumeLightboxButton
                  applicationId={row.id}
                  candidateName={row.name}
                  label="Ver CV"
                  showIcon={false}
                  className="inline-flex h-7 items-center justify-center rounded-lg px-2 text-[11px] font-medium text-[#71717a] transition hover:bg-[#f4f4f5] hover:text-[#0a0a0a]"
                />
                <a
                  href={`/candidaturas/${row.id}/cv?download=1`}
                  className="inline-flex size-7 items-center justify-center rounded-lg text-[#71717a] transition hover:bg-[#f4f4f5] hover:text-[#0a0a0a]"
                  title="Baixar currículo em PDF"
                  aria-label="Baixar currículo em PDF"
                >
                  <Download className="size-3.5" strokeWidth={1.75} />
                </a>
              </div>
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

      <div className="mt-4 flex flex-wrap items-center justify-end gap-x-5 gap-y-2">
        <button
          type="button"
          onClick={exportCsv}
          className="text-xs font-medium text-[#71717a] hover:text-[#0a0a0a]"
        >
          Exportar esta lista (CSV)
        </button>
        <a
          href="/api/export/cadastrados"
          download
          title="Planilha com todas as pessoas e candidaturas da empresa. O download fica registrado na auditoria."
          className="rounded-md border border-[#e4e4e7] bg-white px-3 py-1.5 text-xs font-medium text-[#0a0a0a] hover:bg-[#fafaf9]"
        >
          Baixar todos os cadastrados (Excel)
        </a>
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
            disabled={pending}
            onClick={downloadSelectedResumes}
            className="h-[34px] shrink-0 rounded-[10px] bg-white/12 px-4 text-xs font-semibold text-white hover:bg-white/20 disabled:opacity-50"
          >
            Baixar PDFs ({selected.size})
          </button>
          <button
            type="button"
            disabled={pending || aiBusy}
            onClick={() => reanalyzeBatch([...selected])}
            className="h-[34px] shrink-0 rounded-[10px] bg-white/12 px-4 text-xs font-medium text-white hover:bg-white/20 disabled:opacity-50"
          >
            {aiBusy ? "Avaliando…" : "Avaliar com IA"}
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
            disabled={pending || companyDossierLoading}
            onClick={openCompanyDossier}
            className="h-[34px] shrink-0 rounded-[10px] bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-500 shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
            title="Gerar resumo executivo dos candidatos com Nome, E-mail, Telefone, Fardamento e Resumo para enviar para a empresa"
          >
            <Building2 className="size-3.5" />
            <span>{companyDossierLoading ? "Carregando…" : `Resumo p/ Empresa (${selected.size})`}</span>
          </button>
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
          className="fixed inset-0 z-[200] flex items-center justify-center bg-[#fafaf9] p-6"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirm(null)}
        >
          <div
            className="w-full max-w-[400px] rounded-2xl border border-[#e4e4e7] bg-white p-6 shadow-sm"
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
                {confirm === "REJECTED" ? "Mover p/ Banco de dados" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exclusão definitiva — confirmação obrigatória */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-[#fafaf9] p-6"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmDelete(false)}
        >
          <div
            className="w-full max-w-[400px] rounded-2xl border border-[#e4e4e7] bg-white p-6 shadow-sm"
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
          className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-[#fafaf9] p-6"
          role="dialog"
          aria-modal="true"
          onClick={() => setReport(null)}
        >
          <div
            className="my-8 w-full max-w-[640px] rounded-2xl border border-[#e4e4e7] bg-white shadow-sm"
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
                  className="text-sm text-[#71717a] hover:text-[#0a0a0a]"
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
                      <p className="text-[11px] font-semibold uppercase tracking-[0.6px] text-[#71717a]">
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
                      <p className="text-[11px] font-semibold uppercase tracking-[0.6px] text-[#71717a]">
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

      {/* Dossiê Executivo para Envio à Empresa (Nome, E-mail, Telefone, Fardamento e Resumo) */}
      {companyDossierData && (
        <CompanyDossierModal
          open={companyDossierOpen}
          onClose={() => setCompanyDossierOpen(false)}
          companyName={companyDossierData.companyName}
          jobTitle={companyDossierData.jobTitle}
          candidates={companyDossierData.candidates}
        />
      )}

      {/* Gaveta Lateral de Triagem Rápida (Quick-Peek Slide-Over Drawer) */}
      {quickPeekRow && (
        <div
          className="fixed inset-0 z-[190] flex justify-end bg-black/35 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          onClick={() => setQuickPeekRow(null)}
        >
          <div
            className="flex h-full w-full max-w-[540px] flex-col border-l border-[#e4e4e7] bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header da Gaveta */}
            <div className="flex items-start justify-between gap-3 border-b border-[#e4e4e7] px-6 py-4">
              <div className="flex min-w-0 items-center gap-3.5">
                <CandidateAvatar
                  name={quickPeekRow.name}
                  photoUrl={quickPeekRow.photoUrl}
                  className="flex size-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold object-cover"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-base font-bold text-[#0a0a0a]">
                      {quickPeekRow.name}
                    </h2>
                    {quickPeekRow.age != null && (
                      <span className="text-xs text-[#71717a]">{quickPeekRow.age} anos</span>
                    )}
                    {quickPeekRow.hasImpediment && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                        <span className="size-1.5 rounded-full bg-rose-500" />
                        <span>Tarja preta</span>
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[#71717a]">
                    {[quickPeekRow.aiProfile, quickPeekRow.aiArea, quickPeekRow.aiLevel]
                      .filter(Boolean)
                      .join(" · ") || jobLabel(quickPeekRow.jobTitle, quickPeekRow.jobCode)}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {quickPeekRow.aiScore !== null && (
                  <div className="rounded-xl border border-[#e4e4e7] bg-[#fafaf9] px-3 py-1 text-center">
                    <span
                      className={
                        "block text-sm font-extrabold " +
                        (quickPeekRow.aiScore >= quickPeekRow.aiMinScore
                          ? "text-[#1f7a4d]"
                          : "text-[#71717a]")
                      }
                    >
                      {quickPeekRow.aiScore}%
                    </span>
                    <span className="block text-[9px] font-semibold uppercase tracking-wider text-[#71717a]">
                      Match
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setQuickPeekRow(null)}
                  aria-label="Fechar visualização rápida"
                  className="flex size-8 items-center justify-center rounded-lg text-sm text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#0a0a0a]"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Bento Resumo + Visualizador de Currículo em PDF */}
            <div className="flex flex-1 flex-col overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-3 gap-2.5 rounded-2xl border border-[#e4e4e7] bg-[#fafaf9] p-3.5 text-xs">
                <div>
                  <span className="block text-[10px] text-[#71717a]">Vaga</span>
                  <strong className="mt-0.5 block truncate text-[#0a0a0a]">
                    {jobLabel(quickPeekRow.jobTitle, quickPeekRow.jobCode)}
                  </strong>
                </div>
                <div className="border-l border-[#e4e4e7] pl-3">
                  <span className="block text-[10px] text-[#71717a]">Média perm.</span>
                  <strong className="mt-0.5 block truncate text-[#0a0a0a]">
                    {quickPeekRow.tenureAvg || "—"}
                  </strong>
                </div>
                <div className="border-l border-[#e4e4e7] pl-3">
                  <span className="block text-[10px] text-[#71717a]">Mediana</span>
                  <strong className="mt-0.5 block truncate text-[#0a0a0a]">
                    {quickPeekRow.tenureMedian || quickPeekRow.tenureAvg || "—"}
                  </strong>
                </div>
              </div>

              {quickPeekRow.tenureCompanies && quickPeekRow.tenureCompanies.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {quickPeekRow.tenureCompanies.map((c, i) => (
                    <span
                      key={i}
                      className="rounded-lg border border-[#e4e4e7] bg-white px-2.5 py-1 text-[11px] text-[#3f3f46]"
                    >
                      <strong>{c.empresa}</strong> · {c.duracaoFormatada}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#71717a]">
                  Currículo do Candidato
                </span>
                <div className="flex items-center gap-2">
                  <a
                    href={`/candidaturas/${quickPeekRow.id}/cv`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-[#71717a] hover:text-[#0a0a0a] hover:underline"
                  >
                    Abrir em nova aba ↗
                  </a>
                  <a
                    href={`/candidaturas/${quickPeekRow.id}/cv?download=1`}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#e4e4e7] bg-white px-2.5 py-1 text-xs font-medium text-[#0a0a0a] hover:bg-[#fafaf9]"
                  >
                    <Download className="size-3.5" strokeWidth={1.75} />
                    <span>Baixar PDF</span>
                  </a>
                </div>
              </div>

              <div className="min-h-[340px] flex-1 overflow-hidden rounded-2xl border border-[#e4e4e7] bg-[#f4f4f5]">
                <iframe
                  src={`/candidaturas/${quickPeekRow.id}/cv`}
                  title={`Currículo de ${quickPeekRow.name}`}
                  className="h-full min-h-[340px] w-full border-0"
                />
              </div>
            </div>

            {/* Rodapé de Decisão Rápida da Gaveta */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e4e4e7] bg-[#fafaf9] px-6 py-4">
              <div className="flex items-center gap-2">
                {quickPeekRow.status === "PENDING" && !quickPeekRow.hasImpediment && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      const targetId = quickPeekRow.id;
                      setQuickPeekRow(null);
                      runBulk("SHORTLISTED", [targetId]);
                    }}
                    className="h-9 rounded-xl px-4 text-xs font-semibold text-white shadow-2xs transition hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: "var(--brand-primary)" }}
                  >
                    ✓ Passar p/ Em análise
                  </button>
                )}
                {quickPeekRow.status !== "STANDBY" && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      const targetId = quickPeekRow.id;
                      setQuickPeekRow(null);
                      runBulk("STANDBY", [targetId]);
                    }}
                    className="h-9 rounded-xl border border-[#e4e4e7] bg-white px-3.5 text-xs font-medium text-[#0a0a0a] hover:bg-[#f4f4f5] disabled:opacity-50"
                  >
                    Stand-by
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/candidaturas/${quickPeekRow.id}?edit=1`}
                  className="inline-flex h-9 items-center rounded-xl border border-[#e4e4e7] bg-white px-3.5 text-xs font-semibold text-[#0a0a0a] transition hover:bg-[#f4f4f5]"
                >
                  Editar cadastro
                </Link>
                <Link
                  href={`/candidaturas/${quickPeekRow.id}`}
                  className="inline-flex h-9 items-center rounded-xl bg-[#0a0a0a] px-4 text-xs font-semibold text-white transition hover:opacity-90"
                >
                  Abrir dossiê completo →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  );
}
