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

// Cores originais extraídas do master
const COLORS = {
  wine: "#431317",
  wineDark: "#231012",
  gold: "#a37a4a",
  cardBg: "#fbf5e8",
  cardBorder: "#3d211a",
  textPrimary: "#1a100e",
  textSecondary: "#271915",
  ribbonBg: "#e9d9bf",
};

export function InstagramCanvasPreview({ data, onRandomModel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [zoomPreview, setZoomPreview] = useState(false);
  const [canvasDataUrl, setCanvasDataUrl] = useState<string>("");
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);

  // Injeta Google Fonts no documento para garantir tipografia idêntica ao original
  useEffect(() => {
    if (typeof document !== "undefined") {
      const fontId = "google-fonts-cartaz-tarhget";
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
          document.fonts.load('36px "Bebas Neue"'),
          document.fonts.load('18px "Barlow Semi Condensed"'),
          document.fonts.load('bold 14px "Montserrat"'),
        ]);
        await document.fonts.ready;
      }
    } catch {
      // continua com fontes do sistema
    }

    const W = 1080;
    const H = 1080;
    canvas.width = W;
    canvas.height = H;

    // 1. CARREGAR A ARTE MESTRE OFICIAL EM ALTA DEFINIÇÃO (1080x1080)
    // O template mestre contém a modelo oficial, a loja de varejo iluminada, o logo Tarhget,
    // a tipografia cursiva autêntica, a fita ondulada dourada e o botão vinho da bio com cursor.
    const masterImg = new Image();
    masterImg.crossOrigin = "anonymous";
    try {
      await new Promise<void>((resolve, reject) => {
        masterImg.onload = () => resolve();
        masterImg.onerror = () => reject();
        masterImg.src = "/images/templates/master-template-1080.png";
      });
      ctx.drawImage(masterImg, 0, 0, W, H);
    } catch (err) {
      console.warn("Template mestre carregando fallback:", err);
    }

    // 2. SE O USUÁRIO TROCOU DE MODELO (FOTO ALTERNATIVA OU UPLOAD)
    const isCustomModel =
      data.modelImage &&
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
        const imgX = 510;
        const imgY = 0;
        const imgW = 570;
        const imgH = 740;

        // Proporção de preenchimento
        const imgRatio = altModel.width / altModel.height;
        const targetRatio = imgW / imgH;
        let sx = 0;
        let sy = 0;
        let sw = altModel.width;
        let sh = altModel.height;

        if (imgRatio > targetRatio) {
          sw = altModel.height * targetRatio;
          sx = (altModel.width - sw) / 2;
        } else {
          sh = altModel.width / targetRatio;
          sy = (altModel.height - sh) / 4;
        }

        ctx.drawImage(altModel, sx, sy, sw, sh, imgX, imgY, imgW, imgH);

        // Degradê de fusão suave na lateral esquerda da foto alternativa
        const fadeGrad = ctx.createLinearGradient(imgX, 0, imgX + 130, 0);
        fadeGrad.addColorStop(0, "#f6f1e5");
        fadeGrad.addColorStop(0.4, "rgba(246, 241, 229, 0.7)");
        fadeGrad.addColorStop(1, "rgba(246, 241, 229, 0)");
        ctx.fillStyle = fadeGrad;
        ctx.fillRect(imgX, imgY, 130, imgH);
        ctx.restore();
      } catch {
        // mantém a modelo original do master
      }
    }

    // 3. CAMADA DINÂMICA: VAGA Nº {CÓDIGO} (TOPO ESQUERDO)
    if (data.jobCode) {
      ctx.save();
      // Limpa a área da vaga original com a cor de fundo exata
      ctx.fillStyle = "#f6f1e5";
      ctx.fillRect(44, 34, 210, 36);

      ctx.textAlign = "left";
      ctx.fillStyle = COLORS.textPrimary;
      ctx.font = 'bold 25px "Bebas Neue", "Montserrat", Impact, sans-serif';
      ctx.letterSpacing = "1.2px";
      ctx.fillText(`VAGA Nº ${data.jobCode}`, 48, 58);
      ctx.restore();
    }

    // 4. CAMADA DINÂMICA: QUADRO DO CARGO DENTRO DO CARD
    // Caixa arredondada com borda fina idêntica ao design original
    const titleBoxX = 50;
    const titleBoxY = 260;
    const titleBoxW = 558;
    const titleBoxH = 148;
    const titleBoxRadius = 22;

    ctx.save();
    // Fundo da caixa com a textura e cor creme do card
    ctx.beginPath();
    ctx.roundRect(titleBoxX, titleBoxY, titleBoxW, titleBoxH, titleBoxRadius);
    ctx.fillStyle = COLORS.cardBg;
    ctx.fill();

    // Borda escura elegante
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = COLORS.cardBorder;
    ctx.stroke();

    // Título do Cargo em Bebas Neue (Condensed Bold)
    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.wineDark;
    ctx.font = 'bold 36px "Bebas Neue", Impact, sans-serif';
    ctx.letterSpacing = "0.5px";

    const cleanTitle = data.roleTitle.toUpperCase().trim();
    const words = cleanTitle.split(" ");
    let line1 = cleanTitle;
    let line2 = "";

    // Se o cargo for longo (mais de 18 caracteres ou mais de 2 palavras), divide em 2 linhas
    if (cleanTitle.length > 18 && words.length >= 2) {
      const mid = Math.ceil(words.length / 2);
      line1 = words.slice(0, mid).join(" ");
      line2 = words.slice(mid).join(" ");
    }

    const titleCenterX = titleBoxX + titleBoxW / 2;
    if (line2) {
      ctx.fillText(line1, titleCenterX, titleBoxY + 48);
      ctx.fillText(line2, titleCenterX, titleBoxY + 86);
    } else {
      ctx.fillText(line1, titleCenterX, titleBoxY + 66);
    }

    // Pílula do Segmento / Cliente (ex: SEGMENTO DE COSMÉTICOS E CUIDADOS PESSOAIS)
    if (data.segmentSubtitle) {
      const segText = data.segmentSubtitle.toUpperCase();
      ctx.font = 'bold 12px "Barlow Semi Condensed", "Montserrat", sans-serif';
      ctx.letterSpacing = "0.8px";
      const segMetrics = ctx.measureText(segText);
      const pillWidth = Math.min(segMetrics.width + 26, titleBoxW - 40);
      const pillY = titleBoxY + 116;

      ctx.beginPath();
      ctx.roundRect(titleCenterX - pillWidth / 2, pillY - 14, pillWidth, 23, 6);
      ctx.fillStyle = "#f7efe0";
      ctx.strokeStyle = "#856d5c";
      ctx.lineWidth = 1.2;
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#2a1714";
      ctx.fillText(segText.slice(0, 52), titleCenterX, pillY + 2);
    }
    ctx.restore();

    // 5. CAMADA DINÂMICA: AS 5 LINHAS DE DETALHES DA OPERAÇÃO
    // Os 5 ícones circulares bordô já estão gravados no master com máxima nitidez!
    // Cobrimos somente a área de texto à direita dos ícones para desenhar os dados da vaga.
    ctx.save();
    ctx.fillStyle = "#fcf7ee";
    ctx.fillRect(104, 420, 502, 288);

    const rows = [
      { label: "Local:", value: data.location || "Fortaleza - CE", y: 454 },
      { label: "Roteiro:", value: data.route || "Cobertura de lojas conforme roteiro", y: 510 },
      { label: "Início:", value: data.startDate || "Imediato - data a confirmar", y: 566 },
      { label: "Contratação:", value: data.contractType || "Regime CLT – EFETIVO", y: 622 },
      { label: "Escala:", value: data.workSchedule || "44h semanais", y: 678 },
    ];

    rows.forEach((r) => {
      ctx.textAlign = "left";
      // Prefixo em negrito escuro (ex: "Local: ")
      ctx.font = 'bold 18px "Barlow Semi Condensed", "Roboto Condensed", sans-serif';
      ctx.fillStyle = COLORS.textPrimary;
      ctx.fillText(r.label, 106, r.y);

      const prefixWidth = ctx.measureText(r.label + " ").width;

      // Valor do detalhe em fonte condensada nítida
      ctx.font = '600 17px "Barlow Semi Condensed", "Roboto Condensed", sans-serif';
      ctx.fillStyle = COLORS.textSecondary;

      let valText = r.value;
      const maxWidth = 596 - (106 + prefixWidth);
      while (ctx.measureText(valText).width > maxWidth && valText.length > 6) {
        valText = valText.slice(0, -2) + "…";
      }
      ctx.fillText(valText, 106 + prefixWidth, r.y);
    });
    ctx.restore();

    // 6. CAMADA DINÂMICA: VALORES DA FAIXA DOURADA DE BENEFÍCIOS
    // Os ícones dourados vetoriais e cabeçalhos permanecem idênticos ao modelo mestre.
    // Atualizamos somente os 5 valores monetários e descrições inferiores.
    ctx.save();
    // Limpa a faixa de valores anterior com o tom dourado exato da onda
    ctx.fillStyle = COLORS.ribbonBg;
    ctx.fillRect(50, 874, 980, 58);

    const benefitValues = [
      {
        value: data.salary || "R$ 1.839,41",
        x: 138,
        font: 'bold 20px "Bebas Neue", "Montserrat", sans-serif',
      },
      {
        value: data.mealVoucher || "R$ 35,00/dia",
        x: 334,
        font: 'bold 16px "Barlow Semi Condensed", "Montserrat", sans-serif',
      },
      {
        value: data.costAid || "(de acordo com o roteiro)",
        x: 532,
        font: '600 14px "Barlow Semi Condensed", sans-serif',
      },
      {
        value: data.healthInsurance || "e odontológico",
        x: 732,
        font: '600 14px "Barlow Semi Condensed", sans-serif',
      },
      {
        value: data.corporatePhone || "CORPORATIVO",
        x: 932,
        font: 'bold 17px "Bebas Neue", "Barlow Semi Condensed", sans-serif',
      },
    ];

    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.textPrimary;
    benefitValues.forEach((b) => {
      ctx.font = b.font;
      let val = b.value;
      if (val.length > 25) val = val.slice(0, 23) + "…";
      ctx.fillText(val, b.x, 910);
    });
    ctx.restore();

    // 7. CAMADA DINÂMICA: AVISO E DATA LIMITE INFERIOR
    if (data.disclaimer) {
      ctx.save();
      ctx.fillStyle = "#f4efe1";
      ctx.fillRect(120, 1028, 840, 36);

      ctx.textAlign = "center";
      ctx.fillStyle = "#33221b";
      ctx.font = '600 13px "Barlow Semi Condensed", "Montserrat", sans-serif';
      ctx.fillText(data.disclaimer, W / 2, 1048);
      ctx.restore();
    }

    // Exporta dataUrl para visualização
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
            Template Master Oficial 100% Travado (1080×1080)
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
              title="Trocar modelo ou voltar para o oficial"
              className="flex items-center gap-1.5 rounded-xl border border-[#e4e4e7] bg-white px-3 py-1.5 text-xs font-medium text-[#0a0a0a] shadow-xs hover:bg-[#fafaf9] transition-colors"
            >
              <RefreshCw className="size-3.5 text-[#71717a]" />
              Trocar modelo
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
