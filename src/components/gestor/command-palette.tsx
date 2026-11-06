"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Briefcase,
  UserPlus,
  FileSearch,
  BarChart3,
  Settings,
  ClipboardList,
  LayoutDashboard,
  User,
  X,
  Sparkles,
  ArrowRight,
  Command,
} from "lucide-react";
import { searchGlobalAction } from "@/server/controllers/search.controller";
import type { SearchCandidateItem, SearchJobItem } from "@/server/models/search.model";
import { appStatusLabels, type AppStatusKey } from "@/server/models/application.model";

interface CommandPaletteProps {
  enabled?: boolean;
}

interface ActionItem {
  id: string;
  type: "action";
  label: string;
  category: "Ações Rápidas";
  icon: typeof Briefcase;
  href: string;
}

interface JobPaletteItem extends SearchJobItem {
  type: "job";
  category: "Vagas";
}

interface CandidatePaletteItem extends SearchCandidateItem {
  type: "candidate";
  category: "Candidatos";
}

type PaletteItem = ActionItem | JobPaletteItem | CandidatePaletteItem;

const QUICK_ACTIONS: ActionItem[] = [
  { id: "act_new_job", type: "action", label: "Criar nova vaga", category: "Ações Rápidas", icon: Briefcase, href: "/vagas/novo" },
  { id: "act_new_candidate", type: "action", label: "Cadastrar candidato manualmente", category: "Ações Rápidas", icon: UserPlus, href: "/candidaturas/novo" },
  { id: "act_search_cvs", type: "action", label: "Buscar no Banco de Currículos", category: "Ações Rápidas", icon: FileSearch, href: "/buscar-cvs" },
  { id: "act_reports", type: "action", label: "Ver Relatórios e Métricas", category: "Ações Rápidas", icon: BarChart3, href: "/relatorios" },
  { id: "act_settings", type: "action", label: "Configurações da Empresa", category: "Ações Rápidas", icon: Settings, href: "/configuracoes" },
  { id: "act_audit", type: "action", label: "Registro de Auditoria", category: "Ações Rápidas", icon: ClipboardList, href: "/auditoria" },
  { id: "act_dashboard", type: "action", label: "Ir para o Painel Geral", category: "Ações Rápidas", icon: LayoutDashboard, href: "/painel" },
];

export function openCommandPalette() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("open-command-palette"));
  }
}

