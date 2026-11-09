"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Copy,
  Download,
  FileImage,
  Loader2,
  MessageCircle,
  RefreshCw,
  Sparkles,
  Type,
  X,
} from "lucide-react";
import { generateBirthdayAiImageAction } from "@/server/controllers/birthday-image.controller";
import {
  BIRTHDAY_AI_STYLES,
  type BirthdayAiStyle,
} from "@/server/models/birthday-image.model";

export type CorporateCardTheme = "navy" | "graphite" | "emerald" | "clean";

const CORPORATE_THEMES = [
  {
    id: "navy" as CorporateCardTheme,
    label: "Azul Marinho & Ouro Real",
    description: "Sóbrio, prestigioso e institucional.",
  },
  {
    id: "graphite" as CorporateCardTheme,
    label: "Grafite Moderno & Platina",
    description: "Tons neutros de ardósia e platina.",
  },
  {
    id: "emerald" as CorporateCardTheme,
    label: "Esmeralda Nobre & Ouro",
    description: "Verde escuro nobre associado a crescimento.",
  },
  {
    id: "clean" as CorporateCardTheme,
    label: "Timbre Corporativo Branco",
    description: "Fundo branco puro com tipografia formal.",
  },
];

const CORPORATE_MESSAGE_TEMPLATES = [
  {
    id: "career",
    label: "Trajetória & Sucesso",
    text: "Neste dia especial, celebramos a sua trajetória e expressamos nossa admiração por sua dedicação. Desejamos contínuo sucesso, saúde, realizações e prosperidade em cada etapa de sua jornada.",
  },
  {
    id: "recognition",
    label: "Reconhecimento & Parceria",
    text: "Parabéns pelo seu aniversário! Agradecemos pelo compromisso, talento e energia positiva que você traz para nossa equipe. Que este novo ano de vida seja marcado por grandes conquistas!",
  },
  {
    id: "growth",
    label: "Crescimento & Conquistas",
    text: "Em nome de toda a empresa, parabenizamos você por mais um ciclo. Desejamos saúde plena, sabedoria, felicidade e contínuo crescimento pessoal e profissional!",
  },
];

