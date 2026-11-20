"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Download, Copy, Check, Sparkles, RefreshCw, ZoomIn, Eye, Lock } from "lucide-react";
import type { SocialJobPostData } from "@/server/models/social-post.model";
import { InstagramPublishModal } from "@/components/gestor/instagram-publish-modal";

type Props = {
  data: SocialJobPostData;
  companyName?: string;
  onRandomModel?: () => void;
};

export function InstagramCanvasPreview({ data, onRandomModel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [zoomPreview, setZoomPreview] = useState(false);
  const [canvasDataUrl, setCanvasDataUrl] = useState<string>("");
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);

  // Injeta Google Fonts no documento (versão expandida com pesos pesados e condensados)
  useEffect(() => {
    if (typeof document !== "undefined") {
      const fontId = "tarhget-official-template-fonts-v3";
      if (!document.getElementById(fontId)) {
        const link = document.createElement("link");
        link.id = fontId;
        link.rel = "stylesheet";
        link.href =
          "https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;0,900;1,700;1,800&family=Barlow+Semi+Condensed:ital,wght@0,600;0,700;0,800;1,700&family=Oswald:wght@600;700&display=swap";
        document.head.appendChild(link);
      }
    }
  }, []);

  const renderCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsRendering(true);

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    // 1. Garante carregamento das Google Fonts oficiais no documento
    try {
      if (typeof document !== "undefined" && document.fonts) {
        await Promise.allSettled([
          document.fonts.load('800 48px "Barlow Condensed"'),
          document.fonts.load('800 32px "Barlow Condensed"'),
          document.fonts.load('800 26px "Barlow Condensed"'),
          document.fonts.load('800 23px "Barlow Condensed"'),
          document.fonts.load('700 22px "Barlow Condensed"'),
          document.fonts.load('700 18px "Barlow Semi Condensed"'),
          document.fonts.load('700 14px "Barlow Semi Condensed"'),
        ]);
        await document.fonts.ready;
      }
    } catch {
      // continua
    }

    const W = 1080;
    const H = 1080;
    canvas.width = W;
    canvas.height = H;

    // 2. Carrega a Imagem Mestre Oficial 100% Autêntica
    // Se a modelo for a oficial (ou padrão), usa o master-base-clean diretamente
    const isMasterModel =
      !data.modelImage ||
      data.modelImage.includes("master-base-clean") ||
      data.modelImage.includes("master-template") ||
      data.modelImage.includes("official-model");

    const baseImg = new Image();
    baseImg.crossOrigin = "anonymous";

    await new Promise<void>((resolve, reject) => {
      baseImg.onload = () => resolve();
      baseImg.onerror = () => reject(new Error("Falha ao carregar template mestre"));
      baseImg.src = "/images/templates/master-base-clean.png";
    });

    // Desenha o template base com fidelidade fotográfica máxima
    ctx.drawImage(baseImg, 0, 0, W, H);

    // Se o usuário selecionou uma foto customizada ou modelo alternativo
    if (!isMasterModel && data.modelImage) {
      try {
        const altImg = new Image();
        altImg.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          altImg.onload = () => resolve();
          altImg.onerror = () => reject();
          altImg.src = data.modelImage;
        });

        // Desenha modelo alternativo no lado direito (x: 520..1080, y: 0..735)
        ctx.save();
        ctx.beginPath();
        ctx.rect(520, 0, 560, 735);
        ctx.clip();
        ctx.drawImage(altImg, 520, 0, 560, 735);
        ctx.restore();

        // Recria o logo Tarhget no topo direito para nunca ficar apagado
        const logoImg = new Image();
        logoImg.crossOrigin = "anonymous";
        await new Promise<void>((resolve) => {
          logoImg.onload = () => {
            ctx.drawImage(logoImg, 910, 36, 120, 60);
            resolve();
          };
          logoImg.onerror = () => resolve();
          logoImg.src = "/images/tarhget-logo.png";
        });
      } catch (err) {
        console.warn("Falha ao carregar foto alternativa, mantendo mestre oficial:", err);
      }
    }

    // 3. Renderização Tipográfica Nativa de Alta Fidelidade (Letras Grandes e Negrito)
    // A) VAGA Nº (Topo Esquerdo)
    if (data.jobCode) {
      ctx.font = '800 26px "Barlow Condensed", "Oswald", "Arial Narrow", Impact, sans-serif';
      ctx.fillStyle = "#1b0e0c";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(`VAGA Nº ${data.jobCode}`, 48, 56);
    }

    // B) TÍTULO DA VAGA (Dentro do Box do Card)
    // Box bounds: x: 54..602, y: 274..413. Centro x = 328
    const cleanTitle = (data.roleTitle || "CONSULTOR(A) MERCHAN JR").toUpperCase().trim();
    ctx.fillStyle = "#361113";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    const titleWords = cleanTitle.split(" ");
    let titleLine1 = cleanTitle;
    let titleLine2 = "";

    // Divisão inteligente de linhas do título
    if (cleanTitle.includes("(") && cleanTitle.indexOf("(") > 0) {
      const pIdx = cleanTitle.indexOf("(");
      titleLine1 = cleanTitle.slice(0, pIdx).trim();
      titleLine2 = cleanTitle.slice(pIdx).trim();
    } else if (cleanTitle.includes("(A)") || cleanTitle.includes("(O)")) {
      const parenMatch = cleanTitle.match(/^(\S+\([AO]\))\s+(.+)$/i);
      if (parenMatch) {
        titleLine1 = parenMatch[1].trim();
        titleLine2 = parenMatch[2].trim();
      } else if (titleWords.length >= 2) {
        const mid = Math.ceil(titleWords.length / 2);
        titleLine1 = titleWords.slice(0, mid).join(" ");
        titleLine2 = titleWords.slice(mid).join(" ");
      }
    } else if (cleanTitle.length > 18 && titleWords.length >= 2) {
      const mid = Math.ceil(titleWords.length / 2);
      titleLine1 = titleWords.slice(0, mid).join(" ");
      titleLine2 = titleWords.slice(mid).join(" ");
    }

    if (titleLine2) {
      // Ajusta tamanho da fonte para caber no box de 510px
      ctx.font = '800 48px "Barlow Condensed", "Oswald", "Arial Narrow", Impact, sans-serif';
      const w1 = ctx.measureText(titleLine1).width;
      const w2 = ctx.measureText(titleLine2).width;
      const maxW = Math.max(w1, w2);
      const targetSize = maxW > 500 ? Math.floor((48 * 500) / maxW) : 48;

      ctx.font = `800 ${targetSize}px "Barlow Condensed", "Oswald", "Arial Narrow", Impact, sans-serif`;
      ctx.fillText(titleLine1, 328, 322);
      ctx.fillText(titleLine2, 328, 364);
    } else {
      ctx.font = '800 50px "Barlow Condensed", "Oswald", "Arial Narrow", Impact, sans-serif';
      const w = ctx.measureText(cleanTitle).width;
      const targetSize = w > 500 ? Math.floor((50 * 500) / w) : 50;

      ctx.font = `800 ${targetSize}px "Barlow Condensed", "Oswald", "Arial Narrow", Impact, sans-serif`;
      ctx.fillText(cleanTitle, 328, 342);
    }

    // Pílula do Segmento (Abaixo do Título)
    if (data.segmentSubtitle) {
      const pillText = data.segmentSubtitle.toUpperCase().trim();
      ctx.font = '700 13.5px "Barlow Semi Condensed", sans-serif';
      const textMetrics = ctx.measureText(pillText);
      const pillW = Math.min(textMetrics.width + 36, 510);
      const pillH = 24;
      const pillX = 328 - pillW / 2;
      const pillY = 380;

      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(pillX, pillY, pillW, pillH, 12);
      } else {
        ctx.rect(pillX, pillY, pillW, pillH);
      }
      ctx.fillStyle = "#f7efe0";
      ctx.fill();
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = "#856d5c";
      ctx.stroke();

      ctx.fillStyle = "#2a1714";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pillText, 328, pillY + pillH / 2 + 1);
    }

    // C) 5 LINHAS DE DETALHES (Local, Roteiro, Início, Contratação, Escala)
    // Tipografia encorpada, grande e em negrito como no modelo oficial
    const drawDetailRow = (
      prefix: string,
      val: string,
      y: number,
      secondLine?: string
    ) => {
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";

      if (secondLine) {
        // Linha 1
        ctx.font = '800 23px "Barlow Condensed", "Arial Narrow", Arial, sans-serif';
        ctx.fillStyle = "#150a08";
        ctx.fillText(prefix, 104, y - 11);
        const prefixW = ctx.measureText(prefix).width;

        ctx.font = '700 22px "Barlow Condensed", "Arial Narrow", Arial, sans-serif';
        ctx.fillStyle = "#180d0b";
        ctx.fillText(val, 104 + prefixW, y - 11);

        // Linha 2
        ctx.font = '700 21px "Barlow Condensed", "Arial Narrow", Arial, sans-serif';
        ctx.fillText(secondLine, 104, y + 13);
      } else {
        ctx.font = '800 23px "Barlow Condensed", "Arial Narrow", Arial, sans-serif';
        ctx.fillStyle = "#150a08";
        ctx.fillText(prefix, 104, y);
        const prefixW = ctx.measureText(prefix).width;

        ctx.font = '700 22px "Barlow Condensed", "Arial Narrow", Arial, sans-serif';
        ctx.fillStyle = "#180d0b";
        ctx.fillText(val, 104 + prefixW, y);
      }
    };

    // Linha 1: Local (y: 464)
    drawDetailRow("Local: ", data.location || "Fortaleza - CE", 464);

    // Linha 2: Roteiro (y: 520)
    const routeText = data.route || "Cobertura de 2 Lojas conforme roteiro";
    if (routeText.includes("|")) {
      const parts = routeText.split("|");
      drawDetailRow("Roteiro: ", parts[0].trim(), 520, `| ${parts.slice(1).join("|").trim()}`);
    } else if (routeText.length > 40) {
      const words = routeText.split(" ");
      const mid = Math.ceil(words.length / 2);
      drawDetailRow("Roteiro: ", words.slice(0, mid).join(" "), 520, words.slice(mid).join(" "));
    } else {
      drawDetailRow("Roteiro: ", routeText, 520);
    }

    // Linha 3: Início (y: 590)
    drawDetailRow("Início: ", data.startDate || "Imediato - a confirmar", 590);

    // Linha 4: Contratação (y: 650)
    drawDetailRow("Contratação: ", data.contractType || "Regime CLT – EFETIVO", 650);

    // Linha 5: Escala (y: 712)
    const schedText = data.workSchedule || "44h semanais — Seg a Sex e Sáb";
    if (schedText.includes("—")) {
      const parts = schedText.split("—");
      drawDetailRow("Escala: ", `${parts[0].trim()} —`, 712, parts[1].trim());
    } else if (schedText.length > 36) {
      const words = schedText.split(" ");
      const mid = Math.ceil(words.length / 2);
      drawDetailRow("Escala: ", words.slice(0, mid).join(" "), 712, words.slice(mid).join(" "));
    } else {
      drawDetailRow("Escala: ", schedText, 712);
    }

    // D) 5 VALORES DE BENEFÍCIOS NA FAIXA DOURADA (y: 950)
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    // Col 1: Salário (x: 145)
    ctx.font = '800 32px "Barlow Condensed", "Oswald", "Arial Narrow", Impact, sans-serif';
    ctx.fillStyle = "#150a08";
    ctx.fillText(data.salary || "R$ 1.839,41", 145, 950);

    // Col 2: Vale Refeição (x: 335)
    ctx.font = '800 32px "Barlow Condensed", "Oswald", "Arial Narrow", Impact, sans-serif';
    ctx.fillStyle = "#150a08";
    ctx.fillText(data.mealVoucher || "R$ 35,00/dia", 335, 950);

    // Helper para valores de benefícios com suporte a 2 linhas
    const drawBenefitCol = (
      val: string,
      x: number,
      preferCondensed: boolean = false,
      fontSize: number = 28
    ) => {
      ctx.textAlign = "center";
      ctx.fillStyle = "#150a08";

      const words = val.trim().split(" ");
      if (val.length > 14 && words.length >= 2) {
        const mid = Math.ceil(words.length / 2);
        const l1 = words.slice(0, mid).join(" ");
        const l2 = words.slice(mid).join(" ");

        if (preferCondensed) {
          ctx.font = `800 ${fontSize - 4}px "Barlow Condensed", "Oswald", "Arial Narrow", sans-serif`;
          ctx.fillText(l1, x, 940);
          ctx.fillText(l2, x, 960);
        } else {
          ctx.font = '700 18px "Barlow Semi Condensed", sans-serif';
          ctx.fillText(l1, x, 940);
          ctx.fillText(l2, x, 960);
        }
      } else {
        if (preferCondensed) {
          ctx.font = `800 ${fontSize}px "Barlow Condensed", "Oswald", "Arial Narrow", sans-serif`;
        } else {
          ctx.font = '700 20px "Barlow Semi Condensed", sans-serif';
        }
        ctx.fillText(val, x, 950);
      }
    };

    // Col 3: Ajuda de Custo (x: 525)
    drawBenefitCol(data.costAid || "(de acordo com o roteiro)", 525, false);

    // Col 4: Convênio Médico (x: 715)
    drawBenefitCol(data.healthInsurance || "e odontológico", 715, false);

    // Col 5: Aparelho (x: 895)
    drawBenefitCol(data.corporatePhone || "CORPORATIVO", 895, true, 28);

    // E) AVISO / DISCLAIMER NO RODAPÉ (y: 1052)
    ctx.font = '700 13.5px "Barlow Semi Condensed", sans-serif';
    ctx.fillStyle = "#3a2820";
    ctx.textAlign = "center";
    ctx.fillText(
      data.disclaimer ||
        "⚠️ Inscrições abertas! Confira todos os detalhes sobre perfil e requisitos diretamente em nosso portal.",
      540,
      1052
    );

    // Exporta imagem em alta resolução para download e publicação
    const dataUrl = canvas.toDataURL("image/png");
    setCanvasDataUrl(dataUrl);
    setIsRendering(false);
  }, [data]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Função para fazer o download direto em alta resolução (1080x1080)
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    const filename = `vaga-${data.jobCode || data.roleTitle.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}.png`;
    link.download = filename;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  // Copia a imagem direto para a área de transferência
  const handleCopyImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([
          new ClipboardItem({
            "image/png": blob,
          }),
        ]);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2500);
      });
    } catch (err) {
      console.warn("Clipboard write falhou, baixando:", err);
      handleDownload();
    }
  };

  return (
    <div className="flex flex-col items-center">
      {/* Barra de Ações Rápidas no Topo do Preview */}
      <div className="mb-4 flex flex-wrap items-center justify-between w-full gap-2 px-1">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-[#faece7] px-3 py-1 text-xs font-bold text-[#8f281e]">
            <Lock className="size-3" />
            Template Vetorial HD 1080×1080 (Oficial)
          </span>
          {isRendering && (
            <span className="text-xs text-[#71717a] flex items-center gap-1">
              <RefreshCw className="size-3 animate-spin" /> Atualizando...
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onRandomModel && (
            <button
              type="button"
              onClick={onRandomModel}
              title="Alternar foto de modelo"
              className="flex items-center gap-1.5 rounded-xl border border-[#e4e4e7] bg-white px-3 py-1.5 text-xs font-medium text-[#0a0a0a] shadow-xs hover:bg-[#fafaf9] transition-colors"
            >
              <RefreshCw className="size-3.5 text-[#71717a]" />
              Trocar foto
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyImage}
            title="Copiar imagem para colar direto no WhatsApp ou Telegram"
            className="flex items-center gap-1.5 rounded-xl border border-[#e4e4e7] bg-white px-3 py-1.5 text-xs font-medium text-[#0a0a0a] shadow-xs hover:bg-[#fafaf9] transition-colors"
          >
            {isCopied ? (
              <>
                <Check className="size-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-semibold">Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5 text-[#71717a]" />
                Copiar
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 rounded-xl bg-[#8f281e] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#722018] transition-colors"
          >
            <Download className="size-3.5" />
            Baixar PNG
          </button>

          <button
            type="button"
            onClick={() => setIsPublishModalOpen(true)}
            title="Enviar direto para o Feed do Instagram"
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:opacity-95 transition-all"
          >
            <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
            </svg>
            Instagram
          </button>

          <button
            type="button"
            onClick={() => setZoomPreview(true)}
            title="Ver em tamanho real"
            className="flex items-center justify-center size-8 rounded-xl border border-[#e4e4e7] bg-white text-[#71717a] hover:text-[#0a0a0a] hover:bg-[#fafaf9]"
          >
            <ZoomIn className="size-4" />
          </button>
        </div>
      </div>

      {/* Container Responsivo do Canvas com Proporção 1:1 e Moldura Sofisticada */}
      <div className="relative w-full max-w-[540px] aspect-square rounded-2xl overflow-hidden shadow-2xl border border-[#d6c5b0] bg-[#faf8f4] group">
        <canvas
          ref={canvasRef}
          className="w-full h-full object-contain block select-none cursor-pointer"
          onClick={() => setZoomPreview(true)}
        />

        {/* Hover overlay hint */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <span className="bg-black/80 backdrop-blur text-white text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
            <Eye className="size-3.5" /> Clique para ampliar 1080×1080
          </span>
        </div>
      </div>

      {/* Modal de Zoom em Tamanho Completo */}
      {zoomPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setZoomPreview(false)}
        >
          <div
            className="relative max-w-[90vw] max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl border border-white/20 p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-[#e4e4e7]">
              <span className="text-sm font-bold text-[#0a0a0a]">Pré-visualização 1080×1080 (HD)</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 rounded-xl bg-[#8f281e] px-3 py-1 text-xs font-bold text-white hover:bg-[#722018]"
                >
                  <Download className="size-3.5" /> Baixar
                </button>
                <button
                  type="button"
                  onClick={() => setZoomPreview(false)}
                  className="rounded-lg p-1 text-[#71717a] hover:bg-[#f4f4f5] text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            </div>
            {canvasDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={canvasDataUrl}
                alt="Post Instagram Preview"
                className="max-h-[80vh] w-auto object-contain mx-auto rounded-lg"
              />
            )}
          </div>
        </div>
      )}

      {/* Modal de Publicação Direta no Instagram */}
      <InstagramPublishModal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        canvasRef={canvasRef}
        caption={data.caption || ""}
        roleTitle={data.roleTitle || "Vaga"}
      />
    </div>
  );
}
