"use client";

import { Briefcase, CheckCircle2, ChevronDown, ChevronUp, FileEdit, LayoutDashboard, Radio, Sparkles, User, Users, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export type PresencePayload = {
  role: "candidato" | "equipe";
  path?: string;
  name?: string;
  isRegistered?: boolean;
  timestamp?: number;
};

export type ScreenCategory = "cadastro" | "principal" | "perfil" | "painel";

export function categorizePresence(
  path?: string,
  role: "candidato" | "equipe" = "candidato"
): {
  category: ScreenCategory;
  categoryLabel: string;
  screenTitle: string;
  colorPill: string;
} {
  const p = (path || "").toLowerCase();

  if (
    role === "equipe" ||
    p.startsWith("/painel") ||
    p.startsWith("/candidaturas") ||
    p.startsWith("/buscar-cvs") ||
    p.startsWith("/talentos") ||
    p.startsWith("/admin")
  ) {
    let screen = "Painel de Gestão";
    if (p.includes("/candidaturas")) screen = "Triagem de Candidaturas";
    else if (p.includes("/buscar-cvs")) screen = "Radar de Talentos & CVs";
    else if (p.includes("/agentes")) screen = "Sala de Agentes IA";
    else if (p.includes("/vagas/nova")) screen = "Criando nova vaga";
    return {
      category: "painel",
      categoryLabel: "Equipe no Painel",
      screenTitle: screen,
      colorPill: "bg-amber-100 text-amber-900 border-amber-300",
    };
  }

  if (p.includes("/candidat") || p.includes("/inscricao")) {
    return {
      category: "cadastro",
      categoryLabel: "No Cadastro / Inscrição",
      screenTitle: "Preenchendo Formulário de Candidatura",
      colorPill: "bg-rose-100 text-rose-900 border-rose-300",
    };
  }

  if (p.includes("/entrar")) {
    return {
      category: "cadastro",
      categoryLabel: "No Cadastro / Inscrição",
      screenTitle: "Tela de Login / Cadastro Inicial",
      colorPill: "bg-rose-100 text-rose-900 border-rose-300",
    };
  }

  if (p.includes("/perfil")) {
    return {
      category: "perfil",
      categoryLabel: "No Perfil do Candidato",
      screenTitle: "Consultando / Editando Meu Perfil",
      colorPill: "bg-purple-100 text-purple-900 border-purple-300",
    };
  }

  if (p.includes("/minhas-candidaturas") || p.includes("/notificacoes")) {
    return {
      category: "perfil",
      categoryLabel: "No Perfil do Candidato",
      screenTitle: "Acompanhando Minhas Candidaturas",
      colorPill: "bg-purple-100 text-purple-900 border-purple-300",
    };
  }

  return {
    category: "principal",
    categoryLabel: "Logado na Tela Principal",
    screenTitle: "Navegando no Mural de Vagas Abertas",
    colorPill: "bg-emerald-100 text-emerald-900 border-emerald-300",
  };
}

function getTabPresenceKey(): string {
  try {
    const key = "triagem:presence:id";
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

/**
 * Rastreia visitantes nas páginas públicas da empresa (vagas, formulário de candidatura, perfil, etc.)
 * em tempo real via Supabase Realtime Presence, atualizando sempre que a rota mudar.
 */
export function PublicPresenceTracker({
  slug,
  candidateName,
}: {
  slug: string;
  candidateName?: string | null;
}) {
  const pathname = usePathname();

  useEffect(() => {
    if (!slug) return;
    let supabase: ReturnType<typeof createClient> | null = null;
    try {
      supabase = createClient();
    } catch {
      return;
    }

    const presenceKey = getTabPresenceKey();
    const channel = supabase.channel(`online:${slug}`, {
      config: { presence: { key: presenceKey } },
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          role: "candidato",
          path: pathname,
          name: candidateName || undefined,
          isRegistered: Boolean(candidateName),
          timestamp: Date.now(),
        } satisfies PresencePayload);
      }
    });

    return () => {
      void channel.unsubscribe();
    };
  }, [slug, pathname, candidateName]);

  return null;
}

type OnlineSession = {
  key: string;
  role: "candidato" | "equipe";
  path: string;
  name?: string;
  isRegistered?: boolean;
  category: ScreenCategory;
  categoryLabel: string;
  screenTitle: string;
};