export function BirthdayCardButtonAndModal({
  name,
  turningAge,
  companyName,
  whatsappUrl,
  greetingMessage,
  variant = "button",
}: {
  name: string;
  turningAge?: number;
  companyName?: string;
  whatsappUrl?: string | null;
  greetingMessage?: string;
  variant?: "button" | "icon";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"ai_card" | "graphic_card">("ai_card");

  // Estados do Cartão Gerado por IA (Google Imagen)
  const [aiStyle, setAiStyle] = useState<BirthdayAiStyle>("luxury_gold");
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiImageBase64, setAiImageBase64] = useState<string | null>(null);
  const [aiImageMime, setAiImageMime] = useState<string>("image/jpeg");
  const [aiSeed, setAiSeed] = useState<number>(() => Math.floor(Math.random() * 999999));
  const [aiEngine, setAiEngine] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Estados do Card Tipográfico Alternativo
  const [graphicTheme, setGraphicTheme] = useState<CorporateCardTheme>("navy");
  const [displayMode, setDisplayMode] = useState<"full" | "first">("full");
  const [showAge, setShowAge] = useState<boolean>(false);
  const [customText, setCustomText] = useState<string>(
    CORPORATE_MESSAGE_TEMPLATES[0].text
  );
  const [graphicLoading, setGraphicLoading] = useState<boolean>(true);

  // Ações
  const [downloading, setDownloading] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fecha no Esc e bloqueia scroll de fundo enquanto o modal estiver aberto
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const effectiveCompany = companyName || "Nossa Empresa";

  // URL do Card Gráfico Tipográfico
  const graphicCardUrl = `/api/birthday-card?name=${encodeURIComponent(
    name
  )}&displayMode=${displayMode}&company=${encodeURIComponent(
    effectiveCompany
  )}&theme=${graphicTheme}&age=${turningAge || ""}&showAge=${showAge ? "true" : "false"}&message=${encodeURIComponent(
    customText.trim()
  )}`;

  // URL da Foto/Cartão IA (fallback direto via rota)
  const aiImageUrl = `/api/birthday-image?name=${encodeURIComponent(
    name
  )}&age=${turningAge || ""}&company=${encodeURIComponent(
    effectiveCompany
  )}&style=${aiStyle}&seed=${aiSeed}`;

  // Imagem ativa para download / cópia
  const activeImageUrl =
    activeTab === "ai_card"
      ? aiImageBase64
        ? `data:${aiImageMime};base64,${aiImageBase64}`
        : aiImageUrl
      : graphicCardUrl;

  // Gera o cartão de aniversário com IA (Google Imagen)
  const handleGenerateAiCard = async (customStyle?: BirthdayAiStyle, newSeed?: number) => {
    setGeneratingAi(true);
    setAiError(null);
    const useStyle = customStyle || aiStyle;
    const useSeed = newSeed ?? Math.floor(Math.random() * 999999);
    setAiSeed(useSeed);

    try {
      const res = await generateBirthdayAiImageAction({
        name,
        age: turningAge,
        companyName: effectiveCompany,
        style: useStyle,
        seed: useSeed,
      });

      if (res.ok && res.base64) {
        setAiImageBase64(res.base64);
        setAiImageMime(res.mimeType || "image/jpeg");
        setAiEngine(res.engine || "google_imagen");
      } else {
        setAiError(res.error || "Não foi possível gerar o cartão por IA.");
      }
    } catch {
      setAiError("Falha de conexão ao gerar o cartão comemorativo.");
    } finally {
      setGeneratingAi(false);
    }
  };

  // Ao abrir o modal, se não houver cartão gerado ainda, gera imediatamente
  useEffect(() => {
    if (isOpen && !aiImageBase64 && !generatingAi) {
      void handleGenerateAiCard();
    }
  }, [isOpen]);

  // URL dinâmica do WhatsApp com mensagem formatada
  const dynamicWhatsappUrl = (() => {
    if (!whatsappUrl) return null;
    try {
      const url = new URL(whatsappUrl);
      const firstName = name.trim().split(/\s+/)[0];
      const messageToSend = `Olá, ${firstName}! 🎂\n\n${customText.trim()}\n\n— *${effectiveCompany}*`;
      url.searchParams.set("text", messageToSend);
      return url.toString();
    } catch {
      return whatsappUrl;
    }
  })();

  // Copia a imagem do cartão para o clipboard (Ctrl+V no WhatsApp Web)
  const handleCopyImage = async () => {
    try {
      let blob: Blob;
      if (activeTab === "ai_card" && aiImageBase64) {
        const res = await fetch(`data:${aiImageMime};base64,${aiImageBase64}`);
        blob = await res.blob();
      } else {
        const targetUrl = activeTab === "ai_card" ? aiImageUrl : graphicCardUrl;
        const res = await fetch(targetUrl);
        blob = await res.blob();
      }

      if (typeof window !== "undefined" && "ClipboardItem" in window && navigator.clipboard) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              [blob.type || "image/png"]: blob,
            }),
          ]);
          setCopiedImage(true);
          setTimeout(() => setCopiedImage(false), 3500);
          return;
        } catch {}
      }

      await navigator.clipboard.writeText(customText);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 3000);
    } catch {
      await navigator.clipboard.writeText(customText);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 3000);
    }
  };

  // Baixa o cartão em alta resolução
  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      let blob: Blob;
      if (activeTab === "ai_card" && aiImageBase64) {
        const byteCharacters = atob(aiImageBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        blob = new Blob([new Uint8Array(byteNumbers)], { type: aiImageMime });
      } else {
        const targetUrl = activeTab === "ai_card" ? aiImageUrl : graphicCardUrl;
        const res = await fetch(targetUrl);
        blob = await res.blob();
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cartao-aniversario-${name.toLowerCase().replace(/\s+/g, "-")}.${
        activeTab === "ai_card" ? "jpg" : "png"
      }`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      window.open(activeImageUrl, "_blank");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-amber-300 bg-amber-50/80 text-amber-950 shadow-2xs hover:bg-amber-100 hover:text-amber-950 transition"
          title={`Gerar Cartão de Aniversário por IA para ${name}`}
        >
          <Sparkles className="size-4 text-amber-600" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-950 shadow-2xs hover:bg-amber-100 transition active:scale-95"
          title={`Gerar Cartão de Aniversário por IA para ${name}`}
        >
          <Sparkles className="size-3.5 text-amber-600" />
          <span>Cartão por IA</span>
        </button>
      )}

      {/* Modal: Cartão de Aniversário por IA (Renderizado via Portal na raiz do documento para não ser cortado por overflow-hidden) */}
      {isOpen &&
        mounted &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-9999 flex items-center justify-center bg-black/75 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsOpen(false);
            }}
          >
            <div
              className="relative w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col max-h-[95vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
            {/* Topo do Modal */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-slate-900 text-amber-400 shadow-xs">
                  <Sparkles className="size-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">
                      Cartão de Aniversário com IA
                    </h3>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                      Google Imagen 3 / HD 1024×1024
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Cartão comemorativo para <strong className="text-slate-700">{name}</strong> {turningAge ? `· ${turningAge} anos` : ""} · {effectiveCompany}
                  </p>
                </div>
              </div>

              {/* Botão Fechar */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition"
                aria-label="Fechar modal"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Alternador de Abas */}
            <div className="flex items-center gap-2 border-b border-slate-200 px-6 pt-3 pb-2 bg-white">
              <button
                type="button"
                onClick={() => setActiveTab("ai_card")}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                  activeTab === "ai_card"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Sparkles className="size-3.5 text-amber-400" />
                <span>Cartão Ilustrado com IA (Google Imagen)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("graphic_card")}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                  activeTab === "graphic_card"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <FileImage className="size-3.5 text-zinc-400" />
                <span>Card Tipográfico de RH</span>
              </button>
            </div>

            {/* Corpo do Modal */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-white">
              {activeTab === "ai_card" ? (
                /* ABA 1: CARTÃO ILUSTRADO GERADO POR IA (GOOGLE IMAGEN) */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Coluna Esquerda: Pré-visualização do Cartão */}
                  <div className="lg:col-span-6 flex flex-col items-center">
                    <div className="relative w-full max-w-[380px] aspect-square rounded-2xl overflow-hidden border border-slate-300 shadow-xl bg-slate-950 flex items-center justify-center">
                      {generatingAi ? (
                        <div className="flex flex-col items-center justify-center p-6 text-center space-y-3 text-white">
                          <Loader2 className="size-8 animate-spin text-amber-400" />
                          <p className="text-xs font-bold">
                            Criando cartão com Inteligência Artificial...
                          </p>
                          <p className="text-[11px] text-slate-300 max-w-xs leading-relaxed">
                            Renderizando arte comemorativa de alta definição para {name}.
                          </p>
                        </div>
                      ) : aiImageBase64 ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`data:${aiImageMime};base64,${aiImageBase64}`}
                            alt={`Cartão de Aniversário por IA para ${name}`}
                            className="w-full h-full object-cover transition duration-300"
                          />
                          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none opacity-90 z-20">
                            <span className="rounded-full bg-black/75 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-xs">
                              {BIRTHDAY_AI_STYLES[aiStyle]?.label}
                            </span>
                            <span className="rounded-full bg-amber-500/90 px-2 py-1 text-[10px] font-bold text-white shadow-xs">
                              IA 1024×1024 HD
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="text-center p-6 text-xs text-slate-400">
                          Clique em &quot;Gerar Cartão&quot; para iniciar.
                        </div>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 text-center mt-3">
                      Cartão artístico comemorativo criado por IA, pronto para enviar pelo WhatsApp.
                    </p>
                  </div>

                  {/* Coluna Direita: Opções de Estilo do Cartão */}
                  <div className="lg:col-span-6 space-y-5">
                    <div>
                      <label className="text-xs font-bold text-slate-900 block mb-2">
                        Escolha o Estilo do Cartão Comemorativo:
                      </label>
                      <div className="grid grid-cols-2 gap-2.5">
                        {(Object.keys(BIRTHDAY_AI_STYLES) as BirthdayAiStyle[]).map((styleKey) => {
                          const styleInfo = BIRTHDAY_AI_STYLES[styleKey];
                          const isSelected = aiStyle === styleKey;
                          return (
                            <button
                              key={styleKey}
                              type="button"
                              onClick={() => {
                                setAiStyle(styleKey);
                                void handleGenerateAiCard(styleKey);
                              }}
                              disabled={generatingAi}
                              className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                                isSelected
                                  ? "border-slate-900 bg-slate-50 ring-2 ring-slate-900/15 shadow-2xs"
                                  : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className="text-xl">{styleInfo.emoji}</span>
                                <span className="text-[10px] font-bold rounded-full bg-slate-100 px-1.5 py-0.5 text-slate-600">
                                  {styleInfo.badge}
                                </span>
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-900 line-clamp-1">
                                  {styleInfo.label}
                                </p>
                                <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2 leading-tight">
                                  {styleInfo.description}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Descrição do Estilo Selecionado & Botão de Regerar */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-3">
                      <div>
                        <span className="text-xs font-bold text-slate-900 block mb-1">
                          {BIRTHDAY_AI_STYLES[aiStyle]?.label}
                        </span>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {BIRTHDAY_AI_STYLES[aiStyle]?.description}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleGenerateAiCard(aiStyle)}
                        disabled={generatingAi}
                        className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-900 shadow-2xs hover:bg-slate-50 transition active:scale-98 disabled:opacity-50"
                      >
                        <RefreshCw className={`size-3.5 ${generatingAi ? "animate-spin" : ""}`} />
                        <span>
                          {generatingAi ? "Criando Cartão..." : "Gerar Outra Versão do Cartão"}
                        </span>
                      </button>
                    </div>

                    {/* Dica de Envio Prático */}
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-950 flex items-start gap-2.5">
                      <span className="text-base shrink-0">💡</span>
                      <div>
                        <p className="font-bold">Como enviar junto com o texto de parabéns:</p>
                        <p className="text-[11px] text-emerald-900 mt-0.5 leading-relaxed">
                          1. Clique em <strong>Copiar Cartão (Imagem)</strong>.<br />
                          2. Clique em <strong>Abrir no WhatsApp</strong>.<br />
                          3. Pressione <strong>Ctrl + V</strong> para colar a imagem no chat e envie com a mensagem pronta!
                        </p>
                      </div>
                    </div>

                    {aiError && (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                        {aiError}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* ABA 2: CARD TIPOGRÁFICO INSTITUCIONAL */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-6 flex flex-col items-center">
                    <div className="relative w-full max-w-[380px] aspect-square rounded-2xl overflow-hidden border border-slate-300 shadow-xl bg-slate-950 flex items-center justify-center">
                      {graphicLoading && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900/80 text-white p-4 space-y-2">
                          <Loader2 className="size-7 animate-spin text-amber-400" />
                          <p className="text-xs font-semibold">Renderizando card tipográfico...</p>
                        </div>
                      )}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        key={graphicCardUrl}
                        src={graphicCardUrl}
                        alt={`Card de Aniversário Corporativo para ${name}`}
                        className={`w-full h-full object-cover transition duration-300 ${
                          graphicLoading ? "opacity-0" : "opacity-100"
                        }`}
                        onLoad={() => setGraphicLoading(false)}
                        onError={() => setGraphicLoading(false)}
                      />
                    </div>
                  </div>

                  <div className="lg:col-span-6 space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-900 block mb-1.5">
                        Padrão do Card Tipográfico:
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {CORPORATE_THEMES.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setGraphicTheme(item.id);
                              setGraphicLoading(true);
                            }}
                            className={`p-2.5 rounded-xl border text-left text-xs font-bold transition ${
                              graphicTheme === item.id
                                ? "border-slate-900 bg-slate-50 ring-2 ring-slate-900/15"
                                : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                            }`}
                          >
                            <span className="block text-slate-900">{item.label}</span>
                            <span className="text-[10px] font-normal text-slate-500">{item.description}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-900 block mb-1.5">
                        Mensagem de Felicitação:
                      </label>
                      <textarea
                        rows={3}
                        value={customText}
                        onChange={(e) => {
                          setCustomText(e.target.value);
                          setGraphicLoading(true);
                        }}
                        className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-900 leading-relaxed outline-none focus:border-slate-900 resize-none shadow-2xs"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Rodapé de Ações Finais (Copiar Imagem, Baixar, WhatsApp) */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <div className="flex flex-wrap items-center gap-2">
                {/* Botão de Copiar Imagem (Ctrl+V no WhatsApp Web) */}
                <button
                  type="button"
                  onClick={handleCopyImage}
                  disabled={generatingAi}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 shadow-2xs hover:bg-slate-100 transition active:scale-95 disabled:opacity-50"
                  title="Copia o cartão para colar direto no WhatsApp Web com Ctrl+V"
                >
                  {copiedImage ? (
                    <>
                      <Check className="size-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Cartão Copiado (Ctrl+V)!</span>
                    </>
                  ) : copiedText ? (
                    <>
                      <Check className="size-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Texto Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      <span>Copiar Cartão (Imagem)</span>
                    </>
                  )}
                </button>

                {/* Baixar Imagem */}
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloading || generatingAi}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 shadow-2xs hover:bg-slate-100 transition active:scale-95 disabled:opacity-50"
                  title="Baixar cartão em alta resolução (1024x1024)"
                >
                  {downloading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Download className="size-3.5" />
                  )}
                  <span>{downloading ? "Baixando..." : "Baixar Cartão"}</span>
                </button>

                {/* Copiar Apenas Texto */}
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(customText);
                    setCopiedText(true);
                    setTimeout(() => setCopiedText(false), 3000);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-100 transition"
                  title="Copiar texto formal de felicitação"
                >
                  <Type className="size-3.5 text-slate-500" />
                  <span>Copiar Mensagem</span>
                </button>
              </div>

              {/* Botão de Abrir WhatsApp */}
              {dynamicWhatsappUrl && (
                <a
                  href={dynamicWhatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition active:scale-95"
                  title="Abre a conversa no WhatsApp para enviar o cartão ao aniversariante"
                >
                  <MessageCircle className="size-4" />
                  <span>Abrir no WhatsApp</span>
                </a>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