export function CommandPalette({ enabled = true }: CommandPaletteProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<SearchCandidateItem[]>([]);
  const [jobs, setJobs] = useState<SearchJobItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Escuta atalhos de teclado (Cmd+K / Ctrl+K e eventos customizados)
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    }

    function handleCustomOpen() {
      setOpen(true);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-command-palette", handleCustomOpen);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-command-palette", handleCustomOpen);
    };
  }, [enabled, open]);

  // Foco no input ao abrir
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      // Carrega vagas recentes ao abrir
      startTransition(async () => {
        try {
          const res = await searchGlobalAction("");
          setJobs(res.jobs);
        } catch {}
      });
    } else {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [open]);

  // Busca debounced
  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(() => {
      startTransition(async () => {
        try {
          const res = await searchGlobalAction(query);
          setCandidates(res.candidates);
          setJobs(res.jobs);
          setSelectedIndex(0);
        } catch {
          setCandidates([]);
        }
      });
    }, 180);

    return () => clearTimeout(timer);
  }, [query, open]);

  if (!enabled || !open) return null;

  // Filtragem das ações rápidas
  const filteredActions: ActionItem[] = query.trim()
    ? QUICK_ACTIONS.filter((a) =>
        a.label.toLowerCase().includes(query.toLowerCase())
      )
    : QUICK_ACTIONS;

  const items: PaletteItem[] = [
    ...candidates.map((c): CandidatePaletteItem => ({ ...c, type: "candidate", category: "Candidatos" })),
    ...jobs.map((j): JobPaletteItem => ({ ...j, type: "job", category: "Vagas" })),
    ...filteredActions,
  ];

  function handleSelect(item: PaletteItem) {
    setOpen(false);
    if (item.type === "action") {
      router.push(item.href);
    } else if (item.type === "candidate") {
      router.push(`/candidaturas/${item.id}`);
    } else if (item.type === "job") {
      router.push(`/vagas/${item.id}`);
    }
  }

  function handleNavigationKeys(e: React.KeyboardEvent) {
    if (items.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const currentItem = items[selectedIndex];
      if (currentItem) {
        handleSelect(currentItem);
      }
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Barra de busca e comandos"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-16 backdrop-blur-xs sm:pt-24"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-[#e4e4e7] bg-white shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input de busca */}
        <div className="relative flex items-center border-b border-[#e4e4e7] px-4 py-3.5">
          <Search className="size-5 shrink-0 text-[#a1a1aa]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleNavigationKeys}
            placeholder="Buscar candidatos, vagas ou ações rápidas..."
            className="w-full bg-transparent px-3 text-sm text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="mr-2 text-[#a1a1aa] hover:text-[#0a0a0a]"
            >
              <X className="size-4" />
            </button>
          ) : null}
          <kbd className="hidden rounded bg-[#f4f4f5] px-2 py-0.5 text-[11px] font-semibold text-[#71717a] sm:inline-block">
            ESC
          </kbd>
        </div>

        {/* Lista de resultados */}
        <div className="max-h-[380px] overflow-y-auto p-2">
          {items.length === 0 ? (
            <div className="py-12 text-center">
              <Search className="mx-auto size-8 text-[#d4d4d8]" />
              <p className="mt-2 text-sm font-medium text-[#71717a]">
                Nenhum resultado encontrado
              </p>
              <p className="text-xs text-[#a1a1aa]">
                Tente buscar pelo nome do candidato, título da vaga ou use as ações rápidas.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {/* Agrupamento: Candidatos */}
              {candidates.length > 0 && (
                <div>
                  <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#a1a1aa]">
                    Candidatos
                  </p>
                  {candidates.map((c) => {
                    const globalIdx = items.findIndex((i) => i.id === c.id);
                    const isSelected = globalIdx === selectedIndex;
                    const statusLabel =
                      appStatusLabels[c.status as AppStatusKey] ?? c.status;

                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelect({ ...c, type: "candidate", category: "Candidatos" })}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                        className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                          isSelected ? "bg-[#f4f4f5] text-[#0a0a0a]" : "text-[#52525b] hover:bg-[#fafaf9]"
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#e4e4e7] text-xs font-bold text-[#18181b]">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-[#0a0a0a]">{c.name}</p>
                            <p className="truncate text-xs text-[#a1a1aa]">
                              {c.jobTitle} · {c.email}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {c.aiScore !== null && (
                            <span className="flex items-center gap-1 rounded bg-[#e4f6ec] px-1.5 py-0.5 text-[11px] font-bold text-[#1f7a4d]">
                              <Sparkles className="size-2.5" />
                              {c.aiScore}
                            </span>
                          )}
                          <span className="rounded-full bg-[#f4f4f5] px-2 py-0.5 text-[11px] text-[#71717a]">
                            {statusLabel}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Agrupamento: Vagas */}
              {jobs.length > 0 && (
                <div className="pt-2">
                  <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#a1a1aa]">
                    Vagas
                  </p>
                  {jobs.map((j) => {
                    const globalIdx = items.findIndex((i) => i.id === j.id);
                    const isSelected = globalIdx === selectedIndex;

                    return (
                      <button
                        key={j.id}
                        type="button"
                        onClick={() => handleSelect({ ...j, type: "job", category: "Vagas" })}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                        className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                          isSelected ? "bg-[#f4f4f5] text-[#0a0a0a]" : "text-[#52525b] hover:bg-[#fafaf9]"
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Briefcase className="size-4 shrink-0 text-[#71717a]" />
                          <div className="min-w-0">
                            <span className="truncate font-medium text-[#0a0a0a]">{j.title}</span>
                            {j.code && (
                              <span className="ml-1.5 text-xs text-[#a1a1aa]">({j.code})</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-[#71717a]">
                            {j.applicationsCount} {j.applicationsCount === 1 ? "candidato" : "candidatos"}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              j.status === "OPEN"
                                ? "bg-[#dcfce7] text-[#15803d]"
                                : "bg-[#f4f4f5] text-[#71717a]"
                            }`}
                          >
                            {j.status === "OPEN" ? "Aberta" : "Encerrada"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Agrupamento: Ações Rápidas */}
              {filteredActions.length > 0 && (
                <div className="pt-2">
                  <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#a1a1aa]">
                    Ações Rápidas
                  </p>
                  {filteredActions.map((a) => {
                    const globalIdx = items.findIndex((i) => i.id === a.id);
                    const isSelected = globalIdx === selectedIndex;
                    const Icon = a.icon;

                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => handleSelect(a)}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                          isSelected ? "bg-[#f4f4f5] text-[#0a0a0a]" : "text-[#52525b] hover:bg-[#fafaf9]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className="size-4 shrink-0 text-[#71717a]" />
                          <span className="font-medium text-[#0a0a0a]">{a.label}</span>
                        </div>
                        <ArrowRight className="size-3.5 text-[#a1a1aa]" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé com dicas de navegação */}
        <div className="flex items-center justify-between border-t border-[#e4e4e7] bg-[#fafaf9] px-4 py-2.5 text-[11px] text-[#71717a]">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="rounded bg-white px-1.5 py-0.5 font-semibold shadow-2xs">↑</kbd>{" "}
              <kbd className="rounded bg-white px-1.5 py-0.5 font-semibold shadow-2xs">↓</kbd> navegar
            </span>
            <span>
              <kbd className="rounded bg-white px-1.5 py-0.5 font-semibold shadow-2xs">↵</kbd> selecionar
            </span>
            <span>
              <kbd className="rounded bg-white px-1.5 py-0.5 font-semibold shadow-2xs">esc</kbd> fechar
            </span>
          </div>
          <span className="hidden sm:inline font-medium text-[#a1a1aa]">
            Command Palette
          </span>
        </div>
      </div>
    </div>
  );
}

/** Botão de atalho visual para colocar no Topbar */
export function CommandPaletteTrigger({ enabled = true }: { enabled?: boolean }) {
  if (!enabled) return null;

  return (
    <button
      type="button"
      onClick={openCommandPalette}
      title="Buscar ou abrir comandos (Ctrl+K)"
      className="hidden items-center gap-2 rounded-xl border border-[#e4e4e7] bg-[#fafaf9] px-3 py-1.5 text-xs text-[#71717a] transition-colors hover:border-[#d4d4d8] hover:bg-white hover:text-[#0a0a0a] sm:flex"
    >
      <Search className="size-3.5 text-[#a1a1aa]" />
      <span>Buscar no painel...</span>
      <kbd className="ml-1.5 flex items-center gap-0.5 rounded border border-[#e4e4e7] bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#71717a] shadow-2xs">
        <Command className="size-2.5" /> K
      </kbd>
    </button>
  );
}

