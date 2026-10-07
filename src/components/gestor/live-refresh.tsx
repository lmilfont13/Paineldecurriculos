"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

type AiProgress = {
  states: { id: string; aiState: string }[];
  activeRuns: number;
  runsSignature: string;
};

const ANALYZING = new Set(["WAITING", "PROCESSING"]);

/**
 * Feedback vivo da IA (H1) sem re-renderizar a página em loop.
 *
 * Antes: router.refresh() a cada 5 s por até 10 min — cada tick refazia a
 * página inteira, passava pelo proxy de auth e disparava todas as queries.
 * Agora: consulta só /api/ai-status (uma query pequena) e chama
 * router.refresh() UMA vez, quando algo de fato mudou.
 *
 * - `applicationIds`: candidaturas em análise na tela.
 * - `watchActiveRuns`: tela de agentes — atualiza quando uma execução ativa
 *   muda de etapa (`initialSignature` = como estavam ao renderizar).
 */
export function LiveRefresh({
  active,
  applicationIds = [],
  watchActiveRuns = false,
  initialSignature = "",
  intervalMs = 5000,
  maxMs = 600000,
}: {
  active: boolean;
  applicationIds?: string[];
  watchActiveRuns?: boolean;
  initialSignature?: string;
  intervalMs?: number;
  maxMs?: number;
}) {
  const router = useRouter();
  const idsKey = applicationIds.join(",");

  useEffect(() => {
    if (!active) return;
    if (!idsKey && !watchActiveRuns) return;

    const startedAt = Date.now();
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;

    const schedule = () => {
      if (stopped) return;
      const elapsed = Date.now() - startedAt;
      if (elapsed > maxMs) return;
      // Depois do primeiro minuto, consulta com metade da frequência.
      timer = setTimeout(tick, elapsed > 60_000 ? intervalMs * 2 : intervalMs);
    };

    const tick = async () => {
      if (stopped) return;
      if (document.visibilityState !== "visible") return schedule();

      controller = new AbortController();
      try {
        const res = await fetch(
          `/api/ai-status?ids=${encodeURIComponent(idsKey)}`,
          { cache: "no-store", signal: controller.signal }
        );
        if (res.status === 401) return; // sessão expirou: para de consultar
        if (!res.ok) return schedule();

        const data = (await res.json()) as AiProgress;
        const changed =
          data.states.some((s) => !ANALYZING.has(s.aiState)) ||
          (watchActiveRuns && data.runsSignature !== initialSignature);

        if (changed) {
          stopped = true;
          router.refresh(); // uma vez, só porque o estado mudou
          return;
        }
      } catch {
        if (stopped) return;
      }
      schedule();
    };

    schedule();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      controller?.abort();
    };
  }, [active, idsKey, watchActiveRuns, initialSignature, intervalMs, maxMs, router]);

  return null;
}
