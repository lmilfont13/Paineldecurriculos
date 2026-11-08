"use client";

import { useState } from "react";
import { Check, Copy, Download, Image as ImageIcon, Loader2, MessageCircle, Sparkles, X } from "lucide-react";

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
  const [theme, setTheme] = useState<"gold" | "party" | "elegant">("gold");
  const [customText, setCustomText] = useState(greetingMessage || "");
  const [downloading, setDownloading] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const effectiveCompany = companyName || "Nossa Empresa";

  // Monta a URL dinâmica da imagem do cartão
  const params = new URLSearchParams({
    name,
    age: turningAge ? String(turningAge) : "",
    company: effectiveCompany,
    theme,
  });
  if (customText.trim() && customText.trim() !== greetingMessage) {
    params.set("message", customText.trim());
  }
  const imageUrl = `/api/birthday-card?${params.toString()}`;

  // Baixa o PNG em alta resolução
  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cartao-aniversario-${name.toLowerCase().replace(/\s+/g, "-")}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      window.open(imageUrl, "_blank");
    } finally {
      setDownloading(false);
    }
  };

  // Copia a imagem diretamente para a área de transferência (Ctrl+V no WhatsApp Web)
  const handleCopyImage = async () => {
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      if (typeof window !== "undefined" && "ClipboardItem" in window && navigator.clipboard) {
        await navigator.clipboard.write([
          new ClipboardItem({
            [blob.type || "image/png"]: blob,
          }),
        ]);
        setCopiedImage(true);
        setTimeout(() => setCopiedImage(false), 3000);
      } else {
        // Fallback: copia o link
        await navigator.clipboard.writeText(`${window.location.origin}${imageUrl}`);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 3000);
      }
    } catch {
      // Se a cópia de binário falhar (permissões), copia o link
      try {
        await navigator.clipboard.writeText(`${window.location.origin}${imageUrl}`);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 3000);
      } catch {}
    }
  };

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#e4e4e7] bg-white text-[#52525b] shadow-2xs hover:bg-[#fafaf9] hover:text-[#0a0a0a] transition"
          title={`Gerar cartão de aniversário comemorativo para ${name}`}
        >
          <ImageIcon className="size-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-1.5 text-[11px] font-bold text-amber-900 shadow-2xs hover:bg-amber-100 transition"
          title={`Gerar cartão comemorativo com imagem para ${name}`}
        >
          <Sparkles className="size-3.5 text-amber-700" />
          <span>Gerar Cartão</span>
        </button>
      )}

      {/* Modal / Diálogo do Cartão */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in"
        >
          <div className="w-full max-w-2xl rounded-2xl border border-[#e4e4e7] bg-white shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
            {/* Topo */}
            <div className="flex items-center justify-between border-b border-[#e4e4e7] px-6 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                  <ImageIcon className="size-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[#0a0a0a]">
                    Cartão de Aniversário Personalizado
                  </h3>
                  <p className="text-[11px] text-[#71717a]">
                    Para {name} {turningAge ? `(${turningAge} anos)` : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex size-7 items-center justify-center rounded-lg text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#0a0a0a] transition"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Conteúdo */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Pré-visualização da Imagem */}
              <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start justify-center bg-[#fafaf9] p-4 rounded-2xl border border-[#e4e4e7]">
                <div className="relative shrink-0 shadow-xl rounded-2xl overflow-hidden border border-[#e4e4e7] bg-black max-w-[260px] sm:max-w-[280px] w-full aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt={`Cartão de Aniversário para ${name}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-bold text-white backdrop-blur-xs">
                    HD 1080x1080
                  </div>
                </div>

                <div className="flex-1 space-y-4 w-full">
                  {/* Seletor de Temas */}
                  <div>
                    <label className="text-xs font-bold text-[#0a0a0a] block mb-1.5">
                      Estilo Visual do Cartão:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setTheme("gold")}
                        className={`p-2 rounded-xl border text-center text-xs transition ${
                          theme === "gold"
                            ? "border-amber-500 bg-amber-50 font-bold text-amber-950 ring-2 ring-amber-400/30"
                            : "border-[#e4e4e7] bg-white text-[#52525b] hover:bg-[#fafaf9]"
                        }`}
                      >
                        <span className="block text-base mb-0.5">🌟</span>
                        <span>Dourado</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTheme("party")}
                        className={`p-2 rounded-xl border text-center text-xs transition ${
                          theme === "party"
                            ? "border-pink-500 bg-pink-50 font-bold text-pink-950 ring-2 ring-pink-400/30"
                            : "border-[#e4e4e7] bg-white text-[#52525b] hover:bg-[#fafaf9]"
                        }`}
                      >
                        <span className="block text-base mb-0.5">🎉</span>
                        <span>Festa</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTheme("elegant")}
                        className={`p-2 rounded-xl border text-center text-xs transition ${
                          theme === "elegant"
                            ? "border-emerald-500 bg-emerald-50 font-bold text-emerald-950 ring-2 ring-emerald-400/30"
                            : "border-[#e4e4e7] bg-white text-[#52525b] hover:bg-[#fafaf9]"
                        }`}
                      >
                        <span className="block text-base mb-0.5">💎</span>
                        <span>Esmeralda</span>
                      </button>
                    </div>
                  </div>

                  {/* Mensagem do Cartão */}
                  <div>
                    <label className="text-xs font-bold text-[#0a0a0a] block mb-1">
                      Mensagem de Felicitação no Cartão:
                    </label>
                    <textarea
                      rows={3}
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      placeholder="Escreva a mensagem personalizada do cartão..."
                      className="w-full rounded-xl border border-[#e4e4e7] bg-white p-2.5 text-xs text-[#0a0a0a] outline-none focus:border-[#0a0a0a] resize-none leading-relaxed"
                    />
                    <span className="text-[10px] text-[#71717a] mt-0.5 block">
                      A imagem atualiza automaticamente enquanto você altera.
                    </span>
                  </div>
                </div>
              </div>

              {/* Informação Rápida de Envio no WhatsApp */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-950 flex items-start gap-2.5">
                <span className="text-base shrink-0">💡</span>
                <div>
                  <p className="font-bold">Dica de envio pelo WhatsApp Web:</p>
                  <p className="text-[11px] text-emerald-900 mt-0.5 leading-relaxed">
                    Clique em <strong>Copiar Imagem</strong> abaixo e, ao abrir a conversa no WhatsApp, basta dar <strong>Ctrl + V</strong> para colar a imagem diretamente com a mensagem!
                  </p>
                </div>
              </div>
            </div>

            {/* Rodapé de Ações */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e4e4e7] bg-[#fafaf9] px-6 py-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyImage}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#e4e4e7] bg-white px-3.5 py-2 text-xs font-bold text-[#0a0a0a] shadow-2xs hover:bg-[#f4f4f5] transition"
                  title="Copia a imagem para colar no WhatsApp Web com Ctrl+V"
                >
                  {copiedImage ? (
                    <>
                      <Check className="size-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Imagem Copiada!</span>
                    </>
                  ) : copiedLink ? (
                    <>
                      <Check className="size-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Link Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      <span>Copiar Imagem</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#e4e4e7] bg-white px-3.5 py-2 text-xs font-bold text-[#0a0a0a] shadow-2xs hover:bg-[#f4f4f5] transition disabled:opacity-50"
                  title="Baixar imagem em formato PNG alta resolução"
                >
                  {downloading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Download className="size-3.5" />
                  )}
                  <span>{downloading ? "Baixando..." : "Baixar PNG"}</span>
                </button>
              </div>

              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
                >
                  <MessageCircle className="size-4" />
                  <span>Abrir WhatsApp & Felicitar</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
