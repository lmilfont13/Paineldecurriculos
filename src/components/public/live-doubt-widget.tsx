"use client";

import { CheckCircle2, HelpCircle, MessageSquare, Send, Sparkles, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { submitLiveDoubtAction } from "@/server/controllers/live-doubt.controller";
import type { LiveDoubt } from "@/server/models/live-doubt.model";

export function LiveDoubtWidget({
  companySlug,
  companyName,
  candidateName,
  candidateEmail,
}: {
  companySlug: string;
  companyName: string;
  candidateName?: string | null;
  candidateEmail?: string | null;
}) {
  const pathname = usePathname();
  const [isAdminOnline, setIsAdminOnline] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState(false);

  // Formulário
  const [name, setName] = useState<string>(() => {
    if (candidateName?.trim()) return candidateName.trim();
    if (typeof window !== "undefined") {
      return localStorage.getItem("triagem:candidate:name") || "";
    }
    return "";
  });
  const [contact, setContact] = useState<string>(() => {
    if (candidateEmail?.trim()) return candidateEmail.trim();
    if (typeof window !== "undefined") {
      return localStorage.getItem("triagem:candidate:contact") || "";
    }
    return "";
  });
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [myDoubt, setMyDoubt] = useState<LiveDoubt | null>(null);
  const [hasNewAnswer, setHasNewAnswer] = useState(false);

  // Atualiza nome se a prop mudar
  useEffect(() => {
    if (candidateName?.trim()) setName(candidateName.trim());
    if (candidateEmail?.trim() && !contact) setContact(candidateEmail.trim());
  }, [candidateName, candidateEmail]);

  // Recupera última dúvida da sessão local
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = sessionStorage.getItem(`triagem:doubt:${companySlug}`);
      if (stored) {
        setMyDoubt(JSON.parse(stored));
      }
    } catch {}
  }, [companySlug]);

  // 1. Monitora presença do Administrador via BroadcastChannel e Supabase Realtime
  useEffect(() => {
    if (!companySlug) return;

    // A. BroadcastChannel local (abas no mesmo navegador)
    let bc: BroadcastChannel | null = null;
    let localCheckInterval: any = null;
    let lastAdminPing = 0;

    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      bc = new BroadcastChannel("triagem_radio_sync");
      bc.onmessage = (e) => {
        const data = e.data;
        if (!data) return;
        if (data.type === "admin_attendance_toggle") {
          const active = Boolean(data.active);
          setIsAdminOnline(active);
          if (active) lastAdminPing = Date.now();
          else lastAdminPing = 0;
        } else if (data.type === "admin_presence_ping" || data.role === "equipe") {
          lastAdminPing = Date.now();
          setIsAdminOnline(true);
        } else if (data.type === "admin_presence_bye") {
          lastAdminPing = 0;
          setIsAdminOnline(false);
        } else if (data.type === "doubt_answered" && data.doubt) {
          if (myDoubt && myDoubt.id === data.doubt.id) {
            setMyDoubt(data.doubt);
            setHasNewAnswer(true);
            try {
              sessionStorage.setItem(`triagem:doubt:${companySlug}`, JSON.stringify(data.doubt));
            } catch {}
          }
        }
      };

      localCheckInterval = setInterval(() => {
        if (lastAdminPing > 0 && Date.now() - lastAdminPing > 10000) {
          // Mais de 10s sem ping do gestor local
          lastAdminPing = 0;
          setIsAdminOnline(false);
        }
      }, 3000);
    }

    // B. Supabase Realtime (remoto / cross-device)
    let supabase: ReturnType<typeof createClient> | null = null;
    let channel: any = null;

    try {
      supabase = createClient();
      channel = supabase.channel(`online:${companySlug}`);

      const checkRemotePresence = () => {
        const state = channel.presenceState();
        let adminFound = false;
        for (const presences of Object.values(state) as any[]) {
          if (Array.isArray(presences) && presences.some((p: any) => p.role === "equipe")) {
            adminFound = true;
            break;
          }
        }
        setIsAdminOnline((prev) => adminFound || prev);
      };

      channel
        .on("presence", { event: "sync" }, checkRemotePresence)
        .on("presence", { event: "join" }, checkRemotePresence)
        .on("presence", { event: "leave" }, checkRemotePresence)
        .on("broadcast", { event: "doubt_answered" }, (e: any) => {
          if (e?.payload?.doubt) {
            const answeredDoubt = e.payload.doubt as LiveDoubt;
            setMyDoubt((curr) => {
              if (curr && curr.id === answeredDoubt.id) {
                setHasNewAnswer(true);
                try {
                  sessionStorage.setItem(
                    `triagem:doubt:${companySlug}`,
                    JSON.stringify(answeredDoubt)
                  );
                } catch {}
                return answeredDoubt;
              }
              return curr;
            });
          }
        })
        .subscribe();
    } catch {}

    return () => {
      if (bc) {
        bc.close();
      }
      if (localCheckInterval) {
        clearInterval(localCheckInterval);
      }
      if (channel) {
        void channel.unsubscribe();
      }
    };
  }, [companySlug, myDoubt]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !question.trim() || submitting) return;

    setSubmitting(true);
    try {
      // Salva no storage local
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("triagem:candidate:name", name.trim());
          if (contact.trim()) localStorage.setItem("triagem:candidate:contact", contact.trim());
        } catch {}
      }

      const res = await submitLiveDoubtAction({
        companySlug,
        candidateName: name.trim(),
        contact: contact.trim() || null,
        question: question.trim(),
        path: pathname,
      });

      if (res.ok && res.doubt) {
        setMyDoubt(res.doubt);
        setQuestion("");
        setHasNewAnswer(false);

        if (typeof window !== "undefined") {
          try {
            sessionStorage.setItem(
              `triagem:doubt:${companySlug}`,
              JSON.stringify(res.doubt)
            );
          } catch {}

          // Notifica canais em tempo real para o gestor
          if ("BroadcastChannel" in window) {
            const bc = new BroadcastChannel("triagem_radio_sync");
            bc.postMessage({
              type: "new_doubt",
              doubt: res.doubt,
              timestamp: Date.now(),
            });
            bc.close();
          }
        }
      }
    } catch {
      // Falha de envio
    } finally {
      setSubmitting(false);
    }
  };

  const resetDoubt = () => {
    setMyDoubt(null);
    setHasNewAnswer(false);
    try {
      sessionStorage.removeItem(`triagem:doubt:${companySlug}`);
    } catch {}
  };

  return (
    <>
      {/* Botão Flutuante (Tire Dúvidas com o RH) */}
      <div className="fixed bottom-20 right-4 z-40 sm:bottom-22 sm:right-6">
        <button
          type="button"
          onClick={() => {
            setIsOpen((o) => !o);
            setHasNewAnswer(false);
          }}
          className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold shadow-lg transition-all active:scale-95 ${
            isAdminOnline
              ? "bg-[#0a0a0a] text-white hover:bg-stone-800 ring-2 ring-emerald-400/50"
              : "bg-white text-stone-700 border border-stone-200 hover:bg-stone-50"
          }`}
          title={
            isAdminOnline
              ? "Recrutador online agora! Clique para tirar dúvidas"
              : "Deixe sua dúvida com a equipe de recrutamento"
          }
        >
          <span className="relative flex size-2.5 shrink-0">
            {isAdminOnline ? (
              <>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
              </>
            ) : (
              <span className="relative inline-flex size-2.5 rounded-full bg-stone-300" />
            )}
          </span>

          <span className="flex items-center gap-1.5">
            {hasNewAnswer ? (
              <span className="font-bold text-emerald-400">Nova resposta do RH!</span>
            ) : isAdminOnline ? (
              <>
                <span>Recrutador Online</span>
                <span className="hidden sm:inline font-normal text-stone-300">
                  • Tire sua dúvida
                </span>
              </>
            ) : (
              <span>Dúvidas? Fale com o RH</span>
            )}
          </span>

          <MessageSquare className="size-3.5 opacity-80" />
        </button>
      </div>

      {/* Caixa de Diálogo de Dúvidas ao Vivo */}
      {isOpen && (
        <div className="fixed bottom-32 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-stone-200 bg-white p-4 shadow-2xl transition-all sm:bottom-34 sm:right-6">
          {/* Topo */}
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-xl bg-stone-100 text-stone-800">
                <HelpCircle className="size-4" />
              </span>
              <div>
                <h4 className="text-xs font-bold text-stone-900">
                  Dúvidas sobre a Vaga ou Processo
                </h4>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span
                    className={`size-1.5 rounded-full ${
                      isAdminOnline ? "bg-emerald-500 animate-pulse" : "bg-stone-400"
                    }`}
                  />
                  <span className={isAdminOnline ? "text-emerald-700 font-semibold" : "text-stone-500"}>
                    {isAdminOnline
                      ? "Equipe de RH online agora"
                      : "Equipe ausente no momento"}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex size-6 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {/* Conteúdo: Se já enviou dúvida ou novo formulário */}
          {myDoubt ? (
            <div className="mt-3 space-y-3">
              {/* Pergunta Enviada */}
              <div className="rounded-xl border border-stone-100 bg-stone-50 p-3 text-xs text-stone-700">
                <p className="font-semibold text-stone-900 text-[11px] mb-1">
                  Sua dúvida ({myDoubt.candidateName}):
                </p>
                <p className="leading-relaxed">{myDoubt.question}</p>
                <span className="mt-1 block text-[9px] text-stone-400">
                  Enviada {new Date(myDoubt.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>

              {/* Status da Resposta */}
              {myDoubt.status === "answered" && myDoubt.answer ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-950 animate-in fade-in">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800 text-[11px] mb-1">
                    <CheckCircle2 className="size-3.5 text-emerald-600" />
                    <span>Resposta do Recrutador ({myDoubt.answeredBy || companyName}):</span>
                  </div>
                  <p className="leading-relaxed font-medium">{myDoubt.answer}</p>
                  {myDoubt.answeredAt && (
                    <span className="mt-1 block text-[9px] text-emerald-600/80">
                      Respondido às {new Date(myDoubt.answeredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <span className="size-2 rounded-full bg-amber-500 animate-ping" />
                    <span>Dúvida recebida pela equipe!</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-amber-800">
                    {isAdminOnline
                      ? "O recrutador foi avisado e já está digitando a resposta para você..."
                      : "Assim que o recrutador estiver online ou visualizar sua dúvida, você verá a resposta aqui."}
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={resetDoubt}
                className="w-full rounded-lg border border-stone-200 py-1.5 text-center text-[11px] font-semibold text-stone-600 hover:bg-stone-50 transition"
              >
                Tirar outra dúvida
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-3 space-y-2.5">
              <p className="text-[11px] text-stone-500 leading-tight">
                {isAdminOnline
                  ? "Envie sua pergunta e receba a resposta do recrutador em tempo real nesta janela."
                  : "Deixe sua dúvida com seu WhatsApp ou e-mail para que a equipe te responda assim que retornar."}
              </p>

              <div>
                <label className="block text-[10px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Seu Nome *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Vanessa Souza"
                  className="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-900 outline-none focus:border-stone-900 transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                  WhatsApp ou E-mail (opcional)
                </label>
                <input
                  type="text"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="Para te avisar se fechar a página"
                  className="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-900 outline-none focus:border-stone-900 transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Sua Pergunta / Dúvida *
                </label>
                <textarea
                  required
                  rows={3}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ex: Gostaria de saber mais sobre a carga horária ou benefícios dessa vaga..."
                  className="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-900 outline-none focus:border-stone-900 transition resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={!name.trim() || !question.trim() || submitting}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#0a0a0a] py-2 text-xs font-bold text-white shadow-xs transition hover:bg-stone-800 disabled:opacity-50 active:scale-98"
              >
                {submitting ? (
                  <span>Enviando...</span>
                ) : (
                  <>
                    <Send className="size-3" />
                    <span>Enviar Dúvida {isAdminOnline ? "ao Vivo" : "ao RH"}</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      )}
    </>
  );
}

