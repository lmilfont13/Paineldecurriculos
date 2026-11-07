"use client";

import { Briefcase, CheckCircle2, ChevronDown, ChevronUp, FileEdit, LayoutDashboard, Radio, Sparkles, User, Users, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { CandidateSentimentCard } from "@/components/gestor/candidate-sentiment-card";

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

  if (p.includes("/espaco")) {
    return {
      category: "principal",
      categoryLabel: "No Suporte Ao Vivo",
      screenTitle: "Na Sala Virtual de Carreiras & Suporte",
      colorPill: "bg-emerald-100 text-emerald-900 border-emerald-300",
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
  const [effectiveName, setEffectiveName] = useState<string>(() => {
    if (candidateName?.trim()) return candidateName.trim();
    if (typeof window !== "undefined") {
      return localStorage.getItem("triagem:candidate:name") || "";
    }
    return "";
  });

  // Atualiza nome se a prop do servidor mudar
  useEffect(() => {
    if (candidateName?.trim()) {
      setEffectiveName(candidateName.trim());
      try {
        localStorage.setItem("triagem:candidate:name", candidateName.trim());
      } catch {}
    }
  }, [candidateName]);

  // Escuta inputs do formulário de candidatura (ex: nome do candidato digitado pela Vanessa)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const detectName = (e: Event) => {
      const target = e.target as HTMLInputElement | null;
      if (!target || !target.value) return;
      const attr = `${target.name} ${target.id} ${target.placeholder || ""}`.toLowerCase();
      if (attr.includes("nome") || attr.includes("name")) {
        const val = target.value.trim();
        if (val.length >= 2 && val !== effectiveName) {
          try {
            localStorage.setItem("triagem:candidate:name", val);
          } catch {}
          setEffectiveName(val);
        }
      }
    };

    document.addEventListener("input", detectName);
    document.addEventListener("change", detectName);
    return () => {
      document.removeEventListener("input", detectName);
      document.removeEventListener("change", detectName);
    };
  }, [effectiveName]);

  // 1. Transmite presença via Local BroadcastChannel (sincronia imediata entre abas abertas)
  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
    const bc = new BroadcastChannel("triagem_radio_sync");
    const presenceKey = getTabPresenceKey();

    const sendPing = () => {
      bc.postMessage({
        type: "candidate_presence_ping",
        key: presenceKey,
        role: "candidato",
        name: effectiveName || undefined,
        path: pathname,
        slug,
        timestamp: Date.now(),
      });
    };

    sendPing();
    const interval = setInterval(sendPing, 3000);

    return () => {
      clearInterval(interval);
      try {
        bc.postMessage({
          type: "candidate_presence_bye",
          key: presenceKey,
          timestamp: Date.now(),
        });
        bc.close();
      } catch {}
    };
  }, [effectiveName, pathname, slug]);

  // 2. Transmite presença via Supabase Realtime (canal do tenant + canal global)
  useEffect(() => {
    if (!slug) return;
    let supabase: ReturnType<typeof createClient> | null = null;
    try {
      supabase = createClient();
    } catch {
      return;
    }

    const presenceKey = getTabPresenceKey();
    const channels: any[] = [];

    const tenantCh = supabase.channel(`online:${slug}`, {
      config: { presence: { key: presenceKey } },
    });
    channels.push(tenantCh);

    if (slug !== "global") {
      const globalCh = supabase.channel("online:global", {
        config: { presence: { key: presenceKey } },
      });
      channels.push(globalCh);
    }

    const payload: PresencePayload = {
      role: "candidato",
      path: pathname,
      name: effectiveName || undefined,
      isRegistered: Boolean(effectiveName),
      timestamp: Date.now(),
    };

    for (const ch of channels) {
      ch.subscribe(async (status: string) => {
        if (status === "SUBSCRIBED") {
          await ch.track(payload);
        }
      });
    }

    return () => {
      for (const ch of channels) {
        void ch.unsubscribe();
      }
    };
  }, [slug, pathname, effectiveName]);

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
  const [popoverTab, setPopoverTab] = useState<"presence" | "csat">("presence");
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

      // Notifica o Estúdio DJ e outros componentes do painel com os candidatos online em tempo real
      if (typeof window !== "undefined") {
        const cands = list
          .filter((s) => s.role === "candidato")
          .map((c) => ({
            key: c.key,
            name: c.name,
            path: c.path,
            isRegistered: c.isRegistered,
            lastSeen: Date.now(),
          }));
        (window as any).__triagem_online_candidates = cands;
        window.dispatchEvent(
          new CustomEvent("triagem:online-candidates", { detail: cands })
        );
      }
    };

    const handleCandidatesRequest = () => {
      const state = channel.presenceState<PresencePayload>();
      const cands: any[] = [];
      for (const [key, presences] of Object.entries(state)) {
        const first = presences[0];
        if (first && first.role === "candidato") {
          cands.push({
            key,
            name: first.name,
            path: first.path || "/",
            isRegistered: first.isRegistered,
            lastSeen: Date.now(),
          });
        }
      }
      if (typeof window !== "undefined") {
        (window as any).__triagem_online_candidates = cands;
        window.dispatchEvent(
          new CustomEvent("triagem:online-candidates", { detail: cands })
        );
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("triagem:request-online-candidates", handleCandidatesRequest);
    }

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
      if (typeof window !== "undefined") {
        window.removeEventListener("triagem:request-online-candidates", handleCandidatesRequest);
      }
      void channel.unsubscribe();
    };
  }, [slug, userName]);

  const candidates = sessions.filter((s) => s.role === "candidato");
  const cadastroCount = candidates.filter((s) => s.category === "cadastro").length;
  const principalCount = candidates.filter((s) => s.category === "principal").length;
  const perfilCount = candidates.filter((s) => s.category === "perfil").length;
  // Apenas candidatos contam no número online (o gestor não é contabilizado)
  const total = candidates.length;

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

      {/* Popover Detalhado com as Telas em Tempo Real & Satisfação Emojis */}
      {isOpen && (
        <div className="absolute bottom-[calc(100%+6px)] left-3 z-50 w-80 sm:w-96 rounded-2xl border border-[#e4e4e7] bg-white p-3.5 shadow-2xl animate-in fade-in zoom-in-95">
          {/* Cabeçalho com Abas */}
          <div className="flex items-center justify-between border-b border-[#f4f4f5] pb-2.5">
            <div className="flex items-center gap-1.5 bg-[#f4f4f5] p-0.5 rounded-xl text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setPopoverTab("presence")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition ${
                  popoverTab === "presence"
                    ? "bg-white text-stone-900 shadow-xs"
                    : "text-stone-500 hover:text-stone-800"
                }`}
              >
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Presença ({total})</span>
              </button>
              <button
                type="button"
                onClick={() => setPopoverTab("csat")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition ${
                  popoverTab === "csat"
                    ? "bg-white text-amber-900 shadow-xs"
                    : "text-stone-500 hover:text-stone-800"
                }`}
              >
                <span>⭐</span>
                <span>Satisfação Emojis</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-[#a1a1aa] hover:bg-[#f4f4f5] hover:text-[#0a0a0a]"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {popoverTab === "csat" ? (
            <div className="mt-3">
              <CandidateSentimentCard companySlug={slug} compact={false} />
            </div>
          ) : (
            <>
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

              {/* Cards de Resumo Rápido (Apenas Candidatos, sem gestor) */}
              <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-center">
                <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-2">
                  <span className="block text-[10px] font-semibold text-rose-700">No Cadastro</span>
                  <span className="text-base font-extrabold text-rose-950">{cadastroCount}</span>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-2">
                  <span className="block text-[10px] font-semibold text-emerald-700">Tela Principal</span>
                  <span className="text-base font-extrabold text-emerald-950">{principalCount}</span>
                </div>

                <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-2">
                  <span className="block text-[10px] font-semibold text-purple-700">No Perfil</span>
                  <span className="text-base font-extrabold text-purple-950">{perfilCount}</span>
                </div>
              </div>

              {/* Lista de Sessões Ativas (Apenas Candidatos/Visitantes) */}
              <div className="mt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
                  Candidatos Online ({candidates.length})
                </p>
                <div className="mt-1.5 max-h-44 space-y-1.5 overflow-y-auto pr-1">
                  {candidates.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#e4e4e7] p-4 text-center">
                      <p className="text-xs text-[#a1a1aa]">Nenhum candidato navegando no momento.</p>
                    </div>
                  ) : (
                    candidates.map((s, idx) => {
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
                                  : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {isCad ? (
                              <FileEdit className="size-3" />
                            ) : isPerf ? (
                              <User className="size-3" />
                            ) : (
                              <LayoutDashboard className="size-3" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-[11px] font-bold text-[#0a0a0a]">
                                {s.name ? s.name : "Visitante (sem login)"}
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
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Botão de rodapé para ver a Satisfação dos Candidatos */}
              <button
                type="button"
                onClick={() => setPopoverTab("csat")}
                className="mt-3 flex w-full items-center justify-between rounded-xl border border-amber-200 bg-amber-50/60 p-2 text-left transition hover:bg-amber-100/70"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base">⭐</span>
                  <div className="min-w-0">
                    <span className="block text-[11px] font-bold text-amber-950 truncate">
                      Ver Termômetro de Satisfação
                    </span>
                    <span className="block text-[10px] text-amber-800">
                      Votos dos candidatos em tempo real
                    </span>
                  </div>
                </div>
                <ChevronDown className="size-3.5 text-amber-700 -rotate-90 shrink-0" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
