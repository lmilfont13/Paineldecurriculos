"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type React from "react";
import { ChevronDown, ChevronUp, Download, Search } from "lucide-react";
import type { AIState } from "@prisma/client";
import {
  bulkSetApplicationStatusAction,
  moveApplicationAction,
} from "@/server/controllers/application.controller";
import {
  appStatusLabels,
  formatWaiting,
  type AppStatusKey,
} from "@/server/models/application.model";
import { CandidateAvatar } from "@/components/gestor/candidate-avatar";
import { ResumeLightboxButton } from "@/components/gestor/resume-lightbox-button";
import { AiScoreChip } from "@/components/gestor/ai-score-chip";
import { Toast } from "@/components/gestor/toast";
import { inAgeRange } from "@/server/models/age.model";
import { BulkRejectDialog } from "@/components/gestor/bulk-reject-dialog";
import {
  StageMoveDialog,
  type MoveNoticeChoice,
} from "@/components/gestor/stage-move-dialog";

const STAGES: {
  key: AppStatusKey;
  label: string;
  accent: string;
  hint: string;
}[] = [
  { key: "PENDING", label: "Triagem", accent: "#b07818", hint: "Novas candidaturas" },
  { key: "SHORTLISTED", label: "Em análise", accent: "#2f5fa8", hint: "Prontos para chamar" },
  { key: "INTERVIEW", label: "Entrevista", accent: "#b07818", hint: "Em conversa" },
  { key: "STANDBY", label: "Stand-by", accent: "#0e7a6b", hint: "Guardados p/ depois" },
  { key: "APPROVED", label: "Aprovados", accent: "#1f7a4d", hint: "Prontos para avançar" },
  { key: "REJECTED", label: "BANCO DE DADOS", accent: "#71717a", hint: "Disponível no banco" },
];

const INITIAL_PER_COL = 5;

type PipelinePerson = {
  id: string;
  name: string;
  status: AppStatusKey;
  aiScore: number | null;
  aiState: AIState | null;
  createdAt: string;
  photoUrl?: string | null;
  age?: number | null;
  hasImpediment?: boolean;
  impedimentReason?: string | null;
};