/**
 * Badge em tempo real com Popover detalhado mostrando exatamente quantas pessoas
 * estão online e em qual tela cada uma está (No Cadastro, Na Tela Principal, No Perfil ou no Painel).
 */
export function OnlineCounterBadge({
  slug,
  variant = "sidebar",
  activeJobsCount = 0,
  totalJobsCount = 0,
  jobsToday = 0,
  userName,
}: {
  slug: string;
  variant?: "sidebar" | "topbar" | "admin";
  activeJobsCount?: number;
  totalJobsCount?: number;
  jobsToday?: number;
  userName?: string;
}) {
  const [sessions, setSessions] = useState<OnlineSession[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Fecha o popover ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!slug) return;
    let supabase: ReturnType<typeof createClient> | null = null;
    try {
      supabase = createClient();
    } catch {
      return;
    }

    const presenceKey = getTabPresenceKey();
    const channel = supabase.channel(`online:${slug}`, {
      config: { presence: { key: presenceKey } },
    });

    const syncCounts = () => {
      const state = channel.presenceState<PresencePayload>();
      const list: OnlineSession[] = [];

      for (const [key, presences] of Object.entries(state)) {
        const first = presences[0];
        if (!first) continue;
        const info = categorizePresence(first.path, first.role);
        list.push({
          key,
          role: first.role,
          path: first.path || "/",
          name: first.name,
          isRegistered: first.isRegistered,
          category: info.category,
          categoryLabel: info.categoryLabel,
          screenTitle: info.screenTitle,
        });
      }
      setSessions(list);
    };

    channel
      .on("presence", { event: "sync" }, syncCounts)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            role: "equipe",
            path: window.location.pathname,
            name: userName || undefined,
            isRegistered: true,
            timestamp: Date.now(),
          } satisfies PresencePayload);
        }
      });

    return () => {
      void channel.unsubscribe();
    };
  }, [slug, userName]);

  const candidates = sessions.filter((s) => s.role === "candidato");
  const team = sessions.filter((s) => s.role === "equipe");

  const cadastroCount = candidates.filter((s) => s.category === "cadastro").length;
  const principalCount = candidates.filter((s) => s.category === "principal").length;
  const perfilCount = candidates.filter((s) => s.category === "perfil").length;
  const total = Math.max(sessions.length, 1);

  if (variant === "topbar") {
    return (
      <div className="relative" ref={containerRef}>
        <button
          type="button"
          onClick={() => setIsOpen((p) => !p)}
          className="ml-auto flex items-center gap-2 rounded-full border border-[#e4e4e7] bg-[#fafaf9] px-3 py-1 text-[11px] font-medium text-[#0a0a0a] transition hover:bg-white"
        >
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <span>
            <strong>{total}</strong> online
          </span>
          {cadastroCount > 0 && (
            <span className="rounded-full bg-rose-100 px-1.5 py-0.2 text-[9px] font-bold text-rose-800">
              {cadastroCount} no cadastro
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Botão Principal da Sidebar */}
      <button
        type="button"
        onClick={() => setIsOpen((p) => !p)}
        className="mx-3 mb-2 flex w-[calc(100%-1.5rem)] items-center justify-between rounded-xl border border-[#e7e5e4] bg-white px-3 py-2 text-[11px] shadow-xs transition hover:border-[#0a0a0a]/20 hover:bg-[#fafaf9] active:scale-98"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex size-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <span className="truncate font-medium text-[#0a0a0a]">Online agora</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {cadastroCount > 0 ? (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
              {cadastroCount} no cadastro
            </span>
          ) : candidates.length > 0 ? (
            <span className="rounded-full bg-[#e4f6ec] px-2 py-0.5 text-[10px] font-semibold text-[#1f7a4d]">
              {candidates.length} nas vagas
            </span>
          ) : null}

          <span className="flex items-center gap-1 rounded-full bg-[#f4f4f5] px-2 py-0.5 text-[11px] font-bold text-[#0a0a0a]">
            <Users className="size-3 text-[#71717a]" />
            {total}
            {isOpen ? <ChevronUp className="size-2.5 text-[#a1a1aa]" /> : <ChevronDown className="size-2.5 text-[#a1a1aa]" />}
          </span>
        </div>
      </button>

      {/* Popover Detalhado com as Telas em Tempo Real */}
      {isOpen && (
        <div className="absolute bottom-[calc(100%+6px)] left-3 z-50 w-72 rounded-2xl border border-[#e4e4e7] bg-white p-3.5 shadow-xl animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between border-b border-[#f4f4f5] pb-2.5">
            <div className="flex items-center gap-2">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              <h4 className="text-xs font-bold text-[#0a0a0a]">Onde estão online agora</h4>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-[#a1a1aa] hover:bg-[#f4f4f5] hover:text-[#0a0a0a]"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {/* Vagas da empresa */}
          <div className="mt-2.5 flex items-center justify-between rounded-xl border border-[#e7e5e4] bg-[#fafaf9] p-2.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <Briefcase className="size-3.5 text-[#b07818] shrink-0" />
              <span className="truncate text-[11px] font-medium text-[#57534e]">
                {activeJobsCount > 0 ? "Vagas ativas na empresa:" : "Vagas cadastradas:"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {jobsToday > 0 && (
                <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                  +{jobsToday} hoje
                </span>
              )}
              <span className="rounded-md bg-white px-2 py-0.5 text-xs font-bold text-[#0a0a0a] shadow-xs">
                {activeJobsCount > 0 ? activeJobsCount : totalJobsCount}{" "}
                {(activeJobsCount > 0 ? activeJobsCount : totalJobsCount) === 1 ? "vaga" : "vagas"}
              </span>
            </div>
          </div>

          {/* Cards de Resumo Rápido */}
          <div className="mt-2.5 grid grid-cols-2 gap-1.5 text-center">
            <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-2">
              <span className="block text-[10px] font-semibold text-rose-700">No Cadastro / Vaga</span>
              <span className="text-base font-extrabold text-rose-950">{cadastroCount}</span>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-2">
              <span className="block text-[10px] font-semibold text-emerald-700">Tela Principal</span>
              <span className="text-base font-extrabold text-emerald-950">{principalCount}</span>
            </div>

            <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-2">
              <span className="block text-[10px] font-semibold text-purple-700">Perfil / Candidaturas</span>
              <span className="text-base font-extrabold text-purple-950">{perfilCount}</span>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-2">
              <span className="block text-[10px] font-semibold text-amber-700">Equipe / Painel</span>
              <span className="text-base font-extrabold text-amber-950">{team.length}</span>
            </div>
          </div>

          {/* Lista de Sessões Ativas */}
          <div className="mt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
              Sessões Ativas ({sessions.length})
            </p>
            <div className="mt-1.5 max-h-44 space-y-1.5 overflow-y-auto pr-1">
              {sessions.map((s, idx) => {
                const isCand = s.role === "candidato";
                const isCad = s.category === "cadastro";
                const isPerf = s.category === "perfil";

                return (
                  <div
                    key={s.key || idx}
                    className="flex items-center gap-2 rounded-lg border border-[#f4f4f5] bg-[#fafaf9] p-2 text-xs"
                  >
                    <div
                      className={`flex size-6 shrink-0 items-center justify-center rounded-md ${
                        isCad
                          ? "bg-rose-100 text-rose-700"
                          : isPerf
                            ? "bg-purple-100 text-purple-700"
                            : isCand
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {isCad ? (
                        <FileEdit className="size-3" />
                      ) : isPerf ? (
                        <User className="size-3" />
                      ) : isCand ? (
                        <LayoutDashboard className="size-3" />
                      ) : (
                        <Users className="size-3" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[11px] font-bold text-[#0a0a0a]">
                          {s.name ? s.name : isCand ? "Visitante (sem login)" : "Membro da equipe"}
                        </span>
                        {s.isRegistered && (
                          <span className="shrink-0 rounded bg-emerald-100 px-1 py-0.2 text-[9px] font-bold text-emerald-800">
                            Cadastrado
                          </span>
                        )}
                      </div>
                      <span className="block truncate text-[10px] font-medium text-[#57534e]">
                        {s.screenTitle}
                      </span>
                      <span className="block truncate text-[9px] text-[#a1a1aa]">
                        {s.categoryLabel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
