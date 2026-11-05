"use client";

import { useEffect } from "react";

import {
  ATTRIBUTION_COOKIE,
  REFERRER_COOKIE,
  detectSourceFromHeaders,
  extractAttribution,
} from "@/server/models/attribution.model";

/**
 * Captura no navegador a origem real de onde o candidato veio:
 * - Parâmetros de URL (?origem=telegram, ?origem=instagram, ?utm_source=..., ?ref=...)
 * - document.referrer (incluindo android-app://org.telegram.messenger, t.me, l.instagram.com, wa.me)
 * - navigator.userAgent (WebViews internos do Instagram, Telegram, WhatsApp, LinkedIn, TikTok)
 * - Caso não venha de nenhuma rede externa, registra como "direto" (Link direto).
 */
export function AttributionTracker() {
  useEffect(() => {
    try {
      const currentUrl = new URL(window.location.href);
      const { source: urlSource, referrerCode } = extractAttribution(currentUrl);

      let externalReferer: string | null = document.referrer || null;
      if (externalReferer) {
        try {
          const refUrl = new URL(externalReferer);
          if (refUrl.hostname === window.location.hostname) {
            externalReferer = null;
          }
        } catch {
          // Mantém esquemas como android-app://org.telegram.messenger
        }
      }

      const detected =
        urlSource ??
        detectSourceFromHeaders(
          externalReferer,
          navigator.userAgent,
          currentUrl,
        );

      const existing = localStorage.getItem(ATTRIBUTION_COOKIE);

      if (detected) {
        // Se detectou uma origem específica (instagram, telegram, whatsapp, etc.), grava (ou substitui "direto")
        if (!existing || existing === "direto" || urlSource) {
          localStorage.setItem(ATTRIBUTION_COOKIE, detected);
        }
      } else if (!existing) {
        localStorage.setItem(ATTRIBUTION_COOKIE, "direto");
      }

      if (referrerCode) {
        localStorage.setItem(REFERRER_COOKIE, referrerCode);
      }
    } catch {
      // Ignora caso localStorage esteja bloqueado
    }
  }, []);

  return null;
}
