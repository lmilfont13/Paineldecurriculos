"use client";

import { useState } from "react";
import { Check, FileCheck2, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { syncApplicationResumeAction } from "@/server/controllers/gestor.controller";
import { Toast } from "@/components/gestor/toast";

export interface LatestResumeInfoProp {
  hasNewerResume: boolean;
  latestResumeUrl: string;
  latestResumeText?: string | null;
  sourceTitle: string;
  sourceApplicationId?: string;
  updatedAt?: Date;
}

export function SyncResumeBanner({
  applicationId,
  candidateName,
  latestResumeInfo,
  onViewLatest,
}: {
  applicationId: string;
  candidateName: string;
  latestResumeInfo: LatestResumeInfoProp | null;
  onViewLatest?: () => void;
}) {
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (!latestResumeInfo || !latestResumeInfo.hasNewerResume || synced) {
    return null;
  }

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await syncApplicationResumeAction(applicationId);
      if (res.ok) {
        setSynced(true);
        setToastMessage(res.message || "Currículo sincronizado e reanálise solicitada!");
      } else {
        setToastMessage(res.error || "Não foi possível sincronizar o currículo.");
      }
    } catch {
      setToastMessage("Erro ao sincronizar currículo.");
    } finally {
      setSyncing(false);
    }
  };

  const firstName = candidateName.split(" ")[0];

  return (
    <>
      <section className="mt-4 rounded-2xl border border-sky-200 bg-linear-to-r from-sky-50 via-indigo-50/40 to-blue-50/60 p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="flex items-start sm:items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 border border-sky-200 text-sky-700">
              <FileCheck2 className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-sky-600 px-2 py-0.2 text-[10px] font-bold uppercase tracking-wider text-white flex items-center gap-1">
                  <Sparkles className="size-2.5" />
                  Currículo Atualizado
                </span>
                <h3 className="text-xs font-bold text-sky-950">
                  Nova versão disponível no cadastro
                </h3>
              </div>
              <p className="mt-1 text-xs text-sky-900 leading-relaxed">
                Identificamos que <strong>{firstName}</strong> possui uma versão corrigida/mais recente enviada em{" "}
                <span className="font-semibold underline underline-offset-2">{latestResumeInfo.sourceTitle}</span>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            {onViewLatest && (
              <button
                type="button"
                onClick={onViewLatest}
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-sky-300 bg-white px-3 text-xs font-semibold text-sky-800 shadow-2xs hover:bg-sky-50 active:scale-95 transition"
              >
                Ver na lateral
              </button>
            )}
            <button
              type="button"
              disabled={syncing}
              onClick={handleSync}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 text-xs font-semibold text-white shadow-2xs hover:bg-sky-700 active:scale-95 transition disabled:opacity-60"
            >
              {syncing ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Sincronizando…</span>
                </>
              ) : (
                <>
                  <RefreshCw className="size-3.5" />
                  <span>Sincronizar nesta vaga</span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {toastMessage && (
        <Toast
          message={toastMessage}
          onDone={() => setToastMessage(null)}
          durationMs={4500}
        />
      )}
    </>
  );
}