export function VagaPipeline({
  applications,
  aiMinScore,
  jobId,
  jobTitle,
  companyName,
  templates,
  undoEnabled = true,
}: {
  applications: PipelinePerson[];
  aiMinScore: number;
  jobId: string;
  jobTitle: string;
  companyName: string;
  templates: { id: string; subject: string; body: string }[];
  undoEnabled?: boolean;
}) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [people, setPeople] = useState(applications);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<AppStatusKey | null>(null);
  const [confirm, setConfirm] = useState<{
    id: string;
    name: string;
    from: AppStatusKey;
    stage: AppStatusKey;
  } | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    action?: { label: string; onClick: () => void };
  } | null>(null);
  const [pending, startTransition] = useTransition();

  // Recolhimento do quadro inteiro + recolhimento por coluna (Banco de Dados já nasce recolhido se > 5)
  const initialRejectedCount = applications.filter((a) => a.status === "REJECTED").length;
  const [boardCollapsed, setBoardCollapsed] = useState(false);
  const [collapsedCols, setCollapsedCols] = useState<Record<string, boolean>>(() => ({
    REJECTED: initialRejectedCount > INITIAL_PER_COL,
  }));
  const [expandedLimits, setExpandedLimits] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");

  // Filtro de idade: só muda o que aparece no funil. Idade nunca entra na nota nem vai para a IA.
  const [ageOpen, setAgeOpen] = useState(false);
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [hideUnknown, setHideUnknown] = useState(false);
  const toAge = (v: string) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const range = { min: toAge(ageMin), max: toAge(ageMax), hideUnknown };
  const ageFiltering = range.min !== null || range.max !== null;
  const cleanQuery = query.trim().toLowerCase();
  const visible = people.filter(
    (p) =>
      inAgeRange(p.age ?? null, range) &&
      (!cleanQuery || p.name.toLowerCase().includes(cleanQuery))
  );
  const hiddenByAge = people.length - people.filter((p) => inAgeRange(p.age ?? null, range)).length;

  function toggleColCollapse(key: AppStatusKey) {
    setCollapsedCols((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleColLimit(key: AppStatusKey) {
    setExpandedLimits((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function move(id: string, stage: AppStatusKey, notice: MoveNoticeChoice) {
    const person = people.find((p) => p.id === id);
    if (!person || person.status === stage) return;
    if (person.hasImpediment && (stage === "INTERVIEW" || stage === "APPROVED")) {
      setToast({
        message:
          "Candidato possui impedimento de contratação ativo (Tarja Preta) e não pode avançar para Entrevista ou Aprovação.",
      });
      setDraggingId(null);
      setOverStage(null);
      return;
    }
    const previousStage = person.status;
    setDraggingId(null);
    setOverStage(null);
    const previous = people;
    startTransition(async () => {
      try {
        const result = await moveApplicationAction(id, stage, notice);
        if (!result.ok) {
          setToast({ message: result.error });
          return;
        }
        setPeople((current) =>
          current.map((p) => (p.id === id ? { ...p, status: stage } : p))
        );
        setConfirm(null);
        const aviso =
          notice.mode === "silent"
            ? " (sem aviso)"
            : notice.mode === "custom"
              ? " com a sua mensagem"
              : "";
        if (undoEnabled) {
          setToast({
            message: `${person.name} → ${appStatusLabels[stage]}${aviso}.`,
            action: {
              label: "Desfazer",
              onClick: () => {
                setPeople((cur) =>
                  cur.map((p) => (p.id === id ? { ...p, status: previousStage } : p))
                );
                startTransition(async () => {
                  try {
                    await moveApplicationAction(id, previousStage, { mode: "silent" });
                    setToast({ message: `Movimento de ${person.name} desfeito.` });
                  } catch {
                    setPeople((cur) =>
                      cur.map((p) => (p.id === id ? { ...p, status: stage } : p))
                    );
                    setToast({ message: "Não foi possível desfazer." });
                  }
                });
              },
            },
          });
        } else {
          setToast({ message: `${person.name} → ${appStatusLabels[stage]}${aviso}.` });
        }
      } catch {
        setPeople(previous);
        setToast({
          message: "Não foi possível mover o candidato. Tente novamente.",
        });
      }
    });
  }

  /** Quem está na triagem e já atingiu a nota mínima da vaga: passa todos de uma vez. */
  const ready = visible.filter(
    (p) =>
      p.status === "PENDING" &&
      !p.hasImpediment &&
      p.aiScore !== null &&
      p.aiScore >= aiMinScore
  );

  function passAllReady() {
    if (
      ready.length === 0 ||
      !window.confirm(
        `Passar ${ready.length} candidato${ready.length === 1 ? "" : "s"} que atingiram a nota mínima (${aiMinScore}) para "Em análise"?`
      )
    )
      return;
    const ids = ready.map((p) => p.id);
    const previous = people;
    setPeople((current) =>
      current.map((p) => (ids.includes(p.id) ? { ...p, status: "SHORTLISTED" } : p))
    );
    startTransition(async () => {
      try {
        let updated = 0;
        for (let i = 0; i < ids.length; i += 100) {
          updated += (
            await bulkSetApplicationStatusAction(ids.slice(i, i + 100), "SHORTLISTED")
          ).updated;
        }
        setToast({
          message: `${updated} candidato${updated === 1 ? "" : "s"} movido${updated === 1 ? "" : "s"} para Em análise.`,
        });
      } catch {
        setPeople(previous);
        setToast({
          message: "Não foi possível passar os candidatos. Tente novamente.",
        });
      }
    });
  }

  const stillPending = visible.filter((p) => p.status === "PENDING");
  function onBulkRejected(ids: string[]) {
    if (ids.length === 0) return;
    setPeople((current) =>
      current.map((p) => (ids.includes(p.id) ? { ...p, status: "REJECTED" } : p))
    );
    setToast({
      message: `${ids.length} candidato${ids.length === 1 ? "" : "s"} movido${ids.length === 1 ? "" : "s"} para o banco de dados com a mensagem enviada.`,
    });
  }

  function askMove(id: string, stage: AppStatusKey) {
    const person = people.find((p) => p.id === id);
    if (!person || person.status === stage) return;
    if (person.hasImpediment && (stage === "INTERVIEW" || stage === "APPROVED")) {
      setToast({
        message:
          "Candidato possui impedimento de contratação ativo (Tarja Preta) e não pode avançar para Entrevista ou Aprovação.",
      });
      setDraggingId(null);
      setOverStage(null);
      return;
    }
    setDraggingId(null);
    setOverStage(null);
    setConfirm({ id, name: person.name, from: person.status, stage });
  }

  function onDragStart(e: React.DragEvent<HTMLElement>, id: string) {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }

  function onDrop(e: React.DragEvent<HTMLElement>, stage: AppStatusKey) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || draggingId;
    if (id) askMove(id, stage);
  }

  return (
    <>
      <div className="mt-4 rounded-2xl border border-[#e4e4e7] bg-[#f7f6f4] p-2.5">
        {/* Barra Superior de Controles do Funil */}
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1.5 py-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-8 w-48 items-center gap-1.5 rounded-xl border border-[#e4e4e7] bg-white px-2.5">
              <Search className="size-3.5 text-[#a1a1aa]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar no funil…"
                className="w-full bg-transparent text-[11px] text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => setAgeOpen((o) => !o)}
              className="inline-flex h-8 items-center gap-1 rounded-xl border border-[#e4e4e7] bg-white px-2.5 text-[11px] font-medium text-[#52525b] hover:text-[#0a0a0a]"
              aria-expanded={ageOpen}
            >
              <span>
                {ageFiltering
                  ? `Idade: ${range.min ?? "…"}–${range.max ?? "…"}a${hiddenByAge > 0 ? ` (${hiddenByAge} oculto${hiddenByAge === 1 ? "" : "s"})` : ""}`
                  : "Filtrar idade"}
              </span>
              <span>{ageOpen ? "▴" : "▾"}</span>
            </button>

            {ready.length > 0 && (
              <button
                type="button"
                disabled={pending}
                onClick={passAllReady}
                className="h-8 rounded-xl px-3 text-[11px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{
                  backgroundColor: "var(--brand-primary)",
                  color: "var(--brand-foreground)",
                }}
              >
                Passar quem atende o mínimo ({ready.length})
              </button>
            )}

            {stillPending.length > 0 && (
              <button
                type="button"
                disabled={pending}
                onClick={() => setRejectOpen(true)}
                className="h-8 rounded-xl border border-[#e8c4c0] bg-white px-3 text-[11px] font-semibold text-[#c23b3b] transition hover:bg-[#fbeae8] disabled:opacity-50"
              >
                Mover triagem p/ Banco ({stillPending.length})
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="#sugestoes-banco"
              className="inline-flex h-8 items-center gap-1 rounded-xl border border-[#e4e4e7] bg-white px-3 text-[11px] font-semibold text-[#0e7a6b] transition hover:bg-[#fafaf9]"
              title="Pular direto para as sugestões do banco de talentos abaixo"
            >
              <span>Sugestões do banco ↓</span>
            </a>

            <button
              type="button"
              onClick={() => setBoardCollapsed((c) => !c)}
              className="inline-flex h-8 items-center gap-1 rounded-xl border border-[#e4e4e7] bg-white px-3 text-[11px] font-semibold text-[#0a0a0a] transition hover:bg-[#fafaf9]"
            >
              {boardCollapsed ? (
                <>
                  <span>Expandir funil</span>
                  <ChevronDown className="size-3.5" />
                </>
              ) : (
                <>
                  <span>Recolher funil</span>
                  <ChevronUp className="size-3.5" />
                </>
              )}
            </button>
          </div>
        </div>

        {ageOpen && (
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[#e4e4e7] bg-white px-3 py-2 text-[12px] text-[#57534e]">
            <label className="flex items-center gap-1.5">
              De
              <input
                type="number"
                inputMode="numeric"
                min={14}
                max={99}
                value={ageMin}
                onChange={(e) => setAgeMin(e.target.value)}
                className="h-7 w-16 rounded-md border border-[#e4e4e7] px-2 text-[12px]"
                placeholder="18"
              />
            </label>
            <label className="flex items-center gap-1.5">
              até
              <input
                type="number"
                inputMode="numeric"
                min={14}
                max={99}
                value={ageMax}
                onChange={(e) => setAgeMax(e.target.value)}
                className="h-7 w-16 rounded-md border border-[#e4e4e7] px-2 text-[12px]"
                placeholder="35"
              />
              anos
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={hideUnknown}
                onChange={(e) => setHideUnknown(e.target.checked)}
              />
              Ocultar quem não informou a idade
            </label>
            {(ageFiltering || hideUnknown) && (
              <button
                type="button"
                onClick={() => {
                  setAgeMin("");
                  setAgeMax("");
                  setHideUnknown(false);
                }}
                className="font-medium underline underline-offset-2"
              >
                Limpar
              </button>
            )}
            <span className="text-[11px] text-[#a1a1aa]">
              Só muda o que você vê aqui. A idade não entra na nota.
            </span>
          </div>
        )}

        {/* Visão Recolhida do Funil Inteiro (1 linha compacta para ver a tela de baixo sem rolagem) */}
        {boardCollapsed ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#e4e4e7] bg-white px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              {STAGES.map((stage) => {
                const count = visible.filter((p) => p.status === stage.key).length;
                return (
                  <button
                    key={stage.key}
                    type="button"
                    onClick={() => {
                      setBoardCollapsed(false);
                      setCollapsedCols((prev) => ({ ...prev, [stage.key]: false }));
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#fafaf9] px-2.5 py-1 text-xs font-medium text-[#0a0a0a] ring-1 ring-[#e4e4e7] transition hover:bg-[#f4f4f5]"
                  >
                    <span>{stage.label}</span>
                    <span
                      className="rounded-full bg-white px-1.5 py-0.2 text-[11px] font-bold tabular-nums"
                      style={{ color: stage.accent }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setBoardCollapsed(false)}
              className="text-xs font-semibold text-[#52525b] hover:text-[#0a0a0a] hover:underline"
            >
              Mostrar colunas ▾
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {STAGES.map((stage) => {
              const rows = visible.filter((p) => p.status === stage.key);
              const active = overStage === stage.key && draggingId !== null;
              const isColCollapsed = Boolean(collapsedCols[stage.key]);
              const isLimitExpanded = Boolean(expandedLimits[stage.key]);
              const visibleRows = isLimitExpanded
                ? rows
                : rows.slice(0, INITIAL_PER_COL);
              const hiddenCount = rows.length - visibleRows.length;

              return (
                <section
                  key={stage.key}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setOverStage(stage.key);
                  }}
                  onDragEnter={() => setOverStage(stage.key)}
                  onDrop={(e) => onDrop(e, stage.key)}
                  className={`flex flex-col rounded-xl border bg-white transition-all ${
                    active
                      ? "border-[#811201] bg-[#fffaf8] shadow-[0_0_0_3px_rgba(129,18,1,0.08)]"
                      : "border-[#e4e4e7]"
                  }`}
                >
                  <header className="flex items-center justify-between border-b border-[#e4e4e7] px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[12px] font-semibold text-[#0a0a0a]">
                          {stage.label}
                        </span>
                        <span
                          className="shrink-0 rounded-full bg-[#f1f0ed] px-2 py-0.5 text-[10px] font-bold tabular-nums"
                          style={{ color: stage.accent }}
                        >
                          {rows.length}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[9px] text-[#aaa39c]">
                        {stage.hint}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      {active && (
                        <span className="rounded-full bg-[#811201]/[0.08] px-2 py-0.5 text-[9px] font-semibold text-[#811201]">
                          Soltar
                        </span>
                      )}
                      {rows.length > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleColCollapse(stage.key)}
                          title={
                            isColCollapsed
                              ? `Expandir coluna ${stage.label}`
                              : `Recolher coluna ${stage.label}`
                          }
                          className="inline-flex size-6 items-center justify-center rounded-lg text-[#71717a] transition hover:bg-[#f4f4f5] hover:text-[#0a0a0a]"
                        >
                          {isColCollapsed ? (
                            <ChevronDown className="size-3.5" />
                          ) : (
                            <ChevronUp className="size-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </header>

                  {isColCollapsed ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-3 text-center">
                      <p className="text-[11px] font-medium text-[#71717a]">
                        {rows.length} {rows.length === 1 ? "candidato recolhido" : "candidatos recolhidos"}
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleColCollapse(stage.key)}
                          className="rounded-lg border border-[#e4e4e7] bg-[#fafaf9] px-2.5 py-1 text-[11px] font-semibold text-[#0a0a0a] transition hover:bg-[#f4f4f5]"
                        >
                          Expandir ({rows.length}) ▾
                        </button>
                        <Link
                          href={`/candidaturas?vaga=${jobId}&status=${stage.key}`}
                          className="rounded-lg px-2 py-1 text-[11px] font-medium text-[#71717a] hover:text-[#0a0a0a] hover:underline"
                        >
                          Ver na tabela →
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="max-h-[420px] space-y-2 overflow-y-auto p-2">
                      {rows.length === 0 && (
                        <div
                          className={`flex min-h-[120px] items-center justify-center rounded-lg border border-dashed text-center ${
                            active
                              ? "border-[#811201]/30 text-[#811201]"
                              : "border-[#e8e5e1] text-[#b4aea8]"
                          }`}
                        >
                          <span className="text-[11px]">
                            {active ? "Solte para mover" : "Nenhum candidato"}
                          </span>
                        </div>
                      )}

                      {visibleRows.map((person) => (
                        <div
                          key={person.id}
                          draggable
                          onDragStart={(e) => onDragStart(e, person.id)}
                          onDragEnd={() => {
                            setDraggingId(null);
                            setOverStage(null);
                          }}
                          className={`group rounded-xl border bg-white p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all ${
                            draggingId === person.id
                              ? "scale-[0.98] border-[#811201]/30 opacity-45"
                              : "border-[#e8e5e1] hover:-translate-y-0.5 hover:border-[#d4d0ca] hover:shadow-[0_6px_18px_rgba(0,0,0,0.06)]"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <CandidateAvatar
                              name={person.name}
                              photoUrl={person.photoUrl}
                              className="pointer-events-none mt-0.5 flex size-7 shrink-0 cursor-grab items-center justify-center rounded-full bg-[#1c1917] text-[9px] font-bold text-white active:cursor-grabbing"
                            />
                            <Link
                              href={"/candidaturas/" + person.id}
                              draggable={false}
                              title={
                                person.age != null
                                  ? `${person.age} anos`
                                  : "Idade não informada"
                              }
                              className="min-w-0 flex-1"
                            >
                              <span className="block truncate text-[12px] font-semibold text-[#0a0a0a]">
                                {person.name}
                              </span>
                              {person.hasImpediment && (
                                <span
                                  className="mt-1 inline-flex items-center gap-1 rounded-full border border-zinc-200/80 bg-zinc-50 px-1.5 py-0.5 text-[9px] font-medium text-zinc-600"
                                  title={
                                    person.impedimentReason
                                      ? `Motivo: ${person.impedimentReason}`
                                      : "Impedimento de contratação ativo"
                                  }
                                >
                                  <span className="size-1.5 rounded-full bg-rose-500/80" />
                                  <span>Tarja preta</span>
                                </span>
                              )}
                              {person.age != null && (
                                <span
                                  className={
                                    "mt-0.5 block text-[10px] text-[#a1a1aa] transition-opacity " +
                                    (ageFiltering
                                      ? "opacity-100"
                                      : "opacity-0 group-hover:opacity-100")
                                  }
                                >
                                  {person.age} anos
                                </span>
                              )}
                              {stage.key === "PENDING" && (
                                <span className="mt-0.5 block text-[10px] font-medium text-[#b07818]">
                                  espera {formatWaiting(new Date(person.createdAt))}
                                </span>
                              )}
                            </Link>
                            <span
                              className="select-none text-[13px] text-[#c5c0bb] opacity-0 transition-opacity group-hover:opacity-100"
                              aria-hidden
                            >
                              ⋮⋮
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-1.5">
                            <AiScoreChip
                              aiScore={person.aiScore}
                              aiState={person.aiState ?? "WAITING"}
                              meetsMinimum={
                                person.aiScore !== null && person.aiScore >= aiMinScore
                              }
                            />
                            <div className="flex items-center gap-0.5">
                              <ResumeLightboxButton
                                applicationId={person.id}
                                candidateName={person.name}
                                label="CV"
                                showIcon={false}
                                className="inline-flex h-5 items-center rounded px-1.5 text-[10px] font-medium text-[#71717a] transition-colors hover:bg-[#f4f4f5] hover:text-[#0a0a0a]"
                              />
                              <a
                                href={`/candidaturas/${person.id}/cv?download=1`}
                                draggable={false}
                                className="inline-flex size-5 items-center justify-center rounded text-[#a1a1aa] transition-colors hover:bg-[#f4f4f5] hover:text-[#0a0a0a]"
                                title="Baixar currículo em PDF"
                                aria-label="Baixar currículo em PDF"
                              >
                                <Download className="size-3" strokeWidth={1.75} />
                              </a>
                            </div>
                          </div>
                        </div>
                      ))}

                      {rows.length > INITIAL_PER_COL && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => toggleColLimit(stage.key)}
                            className="w-full rounded-lg border border-[#e4e4e7] bg-[#fafaf9] py-1.5 text-[11px] font-semibold text-[#52525b] transition hover:bg-[#f4f4f5] hover:text-[#0a0a0a]"
                          >
                            {isLimitExpanded
                              ? "Mostrar menos ▴"
                              : `Ver mais ${hiddenCount} nesta coluna ▾`}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>

      {rejectOpen && (
        <BulkRejectDialog
          jobId={jobId}
          jobTitle={jobTitle}
          companyName={companyName}
          templates={templates}
          candidates={stillPending.map((p) => ({
            id: p.id,
            name: p.name,
            aiScore: p.aiScore,
            photoUrl: p.photoUrl,
            analyzing: p.aiState === "WAITING" || p.aiState === "PROCESSING",
          }))}
          onClose={() => setRejectOpen(false)}
          onDone={onBulkRejected}
        />
      )}
      {confirm && (
        <StageMoveDialog
          candidateName={confirm.name}
          from={confirm.from}
          to={confirm.stage}
          companyName={companyName}
          jobTitle={jobTitle}
          pending={pending}
          onCancel={() => setConfirm(null)}
          onConfirm={(notice) => move(confirm.id, confirm.stage, notice)}
        />
      )}
      {toast && (
        <Toast
          message={toast.message}
          action={toast.action}
          onDone={() => setToast(null)}
        />
      )}
    </>
  );
}
