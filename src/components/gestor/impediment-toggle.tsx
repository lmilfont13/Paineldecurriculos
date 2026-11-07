"use client";

import { useState, useTransition } from "react";
import { ShieldAlert, ShieldCheck, X } from "lucide-react";
import { toggleApplicationImpedimentAction } from "@/server/controllers/application.controller";
import { Toast } from "@/components/gestor/toast";

const PRESET_REASONS = [
  "Restrição de Compliance",
  "Histórico interno desfavorável",
  "Documentação irregular / Inconsistência",
  "Conduta incompatível com a função",
  "Conflito de interesse",
];

export function ImpedimentToggle({
  applicationId,
  candidateName,
  hasImpediment: initialHasImpediment,
  impedimentReason: initialReason,
}: {
  applicationId: string;
  candidateName: string;
  hasImpediment: boolean;
  impedimentReason?: string | null;
}) {
  const [hasImpediment, setHasImpediment] = useState(initialHasImpediment);
  const [impedimentReason, setImpedimentReason] = useState<string | null>(initialReason ?? null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [customReason, setCustomReason] = useState<string>("");
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const firstName = candidateName.split(" ")[0];

  function openModal() {
    setSelectedPreset("");
    setCustomReason(impedimentReason ?? "");
    setModalOpen(true);
  }

  function handleConfirmToggle(newStatus: boolean) {
    const finalReason = newStatus
      ? customReason.trim() || selectedPreset || "Sem motivo informado"
      : undefined;

    startTransition(async () => {
      try {
        const result = await toggleApplicationImpedimentAction(
          applicationId,
          newStatus,
          finalReason
        );
        if (!result.ok) {
          setToast(result.error ?? "Erro ao alterar impedimento.");
          return;
        }
        setHasImpediment(result.hasImpediment);
        setImpedimentReason(result.reason ?? null);
        setModalOpen(false);
        setToast(
          result.hasImpediment
            ? `Tarja Preta ativada para ${firstName}. Candidato impedido de entrevista, aprovação e IA.`
            : `Impedimento removido. ${firstName} pode avançar no processo.`
        );
      } catch {
        setToast("Falha na comunicação com o servidor.");
      }
    });
  }

  return (
    <>
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      {hasImpediment ? (
        <button
          type="button"
          onClick={openModal}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800 hover:text-white disabled:opacity-50"
        >
          <ShieldCheck className="size-3.5 text-emerald-400" />
          <span>Desmarcar Tarja Preta</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={openModal}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-800 transition hover:border-black hover:bg-zinc-50 disabled:opacity-50 shadow-xs"
        >
          <ShieldAlert className="size-3.5 text-zinc-900" />
          <span>Sinalizar Impedimento (Tarja Preta)</span>
        </button>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          onClick={() => !pending && setModalOpen(false)}
        >
          <div
            className="w-full max-w-[500px] rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-zinc-100 pb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`flex size-10 items-center justify-center rounded-xl text-lg ${
                    hasImpediment ? "bg-emerald-50 text-emerald-600" : "bg-black text-red-500"
                  }`}
                >
                  {hasImpediment ? "✓" : "⚠️"}
                </div>
                <div>
                  <h2 className="text-base font-bold text-zinc-900">
                    {hasImpediment
                      ? `Remover Impedimento de ${firstName}?`
                      : `Sinalizar Tarja Preta para ${firstName}`}
                  </h2>
                  <p className="text-xs text-zinc-500">
                    {hasImpediment
                      ? "O candidato voltará a poder ser avaliado pela IA e avançar no funil."
                      : "Impede contratação, bloqueia reanálises da IA e barra avanço para Entrevista/Aprovação."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={pending}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X className="size-4" />
              </button>
            </div>

            {!hasImpediment ? (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700">
                    Motivo do impedimento (opcional para histórico interno):
                  </label>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {PRESET_REASONS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setSelectedPreset(preset);
                          setCustomReason("");
                        }}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                          selectedPreset === preset && !customReason
                            ? "border-black bg-black text-white"
                            : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-600">
                    Ou especifique uma justificativa detalhada:
                  </label>
                  <textarea
                    rows={2}
                    value={customReason}
                    onChange={(e) => {
                      setCustomReason(e.target.value);
                      setSelectedPreset("");
                    }}
                    placeholder="Ex.: Restrição verificada no histórico de conduta ou compliance corporativo"
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-black focus:outline-none"
                  />
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 leading-relaxed">
                  <span className="font-bold">Atenção:</span> Esta ação é reversível a qualquer momento.
                  O candidato terá a tarja preta destacada em todas as visualizações do sistema.
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Ao confirmar a remoção da <strong>Tarja Preta</strong>, {firstName} poderá novamente ser chamado para entrevista, ter a candidatura aprovada e participar de reanálises da IA.
                </p>
                {impedimentReason && (
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
                    <span className="font-semibold text-zinc-900">Motivo atual:</span> {impedimentReason}
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-zinc-100 pt-4">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={pending}
                className="h-9 rounded-xl border border-zinc-300 px-4 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => handleConfirmToggle(!hasImpediment)}
                disabled={pending}
                className={`h-9 rounded-xl px-4 text-xs font-bold text-white transition disabled:opacity-50 ${
                  hasImpediment
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-black hover:bg-zinc-800"
                }`}
              >
                {pending
                  ? "Salvando…"
                  : hasImpediment
                  ? "Confirmar Remoção do Impedimento"
                  : "Confirmar Tarja Preta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

