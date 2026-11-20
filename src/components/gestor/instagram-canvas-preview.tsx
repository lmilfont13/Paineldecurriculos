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

// Cores extraídas diretamente do modelo master original
const MASTER_COLORS = {
  wine: "#431317",
  wineDark: "#241113",
  gold: "#a37a4a",
  textPrimary: "#1a100e",
  textSecondary: "#2a1c18",
  pillBg: "#f8f1e3",
  pillBorder: "#856d5c",
};

export function InstagramCanvasPreview({ data, onRandomModel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [zoomPreview, setZoomPreview] = useState(false);
  const [canvasDataUrl, setCanvasDataUrl] = useState<string>("");
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);

  // Injeta Google Fonts oficiais idênticas ao Canva/Figma original
  useEffect(() => {
    if (typeof document !== "undefined") {
      const fontId = "tarhget-official-template-fonts";
      if (!document.getElementById(fontId)) {
        const link = document.createElement("link");
        link.id = fontId;
        link.rel = "stylesheet";
        link.href =
          "https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:ital,wght@0,500;0,600;0,700;0,800;1,700&family=Bebas+Neue&family=Montserrat:wght@700;800;900&display=swap";
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

    // Aguarda o carregamento das fontes Bebas Neue e Barlow Semi Condensed
    try {
      if (typeof document !== "undefined" && document.fonts) {
        await Promise.allSettled([
          document.fonts.load('38px "Bebas Neue"'),
          document.fonts.load('18px "Barlow Semi Condensed"'),
          document.fonts.load('bold 14px "Montserrat"'),
        ]);
        await document.fonts.ready;
      }
    } catch {
      // continua normalmente
    }

    const W = 1080;
    const H = 1080;
    canvas.width = W;
    canvas.height = H;

    // 1. CARREGA O TEMPLATE MASTER LIMPO E DE ALTA RESOLUÇÃO (1080x1080)
    // O template master-clean-1080 contém toda a iluminação fotográfica, a modelo oficial,
    // o logotipo Tarhget, o título estilizado "OPORTUNIDADE DE EMPREGO", o "Estamos contratando!",
    // os 5 ícones circulares do card, a onda dourada de benefícios e o botão vinho da bio com o cursor.
    // Ele já tem as áreas de texto limpas sem fantasmas nem sobreposições.
    const masterImg = new Image();
    masterImg.crossOrigin = "anonymous";
    try {
      await new Promise<void>((resolve, reject) => {
        masterImg.onload = () => resolve();
        masterImg.onerror = () => reject();
        masterImg.src = "/images/templates/master-clean-1080.png";
      });
      ctx.drawImage(masterImg, 0, 0, W, H);
    } catch (err) {
      console.warn("[canvas] Falha ao carregar master-clean-1080, tentando fallback:", err);
    }

    // 2. SE FOR SELECIONADO UM MODELO ALTERNATIVO (ex.: modelo masculino ou foto própria)
    const isCustomModel =
      data.modelImage &&
      !data.modelImage.includes("master-clean-1080") &&
      !data.modelImage.includes("master-template-1080") &&
      !data.modelImage.includes("model-official");

    if (isCustomModel) {
      try {
        const altModel = new Image();
        altModel.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          altModel.onload = () => resolve();
          altModel.onerror = () => reject();
          altModel.src = data.modelImage;
        });

        ctx.save();
        // Preserva o topo (logo da Tarhget) e a base da onda, posicionando a foto entre y: 110 e y: 740
        const imgX = 520;
        const imgY = 110;
        const imgW = 560;
        const imgH = 635;

        const imgRatio = altModel.width / altModel.height;
        const targetRatio = imgW / imgH;
        let sx = 0, sy = 0, sw = altModel.width, sh = altModel.height;

        if (imgRatio > targetRatio) {
          sw = altModel.height * targetRatio;
          sx = (altModel.width - sw) / 2;
        } else {
          sh = altModel.width / targetRatio;
          sy = (altModel.height - sh) / 4;
        }

        ctx.drawImage(altModel, sx, sy, sw, sh, imgX, imgY, imgW, imgH);

        // Degradê de fusão suave na lateral esquerda da foto para se integrar ao card
        const fadeGrad = ctx.createLinearGradient(imgX, 0, imgX + 110, 0);
        fadeGrad.addColorStop(0, "#f8f3e7");
        fadeGrad.addColorStop(0.5, "rgba(248, 243, 231, 0.7)");
        fadeGrad.addColorStop(1, "rgba(248, 243, 231, 0)");
        ctx.fillStyle = fadeGrad;
        ctx.fillRect(imgX, imgY, 110, imgH);
        ctx.restore();
      } catch {
        // mantém a modelo oficial
      }
    }

    // 3. VAGA Nº {CÓDIGO} (TOPO ESQUERDO)
    if (data.jobCode) {
      ctx.save();
      ctx.textAlign = "left";
      ctx.fillStyle = MASTER_COLORS.textPrimary;
      ctx.font = 'bold 26px "Bebas Neue", Impact, sans-serif';
      ctx.letterSpacing = "1px";
      ctx.fillText(`VAGA Nº ${data.jobCode}`, 50, 56);
      ctx.restore();
    }

    // 4. TÍTULO DO CARGO DENTRO DO QUADRO DO CARD
    // Centro do quadro: x: 330
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = MASTER_COLORS.wineDark;
    ctx.font = 'bold 38px "Bebas Neue", Impact, sans-serif';
    ctx.letterSpacing = "0.5px";

    const cleanTitle = (data.roleTitle || "CONSULTOR(A) MERCHAN JR").toUpperCase().trim();
    const words = cleanTitle.split(" ");
    let line1 = cleanTitle;
    let line2 = "";

    if (cleanTitle.length > 18 && words.length >= 2) {
      const mid = Math.ceil(words.length / 2);
      line1 = words.slice(0, mid).join(" ");
      line2 = words.slice(mid).join(" ");
    }

    if (line2) {
      ctx.fillText(line1, 330, 318);
      ctx.fillText(line2, 330, 358);
    } else {
      ctx.fillText(line1, 330, 338);
    }

    // Pílula do Segmento / Cliente (ex: SEGMENTO DE COSMÉTICOS E CUIDADOS PESSOAIS)
    if (data.segmentSubtitle) {
      const segText = data.segmentSubtitle.toUpperCase();
      ctx.font = 'bold 13px "Barlow Semi Condensed", "Montserrat", sans-serif';
      ctx.letterSpacing = "0.8px";
      const segWidth = Math.min(ctx.measureText(segText).width + 28, 520);
      const pillY = 398;

      ctx.beginPath();
      ctx.roundRect(330 - segWidth / 2, pillY - 18, segWidth, 26, 6);
      ctx.fillStyle = MASTER_COLORS.pillBg;
      ctx.strokeStyle = MASTER_COLORS.pillBorder;
      ctx.lineWidth = 1.2;
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#2a1714";
      ctx.fillText(segText.slice(0, 50), 330, pillY);
    }
    ctx.restore();

    // 5. AS 5 LINHAS DE DETALHES DA OPERAÇÃO (ALINHADAS COM OS 5 ÍCONES ORIGINAIS)
    // Ícone 1 (Local): centro y: 458 -> texto y: 464
    // Ícone 2 (Roteiro): centro y: 514 -> texto y: 512
    // Ícone 3 (Início): centro y: 579 -> texto y: 584
    // Ícone 4 (Contratação): centro y: 645 -> texto y: 650
    // Ícone 5 (Escala): centro y: 710 -> texto y: 708
    ctx.save();
    ctx.textAlign = "left";

    const textStartX = 108;
    const maxTextWidth = 490;

    // Linha 1: Local
    ctx.font = 'bold 18px "Barlow Semi Condensed", sans-serif';
    ctx.fillStyle = MASTER_COLORS.textPrimary;
    ctx.fillText("Local: ", textStartX, 464);
    const localPrefixW = ctx.measureText("Local: ").width;
    ctx.font = '600 17px "Barlow Semi Condensed", sans-serif';
    ctx.fillStyle = MASTER_COLORS.textSecondary;
    ctx.fillText(data.location || "Fortaleza - CE", textStartX + localPrefixW, 464);

    // Linha 2: Roteiro (com quebra inteligente se longo)
    ctx.font = 'bold 18px "Barlow Semi Condensed", sans-serif';
    ctx.fillStyle = MASTER_COLORS.textPrimary;
    ctx.fillText("Roteiro: ", textStartX, 512);
    const roteiroPrefixW = ctx.measureText("Roteiro: ").width;
    ctx.font = '600 17px "Barlow Semi Condensed", sans-serif';
    ctx.fillStyle = MASTER_COLORS.textSecondary;

    const roteiroText = data.route || "Cobertura de lojas conforme roteiro estabelecido";
    if (ctx.measureText(roteiroText).width > maxTextWidth - roteiroPrefixW && roteiroText.includes("|")) {
      const parts = roteiroText.split("|");
      ctx.fillText(parts[0].trim(), textStartX + roteiroPrefixW, 512);
      ctx.fillText("| " + parts.slice(1).join("|").trim(), textStartX, 532);
    } else {
      let rText = roteiroText;
      while (ctx.measureText(rText).width > maxTextWidth - roteiroPrefixW && rText.length > 8) {
        rText = rText.slice(0, -2) + "…";
      }
      ctx.fillText(rText, textStartX + roteiroPrefixW, 512);
    }

    // Linha 3: Início
    ctx.font = 'bold 18px "Barlow Semi Condensed", sans-serif';
    ctx.fillStyle = MASTER_COLORS.textPrimary;
    ctx.fillText("Início: ", textStartX, 584);
    const inicioPrefixW = ctx.measureText("Início: ").width;
    ctx.font = '600 17px "Barlow Semi Condensed", sans-serif';
    ctx.fillStyle = MASTER_COLORS.textSecondary;
    ctx.fillText(data.startDate || "Imediato - data a confirmar", textStartX + inicioPrefixW, 584);

    // Linha 4: Contratação
    ctx.font = 'bold 18px "Barlow Semi Condensed", sans-serif';
    ctx.fillStyle = MASTER_COLORS.textPrimary;
    ctx.fillText("Contratação: ", textStartX, 650);
    const contraPrefixW = ctx.measureText("Contratação: ").width;
    ctx.font = '600 17px "Barlow Semi Condensed", sans-serif';
    ctx.fillStyle = MASTER_COLORS.textSecondary;
    ctx.fillText(data.contractType || "Regime CLT – EFETIVO", textStartX + contraPrefixW, 650);

    // Linha 5: Escala
    ctx.font = 'bold 18px "Barlow Semi Condensed", sans-serif';
    ctx.fillStyle = MASTER_COLORS.textPrimary;
    ctx.fillText("Escala: ", textStartX, 708);
    const escalaPrefixW = ctx.measureText("Escala: ").width;
    ctx.font = '600 17px "Barlow Semi Condensed", sans-serif';
    ctx.fillStyle = MASTER_COLORS.textSecondary;

    const escalaText = data.workSchedule || "44h semanais — Seg a Sex (11h às 20h) e Sáb (16h às 20h)";
    if (ctx.measureText(escalaText).width > maxTextWidth - escalaPrefixW && escalaText.includes("—")) {
      const parts = escalaText.split("—");
      ctx.fillText(parts[0].trim() + " —", textStartX + escalaPrefixW, 708);
      ctx.fillText(parts[1].trim(), textStartX, 728);
    } else {
      let eText = escalaText;
      while (ctx.measureText(eText).width > maxTextWidth - escalaPrefixW && eText.length > 8) {
        eText = eText.slice(0, -2) + "…";
      }
      ctx.fillText(eText, textStartX + escalaPrefixW, 708);
    }
    ctx.restore();

    // 6. VALORES DA FAIXA DOURADA DE BENEFÍCIOS (y: 930)
    // As colunas de benefícios estão alinhadas com os 5 ícones dourados:
    // Coluna 1 (Salário): x: 135
    // Coluna 2 (Vale Refeição): x: 335
    // Coluna 3 (Ajuda de Custo): x: 532
    // Coluna 4 (Convênio Médico): x: 732
    // Coluna 5 (Aparelho Corporativo): x: 930
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = MASTER_COLORS.textPrimary;

    // 1. Salário
    ctx.font = 'bold 21px "Bebas Neue", "Montserrat", sans-serif';
    ctx.fillText(data.salary || "R$ 1.839,41", 135, 930);

    // 2. VR
    ctx.font = 'bold 21px "Bebas Neue", "Montserrat", sans-serif';
    ctx.fillText(data.mealVoucher || "R$ 35,00/dia", 335, 930);

    // 3. Ajuda de Custo
    ctx.font = '600 14px "Barlow Semi Condensed", sans-serif';
    ctx.fillStyle = "#2c1e19";
    const costText = data.costAid || "(de acordo com o roteiro)";
    if (costText.includes("de acordo")) {
      ctx.fillText("(de acordo com", 532, 922);
      ctx.fillText("o roteiro)", 532, 940);
    } else {
      ctx.font = 'bold 18px "Bebas Neue", sans-serif';
      ctx.fillText(costText, 532, 930);
    }

    // 4. Convênio Médico
    ctx.font = '600 15px "Barlow Semi Condensed", sans-serif';
    ctx.fillStyle = "#2c1e19";
    ctx.fillText(data.healthInsurance || "e odontológico", 732, 930);

    // 5. Aparelho Corporativo
    ctx.font = 'bold 21px "Bebas Neue", "Montserrat", sans-serif';
    ctx.fillStyle = MASTER_COLORS.textPrimary;
    ctx.fillText(data.corporatePhone || "CORPORATIVO", 930, 930);

    ctx.restore();

    // 7. AVISO E DATA LIMITE INFERIOR
    if (data.disclaimer) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.fillStyle = "#33221b";
      ctx.font = '600 13px "Barlow Semi Condensed", "Montserrat", sans-serif';
      ctx.fillText(data.disclaimer, W / 2, 1046);
      ctx.restore();
    }

    // Exporta dataUrl para visualização e zoom
    try {
      const dataUrl = canvas.toDataURL("image/png");
      setCanvasDataUrl(dataUrl);
    } catch {
      // ignore
    }

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
            Padrão Oficial Tarhget 1080×1080 (HD)
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
              title="Alternar modelo de foto"
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
