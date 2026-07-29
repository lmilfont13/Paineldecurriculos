"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Feedback vivo da IA (H1): enquanto houver análise em andamento (`active`),
 * revalida a rota periodicamente para o "Analisando…" virar score sozinho.
 * Para de atualizar assim que nada estiver pendente ou após o teto de tempo.
 */
export function LiveRefresh({
  active,
  intervalMs = 5000,
  maxMs = 600000,
}: {
  active: boolean;
  intervalMs?: number;
  maxMs?: number;
}) {
  const router = useRouter();
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (!active) return;
    startedAt.current = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - startedAt.current > maxMs) {
        clearInterval(timer);
        return;
      }
      // Só atualiza com a aba visível, para não gastar à toa.
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs, maxMs, router]);

  return null;
}
