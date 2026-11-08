"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ExternalLink, Minimize2, Sparkles, ZoomIn } from "lucide-react";
import { CandidateQueueBar } from "@/components/gestor/candidate-queue-bar";

export function CandidateDetailSplitView({
  applicationId,
  candidateName,
  jobId,
  jobTitle,
  hasResume,
  latestResumeUrl,
  latestResumeSource,
  queue,
  children,
}: {
  applicationId: string;
  candidateName: string;
  jobId: string;
  jobTitle: string;
  hasResume: boolean;
  latestResumeUrl?: string | null;
  latestResumeSource?: string | null;
  queue: {
    currentPosition: number;
    total: number;
    prevId: string | null;
    nextId: string | null;
    nextPendingId: string | null;
  };
  children: ReactNode;
}) {
  const [splitView, setSplitView] = useState(false);
  const [activeResumeVersion, setActiveResumeVersion] = useState<"current" | "latest">("current");

  const effectiveResumeUrl =
    activeResumeVersion === "latest" && latestResumeUrl
      ? `/candidaturas/${applicationId}/cv?url=${encodeURIComponent(latestResumeUrl)}`
      : `/candidaturas/${applicationId}/cv`;

  useEffect(() => {
    try {
      const stored = localStorage.getItem("triagem_split_view");
      if (stored === "true" && hasResume) {
        setSplitView(true);
      }
    } catch {
      // localStorage may fail in private mode
    }
  }, [hasResume]);

  function toggleSplitView() {
    setSplitView((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("triagem_split_view", next ? "true" : "false");
      } catch {}
      return next;
    });
  }

  return (
    <div className={splitView ? "mx-auto w-full max-w-[1720px] px-2 sm:px-4" : "mx-auto w-full max-w-[1080px]"}>
      <CandidateQueueBar
        applicationId={applicationId}
        jobId={jobId}
        jobTitle={jobTitle}
        hasResume={hasResume}
        queue={queue}
        splitView={splitView}
        onToggleSplitView={toggleSplitView}
      />

      {splitView && hasResume ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
          <div className="min-w-0 lg:col-span-7 xl:col-span-6">{children}</div>

          <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] flex-col rounded-2xl border border-[#e4e4e7] bg-white shadow-sm overflow-hidden lg:flex lg:col-span-5 xl:col-span-6">
            <header className="flex h-11 items-center justify-between border-b border-[#e4e4e7] bg-[#fafaf9] px-4 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate text-xs font-semibold text-[#0a0a0a]">
                  Currículo de {candidateName.split(" ")[0]}
                </span>
                {latestResumeUrl && (
                  <div className="flex items-center gap-1 bg-[#e4e4e7]/70 p-0.5 rounded-lg text-[10px] shrink-0 font-medium">
                    <button
                      type="button"
                      onClick={() => setActiveResumeVersion("current")}
                      className={`px-2 py-0.5 rounded-md transition ${
                        activeResumeVersion === "current"
                          ? "bg-white text-[#0a0a0a] font-bold shadow-2xs"
                          : "text-[#71717a] hover:text-[#0a0a0a]"
                      }`}
                    >
                      Desta vaga
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveResumeVersion("latest")}
                      className={`px-2 py-0.5 rounded-md transition flex items-center gap-1 ${
                        activeResumeVersion === "latest"
                          ? "bg-white text-sky-800 font-bold shadow-2xs"
                          : "text-[#71717a] hover:text-[#0a0a0a]"
                      }`}
                      title={`Ver currículo corrigido/recente enviado em ${latestResumeSource || "outra vaga"}`}
                    >
                      <Sparkles className="size-2.5 text-sky-600" />
                      <span>Mais recente</span>
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={effectiveResumeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-[#71717a] hover:bg-[#e4e4e7]/50 hover:text-[#0a0a0a]"
                  title="Abrir currículo em uma nova aba"
                >
                  <ExternalLink className="size-3" />
                  <span>Nova aba</span>
                </a>
                <button
                  type="button"
                  onClick={toggleSplitView}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-[#71717a] hover:bg-[#e4e4e7]/50 hover:text-[#0a0a0a]"
                  title="Fechar visualização lado a lado (Atalho: V)"
                >
                  <Minimize2 className="size-3" />
                  <span>Fechar</span>
                </button>
              </div>
            </header>
            <div className="relative flex-1 bg-[#525659]">
              <iframe
                key={effectiveResumeUrl}
                src={`${effectiveResumeUrl}#toolbar=1&navpanes=0`}
                className="size-full border-0"
                title={`Currículo de ${candidateName}`}
              />
            </div>
          </aside>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

