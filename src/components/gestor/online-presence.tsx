"use client";

import { Users } from "lucide-react";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

type PresencePayload = {
  role: "candidato" | "equipe";
  path?: string;
};

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
 * Rastreia visitantes nas páginas públicas da empresa (/[slug]/vagas, candidatura, etc.)
 * em tempo real via Supabase Realtime Presence (zero consultas ao banco).
 */
export function PublicPresenceTracker({ slug }: { slug: string }) {
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
          path: window.location.pathname,
        } satisfies PresencePayload);
      }
    });

    return () => {
      void channel.unsubscribe();
    };
  }, [slug]);

  return null;
}

/**
 * Badge em tempo real mostrando quantas pessoas estão online agora
 * (separando candidatos visitando as vagas e membros da equipe no painel).
 */
export function OnlineCounterBadge({
  slug,
  variant = "sidebar",
}: {
  slug: string;
  variant?: "sidebar" | "topbar" | "admin";
}) {
  const [candidatesCount, setCandidatesCount] = useState(0);
  const [teamCount, setTeamCount] = useState(1);

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
      let cands = 0;
      let team = 0;
      for (const presences of Object.values(state)) {
        const first = presences[0];
        if (!first) continue;
        if (first.role === "candidato") cands += 1;
        else team += 1;
      }
      setCandidatesCount(cands);
      setTeamCount(Math.max(team, 1));
    };

    channel
      .on("presence", { event: "sync" }, syncCounts)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            role: "equipe",
            path: window.location.pathname,
          } satisfies PresencePayload);
        }
      });

    return () => {
      void channel.unsubscribe();
    };
  }, [slug]);

  const total = candidatesCount + teamCount;
  const tooltip = `${total} online agora: ${candidatesCount} candidato(s) nas vagas · ${teamCount} na equipe`;

  if (variant === "topbar") {
    return (
      <div
        title={tooltip}
        className="ml-auto flex items-center gap-2 rounded-full border border-[#e4e4e7] bg-[#fafaf9] px-3 py-1 text-[11px] font-medium text-[#0a0a0a]"
      >
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
        <span>
          <strong>{total}</strong> online
        </span>
        {candidatesCount > 0 && (
          <span className="hidden text-[#1f7a4d] sm:inline">
            ({candidatesCount} {candidatesCount === 1 ? "candidato" : "candidatos"})
          </span>
        )}
      </div>
    );
  }

  if (variant === "admin") {
    return (
      <div
        title={tooltip}
        className="mx-3 mb-2 flex items-center justify-between rounded-xl border border-[#37322e] bg-[#2a2724] px-3 py-2 text-[11px] text-[#fafaf9]"
      >
        <div className="flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <span className="font-medium">Online agora</span>
        </div>
        <span className="font-bold">{total}</span>
      </div>
    );
  }

  return (
    <div
      title={tooltip}
      className="mx-3 mb-2 flex items-center justify-between rounded-xl border border-[#e7e5e4] bg-white px-3 py-2 text-[11px] shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="relative flex size-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
        <span className="truncate font-medium text-[#0a0a0a]">
          Online agora
        </span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {candidatesCount > 0 && (
          <span className="rounded-full bg-[#e4f6ec] px-2 py-0.5 text-[10px] font-semibold text-[#1f7a4d]">
            {candidatesCount} {candidatesCount === 1 ? "nas vagas" : "nas vagas"}
          </span>
        )}
        <span className="flex items-center gap-1 rounded-full bg-[#f4f4f5] px-2 py-0.5 text-[11px] font-bold text-[#0a0a0a]">
          <Users className="size-3 text-[#71717a]" />
          {total}
        </span>
      </div>
    </div>
  );
}

