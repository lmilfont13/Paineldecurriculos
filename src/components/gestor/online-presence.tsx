"use client";

import { Briefcase, CheckCircle2, ChevronDown, ChevronUp, FileEdit, LayoutDashboard, MessageCircle, MessageSquare, Phone, Radio, Send, Sparkles, User, Users, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { createClient } from "@/lib/supabase/client";
import { CandidateSentimentCard } from "@/components/gestor/candidate-sentiment-card";
import { getLiveDoubtsAction, answerLiveDoubtAction } from "@/server/controllers/live-doubt.controller";
import type { LiveDoubt } from "@/server/models/live-doubt.model";

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
  const [popoverTab, setPopoverTab] = useState<"presence" | "csat" | "doubts">("presence");
  const [doubts, setDoubts] = useState<LiveDoubt[]>([]);
  const [replyingDoubtId, setReplyingDoubtId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Carrega dúvidas e transmite presença da equipe aos candidatos
  useEffect(() => {
    let active = true;
    void getLiveDoubtsAction().then((list) => {
      if (active && Array.isArray(list)) setDoubts(list);
    });

    let bc: BroadcastChannel | null = null;
    let pingInterval: any = null;

    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      bc = new BroadcastChannel("triagem_radio_sync");

      const sendAdminPing = () => {
        bc?.postMessage({
          type: "admin_presence_ping",
          role: "equipe",
          userName,
          timestamp: Date.now(),
        });
      };
      sendAdminPing();
      pingInterval = setInterval(sendAdminPing, 3000);

      bc.onmessage = (e) => {
        const data = e.data;
        if (!data) return;
        if (data.type === "new_doubt" && data.doubt) {
          setDoubts((prev) => [data.doubt, ...prev.filter((d) => d.id !== data.doubt.id)]);
        }
      };
    }

    return () => {
      active = false;
      if (pingInterval) clearInterval(pingInterval);
      if (bc) {
        try {
          bc.postMessage({ type: "admin_presence_bye", role: "equipe", timestamp: Date.now() });
          bc.close();
        } catch {}
      }
    };
  }, [userName]);

  const handleSendReply = async (doubtId: string) => {
    if (!replyText.trim() || sendingReply) return;
    setSendingReply(true);
    try {
      const res = await answerLiveDoubtAction({ doubtId, answer: replyText.trim() });
      if (res.ok && res.doubt) {
        setDoubts((prev) =>
          prev.map((d) => (d.id === doubtId ? res.doubt! : d))
        );
        setReplyText("");
        setReplyingDoubtId(null);

        // Notifica o canal broadcast para a aba do candidato receber ao vivo
        if (typeof window !== "undefined" && "BroadcastChannel" in window) {
          const bc = new BroadcastChannel("triagem_radio_sync");
          bc.postMessage({
            type: "doubt_answered",
            doubt: res.doubt,
            timestamp: Date.now(),
          });
          bc.close();
        }
      }
    } catch {
      // Ignora erro
    } finally {
      setSendingReply(false);
    }
  };

  // Fecha ao pressionar Esc
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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
  const pendingDoubtsCount = doubts.filter((d) => d.status === "pending").length;

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
          {pendingDoubtsCount > 0 && (
            <span className="rounded-full bg-amber-500 text-white px-1.5 py-0.2 text-[9px] font-bold animate-pulse">
              {pendingDoubtsCount} dúvida{pendingDoubtsCount > 1 ? "s" : ""}
            </span>
          )}
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
          {pendingDoubtsCount > 0 ? (
            <span className="rounded-full bg-amber-500 text-white px-2 py-0.5 text-[10px] font-bold animate-pulse">
              {pendingDoubtsCount} dúvida{pendingDoubtsCount > 1 ? "s" : ""}
            </span>
          ) : cadastroCount > 0 ? (
            <span className="rounded-full bg-[#f4f4f5] px-2 py-0.5 text-[10px] font-medium text-[#52525b]">
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

      {/* Tela Sobreposta 100% Opaca (Sem mostrar a tela de baixo) */}
      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Presença Online e Satisfação"
            className="fixed inset-0 z-[200] flex items-center justify-center bg-[#fafaf9] p-6"
          >
            <div className="w-full max-w-lg rounded-2xl border border-[#e4e4e7] bg-white p-6 shadow-sm max-h-[90vh] flex flex-col">
              {/* Cabeçalho com Abas */}
              <div className="flex items-center justify-between border-b border-[#e4e4e7] pb-3.5 shrink-0">
                <div className="flex flex-wrap items-center gap-1.5 bg-[#f4f4f5] p-1 rounded-xl text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setPopoverTab("presence")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                      popoverTab === "presence"
                        ? "bg-white text-[#0a0a0a] font-semibold shadow-2xs"
                        : "text-[#71717a] hover:text-[#0a0a0a]"
                    }`}
                  >
                    <span className="size-2 rounded-full bg-[#1f7a4d]" />
                    <span>Presença ({total})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPopoverTab("doubts")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                      popoverTab === "doubts"
                        ? "bg-white text-[#0a0a0a] font-semibold shadow-2xs"
                        : "text-[#71717a] hover:text-[#0a0a0a]"
                    }`}
                  >
                    <MessageSquare className="size-3.5 text-amber-600" />
                    <span>Dúvidas Ao Vivo</span>
                    {pendingDoubtsCount > 0 && (
                      <span className="rounded-full bg-amber-500 text-white px-1.5 py-0.2 text-[9px] font-bold animate-pulse">
                        {pendingDoubtsCount}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPopoverTab("csat")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                      popoverTab === "csat"
                        ? "bg-white text-[#0a0a0a] font-semibold shadow-2xs"
                        : "text-[#71717a] hover:text-[#0a0a0a]"
                    }`}
                  >
                    <span>Satisfação</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex h-8 items-center gap-1 rounded-lg border border-[#e4e4e7] bg-white px-2.5 text-xs font-medium text-[#52525b] hover:bg-[#f4f4f5] hover:text-[#0a0a0a]"
                >
                  <X className="size-3.5" />
                  <span>Fechar</span>
                </button>
              </div>

              {popoverTab === "csat" ? (
                <div className="mt-4 overflow-y-auto flex-1">
                  <CandidateSentimentCard companySlug={slug} compact={false} />
                </div>
              ) : popoverTab === "doubts" ? (
                <div className="mt-4 overflow-y-auto flex-1 space-y-3 pr-1">
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-950">
                    <p className="font-bold">Canal Direto com Candidatos Online</p>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Responda às dúvidas dos candidatos em tempo real enquanto eles navegam ou preenchem a candidatura.
                    </p>
                  </div>

                  {doubts.length === 0 ? (
                    <div className="py-10 text-center text-xs text-[#71717a]">
                      <MessageCircle className="size-8 mx-auto text-stone-300 mb-2" />
                      <p className="font-semibold text-stone-700">Nenhuma dúvida no momento</p>
                      <p className="text-stone-500 mt-1 max-w-xs mx-auto">
                        Quando um candidato enviar uma pergunta pelo portal com você online, ela aparecerá aqui instantaneamente.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {doubts.map((d) => {
                        const cleanPhone = d.contact?.replace(/\D/g, "");
                        const hasWhatsApp = cleanPhone && cleanPhone.length >= 10;
                        const waUrl = hasWhatsApp
                          ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(
                              `Olá ${d.candidateName}, sou do RH da empresa e vi sua dúvida no nosso portal de vagas!`
                            )}`
                          : null;

                        return (
                          <div
                            key={d.id}
                            className={`rounded-xl border p-3.5 text-xs transition ${
                              d.status === "pending"
                                ? "border-amber-200 bg-amber-50/30"
                                : "border-stone-200 bg-white"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-bold text-[#0a0a0a] truncate">
                                  {d.candidateName}
                                </span>
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                                    d.status === "pending"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-emerald-100 text-emerald-800"
                                  }`}
                                >
                                  {d.status === "pending" ? "Aguardando" : "Respondida"}
                                </span>
                              </div>
                              <span className="text-[10px] text-stone-400 shrink-0">
                                {new Date(d.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>

                            {/* Detalhe de tela / caminho */}
                            {d.path && (
                              <p className="mt-1 text-[10px] text-stone-500">
                                Página: <span className="font-mono text-stone-700">{d.path}</span>
                              </p>
                            )}

                            {/* Dúvida */}
                            <p className="mt-2 text-stone-800 font-medium leading-relaxed bg-white/80 p-2.5 rounded-lg border border-stone-100">
                              "{d.question}"
                            </p>

                            {/* Contato e Ações */}
                            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100 text-[11px]">
                              {d.contact ? (
                                <div className="flex items-center gap-2 text-stone-600">
                                  <span>Contato: {d.contact}</span>
                                  {waUrl && (
                                    <a
                                      href={waUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-emerald-700 font-bold hover:underline"
                                    >
                                      <Phone className="size-3" />
                                      <span>WhatsApp</span>
                                    </a>
                                  )}
                                </div>
                              ) : (
                                <span className="text-stone-400">Sem contato adicional</span>
                              )}

                              {d.status === "pending" && replyingDoubtId !== d.id && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyingDoubtId(d.id);
                                    setReplyText("");
                                  }}
                                  className="rounded-lg bg-[#0a0a0a] px-3 py-1 text-xs font-bold text-white hover:bg-stone-800 transition"
                                >
                                  Responder ao Vivo
                                </button>
                              )}
                            </div>

                            {/* Resposta já enviada */}
                            {d.status === "answered" && d.answer && (
                              <div className="mt-2 rounded-lg bg-emerald-50 p-2 text-emerald-900 text-[11px]">
                                <span className="font-bold">Resposta enviada ({d.answeredBy}):</span>
                                <p className="mt-0.5">{d.answer}</p>
                              </div>
                            )}

                            {/* Formulário de Resposta */}
                            {replyingDoubtId === d.id && (
                              <div className="mt-3 space-y-2 border-t border-stone-200 pt-2.5">
                                <textarea
                                  rows={2}
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  placeholder="Digite sua resposta para o candidato..."
                                  className="w-full rounded-lg border border-stone-200 p-2 text-xs outline-none focus:border-stone-900 resize-none"
                                />
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setReplyingDoubtId(null)}
                                    className="rounded-lg border border-stone-200 px-2.5 py-1 text-[11px] font-medium text-stone-600 hover:bg-stone-50"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!replyText.trim() || sendingReply}
                                    onClick={() => handleSendReply(d.id)}
                                    className="flex items-center gap-1 rounded-lg bg-[#0a0a0a] px-3 py-1 text-[11px] font-bold text-white hover:bg-stone-800 disabled:opacity-50"
                                  >
                                    <Send className="size-3" />
                                    <span>{sendingReply ? "Enviando..." : "Enviar Resposta"}</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Vagas da empresa */}
                  <div className="mt-4 flex items-center justify-between rounded-xl border border-[#e4e4e7] bg-[#fafaf9] p-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Briefcase className="size-4 text-[#71717a] shrink-0" />
                      <span className="truncate text-xs font-medium text-[#57534e]">
                        {activeJobsCount > 0 ? "Vagas ativas na empresa:" : "Vagas cadastradas:"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {jobsToday > 0 && (
                        <span className="rounded-md bg-[#e4f6ec] px-2 py-0.5 text-[11px] font-semibold text-[#1f7a4d]">
                          +{jobsToday} hoje
                        </span>
                      )}
                      <span className="rounded-md border border-[#e4e4e7] bg-white px-2.5 py-0.5 text-xs font-semibold text-[#0a0a0a]">
                        {activeJobsCount > 0 ? activeJobsCount : totalJobsCount}{" "}
                        {(activeJobsCount > 0 ? activeJobsCount : totalJobsCount) === 1 ? "vaga" : "vagas"}
                      </span>
                    </div>
                  </div>

                  {/* Cards de Resumo Rápido no Padrão Neutro do Sistema */}
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl border border-[#e4e4e7] bg-[#fafaf9] p-2.5">
                      <span className="block text-[11px] font-medium text-[#71717a]">No Cadastro</span>
                      <span className="mt-0.5 block text-base font-bold text-[#0a0a0a]">{cadastroCount}</span>
                    </div>

                    <div className="rounded-xl border border-[#e4e4e7] bg-[#fafaf9] p-2.5">
                      <span className="block text-[11px] font-medium text-[#71717a]">Tela Principal</span>
                      <span className="mt-0.5 block text-base font-bold text-[#0a0a0a]">{principalCount}</span>
                    </div>

                    <div className="rounded-xl border border-[#e4e4e7] bg-[#fafaf9] p-2.5">
                      <span className="block text-[11px] font-medium text-[#71717a]">No Perfil</span>
                      <span className="mt-0.5 block text-base font-bold text-[#0a0a0a]">{perfilCount}</span>
                    </div>
                  </div>

                  {/* Lista de Sessões Ativas */}
                  <div className="mt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
                      Candidatos Online ({candidates.length})
                    </p>
                    <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto pr-1">
                      {candidates.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-[#e4e4e7] p-5 text-center">
                          <p className="text-xs text-[#71717a]">Nenhum candidato navegando no momento.</p>
                        </div>
                      ) : (
                        candidates.map((s, idx) => {
                          const isCad = s.category === "cadastro";
                          const isPerf = s.category === "perfil";

                          return (
                            <div
                              key={s.key || idx}
                              className="flex items-center gap-2.5 rounded-xl border border-[#e4e4e7] bg-[#fafaf9] p-2.5 text-xs"
                            >
                              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-[#e4e4e7] bg-white text-[#52525b]">
                                {isCad ? (
                                  <FileEdit className="size-3.5" />
                                ) : isPerf ? (
                                  <User className="size-3.5" />
                                ) : (
                                  <LayoutDashboard className="size-3.5" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate text-xs font-semibold text-[#0a0a0a]">
                                    {s.name ? s.name : "Visitante (sem login)"}
                                  </span>
                                  {s.isRegistered && (
                                    <span className="shrink-0 rounded bg-[#e4f6ec] px-1.5 py-0.5 text-[10px] font-medium text-[#1f7a4d]">
                                      Cadastrado
                                    </span>
                                  )}
                                </div>
                                <span className="block truncate text-[11px] text-[#71717a]">
                                  {s.screenTitle}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
