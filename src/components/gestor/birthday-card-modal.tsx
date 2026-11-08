"use client";

import { useEffect, useState } from "react";
import {
  Award,
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

interface CorporateThemeOption {
  id: CorporateCardTheme;
  label: string;
  badge: string;
  colors: string;
  description: string;
}

const CORPORATE_THEMES: CorporateThemeOption[] = [
  {
    id: "navy",
    label: "Azul Marinho & Ouro Real",
    badge: "Mais Usado",
    colors: "bg-[#0c1a38] border-amber-400 text-amber-200",
    description: "Sóbrio, prestigioso e institucional. Ideal para felicitações corporativas formais.",
  },
  {
    id: "graphite",
    label: "Grafite Moderno & Platina",
    badge: "Minimalista",
    colors: "bg-[#18181b] border-zinc-400 text-zinc-100",
    description: "Tons neutros de ardósia e platina. Visual contemporâneo e elegante.",
  },
  {
    id: "emerald",
    label: "Esmeralda Nobre & Ouro",
    badge: "Prestige",
    colors: "bg-[#064e3b] border-emerald-400 text-emerald-200",
    description: "Verde escuro nobre associado a crescimento, solidez, saúde e realizações.",
  },
  {
    id: "clean",
    label: "Timbre Corporativo Branco",
    badge: "Clean Luxo",
    colors: "bg-white border-slate-300 text-slate-800",
    description: "Fundo branco puro com tipografia formal e detalhes em azul profundo.",
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
  const [activeTab, setActiveTab] = useState<"corporate_card" | "ai_scene">("corporate_card");

  // Estados do Card Corporativo Profissional
  const [theme, setTheme] = useState<CorporateCardTheme>("navy");
  const [displayMode, setDisplayMode] = useState<"full" | "first">("full");
  const [showAge, setShowAge] = useState<boolean>(false);
  const [customText, setCustomText] = useState<string>(
    greetingMessage || CORPORATE_MESSAGE_TEMPLATES[0].text
  );

  // Estados de IA (Aba secundária)
  const [aiStyle, setAiStyle] = useState<BirthdayAiStyle>("luxury_gold");
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiImageBase64, setAiImageBase64] = useState<string | null>(null);
  const [aiImageMime, setAiImageMime] = useState<string>("image/jpeg");
  const [aiSeed, setAiSeed] = useState<number>(() => Math.floor(Math.random() * 999999));
  const [aiError, setAiError] = useState<string | null>(null);

  // Ações
  const [downloading, setDownloading] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  const effectiveCompany = companyName || "Nossa Empresa";

  // URL do Card Corporativo
  const corporateCardUrl = `/api/birthday-card?name=${encodeURIComponent(
    name
  )}&displayMode=${displayMode}&company=${encodeURIComponent(
    effectiveCompany
  )}&theme=${theme}&age=${turningAge || ""}&showAge=${showAge ? "true" : "false"}&message=${encodeURIComponent(
    customText.trim()
  )}`;

  // URL da Foto/Cenário IA
  const aiImageUrl = `/api/birthday-image?name=${encodeURIComponent(
    name
  )}&age=${turningAge || ""}&company=${encodeURIComponent(
    effectiveCompany
  )}&style=${aiStyle}&seed=${aiSeed}`;

  // Imagem ativa para download / cópia
  const activeImageUrl =
    activeTab === "corporate_card"
      ? corporateCardUrl
      : aiImageBase64
      ? `data:${aiImageMime};base64,${aiImageBase64}`
      : aiImageUrl;

  // Gera imagem na aba de IA se o usuário alternar para ela
  const handleGenerateAiImage = async (customStyle?: BirthdayAiStyle, newSeed?: number) => {
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
      } else {
        setAiError(res.error || "Não foi possível renderizar a arte por IA.");
      }
    } catch {
      setAiError("Falha de comunicação com o motor de imagem.");
    } finally {
      setGeneratingAi(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === "ai_scene" && !aiImageBase64 && !generatingAi) {
      void handleGenerateAiImage();
    }
  }, [isOpen, activeTab]);

  // Copia a imagem direto para a área de transferência (Ctrl+V no WhatsApp Web)
  const handleCopyImage = async () => {
    try {
      let blob: Blob;
      if (activeTab === "ai_scene" && aiImageBase64) {
        const res = await fetch(`data:${aiImageMime};base64,${aiImageBase64}`);
        blob = await res.blob();
      } else {
        const res = await fetch(corporateCardUrl);
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
        } catch {
          // fallback para copiar texto
        }
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

  // Baixa o arquivo PNG/JPEG em alta definição
  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      let blob: Blob;
      if (activeTab === "ai_scene" && aiImageBase64) {
        const byteCharacters = atob(aiImageBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        blob = new Blob([new Uint8Array(byteNumbers)], { type: aiImageMime });
      } else {
        const res = await fetch(corporateCardUrl);
        blob = await res.blob();
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `card-aniversario-${name.toLowerCase().replace(/\s+/g, "-")}.png`;
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

  const handleCopyGreetingText = async () => {
    try {
      await navigator.clipboard.writeText(customText);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 3000);
    } catch {}
  };

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-800 shadow-2xs hover:bg-slate-100 hover:text-slate-950 transition"
          title={`Gerar Card Corporativo Profissional para ${name}`}
        >
          <Award className="size-4 text-slate-700" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-900 shadow-2xs hover:bg-slate-100 transition active:scale-95"
          title={`Gerar Card Corporativo Profissional de Aniversário para ${name}`}
        >
          <Award className="size-3.5 text-amber-600" />
          <span>Card Corporativo</span>
        </button>
      )}

      {/* Modal: Card Corporativo Profissional */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in"
        >
          <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">
            {/* Topo do Modal */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-slate-900 text-amber-400 shadow-xs">
                  <Award className="size-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">
                      Card Corporativo de Aniversário
                    </h3>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-800">
                      Design Institucional 1080x1080 HD
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Homenagem profissional para <strong className="text-slate-700">{name}</strong> · {effectiveCompany}
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
                onClick={() => setActiveTab("corporate_card")}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                  activeTab === "corporate_card"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <FileImage className="size-3.5 text-amber-400" />
                <span>Card Corporativo Formal (RH)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("ai_scene")}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                  activeTab === "ai_scene"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Sparkles className="size-3.5 text-amber-400" />
                <span>Cenário Artístico IA</span>
              </button>
            </div>

            {/* Corpo do Modal */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-white">
              {activeTab === "corporate_card" ? (
                /* ABA 1: CARD CORPORATIVO PROFISSIONAL (DESIGN DE RH) */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Coluna Esquerda: Preview do Card em Alta Resolução */}
                  <div className="lg:col-span-6 flex flex-col items-center">
                    <div className="relative w-full max-w-[380px] aspect-square rounded-2xl overflow-hidden border border-slate-300 shadow-xl bg-slate-950 flex items-center justify-center group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={corporateCardUrl}
                        alt={`Card de Aniversário Corporativo para ${name}`}
                        className="w-full h-full object-cover transition duration-300"
                      />
                      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none opacity-90">
                        <span className="rounded-full bg-black/75 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-xs">
                          {CORPORATE_THEMES.find((t) => t.id === theme)?.label}
                        </span>
                        <span className="rounded-full bg-amber-500/90 px-2 py-1 text-[10px] font-bold text-white shadow-xs">
                          PNG 1080×1080
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 text-center mt-3">
                      Design refinado de RH, sem balões ou taças de festa. Pronto para envio corporativo.
                    </p>
                  </div>

                  {/* Coluna Direita: Painel de Customização Executiva */}
                  <div className="lg:col-span-6 space-y-5">
                    {/* 1. Escolha do Tema Corporativo */}
                    <div>
                      <label className="text-xs font-bold text-slate-900 flex items-center justify-between mb-2">
                        <span>Padrão Visual Executivo:</span>
                        <span className="text-[10px] font-normal text-slate-500">
                          Selecione o estilo da empresa
                        </span>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {CORPORATE_THEMES.map((item) => {
                          const isSelected = theme === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setTheme(item.id)}
                              className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                                isSelected
                                  ? "border-slate-900 bg-slate-50 ring-2 ring-slate-900/15 shadow-2xs"
                                  : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className="text-xs font-bold text-slate-900 leading-tight">
                                  {item.label}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 line-clamp-2 leading-tight">
                                {item.description}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2. Formato do Nome e Opções de Exibição */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <Type className="size-3.5 text-slate-700" />
                          <span>Formato do Nome no Card:</span>
                        </label>
                        <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-[11px] font-semibold">
                          <button
                            type="button"
                            onClick={() => setDisplayMode("full")}
                            className={`rounded-md px-2.5 py-1 transition ${
                              displayMode === "full"
                                ? "bg-slate-900 text-white shadow-2xs"
                                : "text-slate-600 hover:text-slate-900"
                            }`}
                          >
                            Nome Completo
                          </button>
                          <button
                            type="button"
                            onClick={() => setDisplayMode("first")}
                            className={`rounded-md px-2.5 py-1 transition ${
                              displayMode === "first"
                                ? "bg-slate-900 text-white shadow-2xs"
                                : "text-slate-600 hover:text-slate-900"
                            }`}
                          >
                            Primeiro Nome
                          </button>
                        </div>
                      </div>

                      {/* Exibir Idade? (Muitos preferem ocultar em contexto formal) */}
                      {Boolean(turningAge) && (
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 pt-1">
                          <input
                            type="checkbox"
                            checked={showAge}
                            onChange={(e) => setShowAge(e.target.checked)}
                            className="size-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                          />
                          <span>
                            Exibir marco de idade no card (<strong>{turningAge} anos</strong>)
                          </span>
                        </label>
                      )}
                    </div>

                    {/* 3. Mensagem Formal de RH */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-900">
                          Mensagem Formal de Felicitação:
                        </label>
                        <span className="text-[10px] text-slate-500">
                          Modelos rápidos de RH:
                        </span>
                      </div>

                      {/* Botões Rápidos de Modelos */}
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {CORPORATE_MESSAGE_TEMPLATES.map((tmpl) => (
                          <button
                            key={tmpl.id}
                            type="button"
                            onClick={() => setCustomText(tmpl.text)}
                            className="rounded-lg border border-slate-200 bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-200 hover:text-slate-900 transition"
                          >
                            {tmpl.label}
                          </button>
                        ))}
                      </div>

                      <textarea
                        rows={3}
                        value={customText}
                        onChange={(e) => setCustomText(e.target.value)}
                        placeholder="Edite a mensagem institucional..."
                        className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-900 leading-relaxed outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 resize-none shadow-2xs"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* ABA 2: CENÁRIO ARTÍSTICO IA (OPCIONAL) */
                <div className="space-y-5">
                  <div>
                    <label className="text-xs font-bold text-slate-900 block mb-2">
                      Estilo do Cenário Artístico Gerado por IA:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {(Object.keys(BIRTHDAY_AI_STYLES) as BirthdayAiStyle[]).map((styleKey) => {
                        const styleInfo = BIRTHDAY_AI_STYLES[styleKey];
                        const isSelected = aiStyle === styleKey;
                        return (
                          <button
                            key={styleKey}
                            type="button"
                            onClick={() => {
                              setAiStyle(styleKey);
                              void handleGenerateAiImage(styleKey);
                            }}
                            disabled={generatingAi}
                            className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                              isSelected
                                ? "border-slate-900 bg-slate-50 ring-2 ring-slate-900/15 shadow-2xs"
                                : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                            }`}
                          >
                            <span className="text-xl mb-1">{styleInfo.emoji}</span>
                            <div>
                              <p className="text-xs font-bold text-slate-900 line-clamp-1">
                                {styleInfo.label.split("(")[0]}
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

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-6 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                    <div className="relative shrink-0 shadow-2xl rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 w-full max-w-[320px] aspect-square flex items-center justify-center">
                      {generatingAi ? (
                        <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                          <Loader2 className="size-8 animate-spin text-amber-400" />
                          <p className="text-xs font-bold text-white">
                            Renderizando arte visual por IA...
                          </p>
                        </div>
                      ) : aiImageBase64 ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`data:${aiImageMime};base64,${aiImageBase64}`}
                            alt={`Arte visual de Aniversário por IA para ${name}`}
                            className="w-full h-full object-cover"
                          />
                        </>
                      ) : (
                        <div className="text-center p-4 text-xs text-slate-400">
                          Carregando arte comemorativa...
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-3 w-full">
                      <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                        <span className="text-xs font-bold text-slate-900 block mb-1">
                          {BIRTHDAY_AI_STYLES[aiStyle].label}
                        </span>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {BIRTHDAY_AI_STYLES[aiStyle].description}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleGenerateAiImage(aiStyle)}
                        disabled={generatingAi}
                        className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-900 shadow-2xs hover:bg-slate-50 transition active:scale-98 disabled:opacity-50"
                      >
                        <RefreshCw className={`size-3.5 ${generatingAi ? "animate-spin" : ""}`} />
                        <span>{generatingAi ? "Gerando..." : "Nova Variação da IA"}</span>
                      </button>
                    </div>
                  </div>

                  {aiError && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                      {aiError}
                    </div>
                  )}
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
                  title="Copia a imagem para colar direto no WhatsApp Web com Ctrl+V"
                >
                  {copiedImage ? (
                    <>
                      <Check className="size-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Card Copiado (Ctrl+V)!</span>
                    </>
                  ) : copiedText ? (
                    <>
                      <Check className="size-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Texto Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      <span>Copiar Card (Imagem)</span>
                    </>
                  )}
                </button>

                {/* Baixar Imagem PNG */}
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloading || generatingAi}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 shadow-2xs hover:bg-slate-100 transition active:scale-95 disabled:opacity-50"
                  title="Baixar card em alta resolução PNG (1080x1080)"
                >
                  {downloading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Download className="size-3.5" />
                  )}
                  <span>{downloading ? "Baixando..." : "Baixar Card PNG"}</span>
                </button>

                {/* Copiar Apenas Texto */}
                <button
                  type="button"
                  onClick={handleCopyGreetingText}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-100 transition"
                  title="Copiar texto formal de felicitação"
                >
                  <Type className="size-3.5 text-slate-500" />
                  <span>Copiar Mensagem</span>
                </button>
              </div>

              {/* Botão de Abrir WhatsApp */}
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition active:scale-95"
                  title="Abre a conversa no WhatsApp para parabenizar o aniversariante"
                >
                  <MessageCircle className="size-4" />
                  <span>Abrir no WhatsApp</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
