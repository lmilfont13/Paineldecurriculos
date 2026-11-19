"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Download, Copy, Check, Sparkles, RefreshCw, ZoomIn, Eye } from "lucide-react";
import type { SocialJobPostData } from "@/server/models/social-post.model";

type Props = {
  data: SocialJobPostData;
  companyName?: string;
  onRandomModel?: () => void;
};

// Cores da paleta oficial do template
const PALETTE = {
  wine: "#401114",
  wineDark: "#2d0a0d",
  gold: "#a07a4a",
  goldDark: "#856235",
  goldLight: "#d8bea0",
  ribbonBg: "#e9dac4",
  ribbonWave: "#c4a47a",
  cardBorder: "#ba9a6d",
  cardBg: "#ffffff",
  textDark: "#1f1412",
  textMuted: "#4b3d39",
  creamBg: "#f6f3eb",
};

export function InstagramCanvasPreview({ data, companyName = "TARHGET", onRandomModel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [zoomPreview, setZoomPreview] = useState(false);
  const [canvasDataUrl, setCanvasDataUrl] = useState<string>("");

  // Desenha os ícones vetoriais com precisão matemática no Canvas
  const drawIcon = (
    ctx: CanvasRenderingContext2D,
    type: "pin" | "store" | "calendar" | "contract" | "clock" | "coins" | "meal" | "aid" | "health" | "phone",
    cx: number,
    cy: number,
    size: number,
    color: string
  ) => {
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const s = size / 24; // normalização baseada em grid 24x24

    if (type === "pin") {
      ctx.beginPath();
      ctx.arc(cx, cy - 3 * s, 6 * s, Math.PI, 0, false);
      ctx.lineTo(cx, cy + 9 * s);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy - 3 * s, 2.2 * s, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === "store") {
      ctx.beginPath();
      ctx.rect(cx - 9 * s, cy - 4 * s, 18 * s, 13 * s);
      ctx.stroke();
      // toldo
      ctx.beginPath();
      ctx.moveTo(cx - 10 * s, cy - 4 * s);
      ctx.lineTo(cx - 7 * s, cy - 10 * s);
      ctx.lineTo(cx + 7 * s, cy - 10 * s);
      ctx.lineTo(cx + 10 * s, cy - 4 * s);
      ctx.closePath();
      ctx.stroke();
      // porta
      ctx.beginPath();
      ctx.rect(cx - 3 * s, cy + 2 * s, 6 * s, 7 * s);
      ctx.stroke();
    } else if (type === "calendar") {
      ctx.beginPath();
      ctx.rect(cx - 8 * s, cy - 7 * s, 16 * s, 16 * s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 8 * s, cy - 2 * s);
      ctx.lineTo(cx + 8 * s, cy - 2 * s);
      ctx.stroke();
      // pinos
      ctx.beginPath();
      ctx.moveTo(cx - 4 * s, cy - 9 * s);
      ctx.lineTo(cx - 4 * s, cy - 6 * s);
      ctx.moveTo(cx + 4 * s, cy - 9 * s);
      ctx.lineTo(cx + 4 * s, cy - 6 * s);
      ctx.stroke();
    } else if (type === "contract") {
      ctx.beginPath();
      ctx.rect(cx - 7 * s, cy - 9 * s, 14 * s, 18 * s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 4 * s, cy - 4 * s);
      ctx.lineTo(cx + 4 * s, cy - 4 * s);
      ctx.moveTo(cx - 4 * s, cy);
      ctx.lineTo(cx + 4 * s, cy);
      ctx.moveTo(cx - 4 * s, cy + 4 * s);
      ctx.lineTo(cx + 1 * s, cy + 4 * s);
      ctx.stroke();
    } else if (type === "clock") {
      ctx.beginPath();
      ctx.arc(cx, cy, 9 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - 5 * s);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + 4 * s, cy);
      ctx.stroke();
    } else if (type === "coins") {
      // pilhas de moedas
      ctx.beginPath();
      ctx.ellipse(cx - 3 * s, cy - 4 * s, 6 * s, 2.5 * s, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx - 3 * s, cy, 6 * s, 2.5 * s, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx - 3 * s, cy + 4 * s, 6 * s, 2.5 * s, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx + 4 * s, cy + 3 * s, 5 * s, 2.2 * s, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (type === "meal") {
      // garfo, prato e faca
      ctx.beginPath();
      ctx.arc(cx, cy, 7 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      // garfo
      ctx.moveTo(cx - 10 * s, cy - 7 * s);
      ctx.lineTo(cx - 10 * s, cy + 7 * s);
      // faca
      ctx.moveTo(cx + 10 * s, cy - 7 * s);
      ctx.lineTo(cx + 10 * s, cy + 7 * s);
      ctx.stroke();
    } else if (type === "aid") {
      // gráfico de barras com seta para cima
      ctx.beginPath();
      ctx.rect(cx - 8 * s, cy + 1 * s, 4 * s, 6 * s);
      ctx.rect(cx - 2 * s, cy - 3 * s, 4 * s, 10 * s);
      ctx.rect(cx + 4 * s, cy - 7 * s, 4 * s, 14 * s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 8 * s, cy - 2 * s);
      ctx.lineTo(cx + 8 * s, cy - 10 * s);
      ctx.lineTo(cx + 4 * s, cy - 10 * s);
      ctx.stroke();
    } else if (type === "health") {
      // coração com cruz de primeiros socorros
      ctx.beginPath();
      ctx.moveTo(cx, cy + 7 * s);
      ctx.bezierCurveTo(cx - 10 * s, cy + 2 * s, cx - 10 * s, cy - 6 * s, cx, cy - 2 * s);
      ctx.bezierCurveTo(cx + 10 * s, cy - 6 * s, cx + 10 * s, cy + 2 * s, cx, cy + 7 * s);
      ctx.stroke();
      // cruz central
      ctx.beginPath();
      ctx.moveTo(cx - 3 * s, cy + 1 * s);
      ctx.lineTo(cx + 3 * s, cy + 1 * s);
      ctx.moveTo(cx, cy - 2 * s);
      ctx.lineTo(cx, cy + 4 * s);
      ctx.stroke();
    } else if (type === "phone") {
      // celular corporativo
      ctx.beginPath();
      ctx.rect(cx - 6 * s, cy - 9 * s, 12 * s, 18 * s);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy + 6 * s, 1.2 * s, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  const renderCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsRendering(true);

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    // Garante que fontes externas estejam prontas
    try {
      if (typeof document !== "undefined" && document.fonts) {
        await document.fonts.ready;
      }
    } catch {
      // segue normalmente com fontes nativas
    }

    const W = 1080;
    const H = 1080;
    canvas.width = W;
    canvas.height = H;

    // 1. FUNDO GERAL COM LEVE GRADIENTE QUENTE
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, "#faf8f3");
    bgGrad.addColorStop(0.5, "#f3ece0");
    bgGrad.addColorStop(1, "#eae0cf");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // 2. FOTO DA MODELO / AMBIENTE DE VAREJO (DIREITA)
    // Tenta carregar a imagem do modelo
    try {
      const modelImg = new Image();
      modelImg.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        modelImg.onload = () => resolve();
        modelImg.onerror = () => reject();
        modelImg.src = data.modelImage || "/images/templates/model-woman-retail-1.jpg";
      });

      ctx.save();
      // Desenha a imagem na metade direita com proporção harmoniosa
      const imgTargetX = 490;
      const imgTargetY = 0;
      const imgTargetW = 590;
      const imgTargetH = 750;

      // Desenha a imagem cobrindo a área
      const imgRatio = modelImg.width / modelImg.height;
      const targetRatio = imgTargetW / imgTargetH;
      let sx = 0;
      let sy = 0;
      let sw = modelImg.width;
      let sh = modelImg.height;

      if (imgRatio > targetRatio) {
        sw = modelImg.height * targetRatio;
        sx = (modelImg.width - sw) / 2;
      } else {
        sh = modelImg.width / targetRatio;
        sy = (modelImg.height - sh) / 4; // foca um pouco mais no terço superior (rosto)
      }

      ctx.drawImage(modelImg, sx, sy, sw, sh, imgTargetX, imgTargetY, imgTargetW, imgTargetH);

      // Gradiente suave de fusão na borda esquerda da foto para fundir com o fundo
      const fadeGrad = ctx.createLinearGradient(imgTargetX, 0, imgTargetX + 160, 0);
      fadeGrad.addColorStop(0, "#f7f2e8");
      fadeGrad.addColorStop(0.3, "rgba(247, 242, 232, 0.7)");
      fadeGrad.addColorStop(1, "rgba(247, 242, 232, 0)");
      ctx.fillStyle = fadeGrad;
      ctx.fillRect(imgTargetX, imgTargetY, 160, imgTargetH);

      ctx.restore();
    } catch {
      // Se a imagem falhar ao carregar, desenha uma silhueta profissional estilizada
      ctx.save();
      ctx.fillStyle = "#ebdcc7";
      ctx.fillRect(520, 40, 520, 680);
      ctx.restore();
    }

    // 3. LOGO OFICIAL TARHGET NO TOPO DIREITO
    ctx.save();
    try {
      const logoImg = new Image();
      logoImg.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        logoImg.onload = () => resolve();
        logoImg.onerror = () => reject();
        logoImg.src = "/images/tarhget-logo.png";
      });
      ctx.drawImage(logoImg, 860, 40, 170, 75);
    } catch {
      // Fallback em vetor puro idêntico à identidade Tarhget
      ctx.beginPath();
      ctx.arc(945, 68, 28, 0, Math.PI * 2);
      ctx.strokeStyle = PALETTE.wine;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.font = "bold 32px 'Times New Roman', serif";
      ctx.fillStyle = PALETTE.wine;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("T", 945, 67);

      ctx.font = "bold 15px 'Montserrat', sans-serif";
      ctx.letterSpacing = "3px";
      ctx.fillText(companyName.toUpperCase(), 945, 112);
    }
    ctx.restore();

    // 4. CABEÇALHO DO POST (TOPO ESQUERDO)
    ctx.save();
    ctx.textAlign = "left";

    // Número da Vaga
    if (data.jobCode) {
      ctx.font = "bold 23px 'Montserrat', 'Inter', sans-serif";
      ctx.fillStyle = PALETTE.textDark;
      ctx.fillText(`VAGA Nº ${data.jobCode}`, 50, 64);
    }

    // "OPORTUNIDADE" (Grande e imponente em Vinho Nobre)
    ctx.font = "900 60px 'Montserrat', 'Impact', sans-serif";
    ctx.fillStyle = PALETTE.wine;
    ctx.fillText("OPORTUNIDADE", 50, 126);

    // "DE EMPREGO" (Dourado sofisticado)
    ctx.font = "900 60px 'Montserrat', 'Impact', sans-serif";
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText("DE EMPREGO", 50, 185);

    // "Estamos contratando!" (Letra cursiva elegante)
    ctx.font = "700 44px 'Caveat', 'Dancing Script', 'Brush Script MT', cursive";
    ctx.fillStyle = PALETTE.wineDark;
    ctx.fillText(data.opportunitySubtitle || "Estamos contratando!", 52, 232);
    ctx.restore();

    // 5. CARD PRINCIPAL BRANCO COM BORDA DOURADA (INFORMAÇÕES DA VAGA)
    const cardX = 46;
    const cardY = 252;
    const cardW = 540;
    const cardH = 440;
    const radius = 22;

    ctx.save();
    // Sombra sutil do card
    ctx.shadowColor = "rgba(0, 0, 0, 0.08)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 6;

    // Fundo do Card
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, radius);
    ctx.fillStyle = PALETTE.cardBg;
    ctx.fill();

    // Borda Dourada Elegante
    ctx.shadowColor = "transparent";
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = PALETTE.cardBorder;
    ctx.stroke();

    // CONTEÚDO DENTRO DO CARD
    // Título do Cargo (ex: CONSULTOR(A) MERCHAN JR)
    ctx.textAlign = "center";
    ctx.fillStyle = PALETTE.wineDark;
    ctx.font = "900 32px 'Montserrat', sans-serif";

    // Quebra se o título for longo
    const words = data.roleTitle.toUpperCase().split(" ");
    let line1 = "";
    let line2 = "";
    if (words.length <= 2) {
      line1 = data.roleTitle.toUpperCase();
    } else {
      const mid = Math.ceil(words.length / 2);
      line1 = words.slice(0, mid).join(" ");
      line2 = words.slice(mid).join(" ");
    }

    if (line2) {
      ctx.fillText(line1, cardX + cardW / 2, cardY + 45);
      ctx.fillText(line2, cardX + cardW / 2, cardY + 80);
    } else {
      ctx.fillText(line1, cardX + cardW / 2, cardY + 54);
    }

    // Pílula do Segmento (ex: SEGMENTO DE COSMÉTICOS E CUIDADOS PESSOAIS)
    const segmentY = line2 ? cardY + 112 : cardY + 86;
    if (data.segmentSubtitle) {
      const segText = data.segmentSubtitle.toUpperCase();
      ctx.font = "700 12px 'Montserrat', sans-serif";
      const segWidth = Math.min(ctx.measureText(segText).width + 30, cardW - 40);

      ctx.beginPath();
      ctx.roundRect(cardX + (cardW - segWidth) / 2, segmentY - 14, segWidth, 24, 6);
      ctx.strokeStyle = "#d4bfa6";
      ctx.fillStyle = "#f8f5ee";
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#5c473f";
      ctx.fillText(segText.slice(0, 48), cardX + cardW / 2, segmentY + 2);
    }

    // 5 LINHAS DE DETALHES COM ÍCONES VETORIAIS CIRCULARES
    const detailStartY = line2 ? cardY + 148 : cardY + 128;
    const rowSpacing = 54;

    const rows = [
      {
        icon: "pin" as const,
        title: "Local",
        text: data.location || "Fortaleza - CE",
      },
      {
        icon: "store" as const,
        title: "Roteiro",
        text: data.route || "Cobertura de lojas conforme roteiro",
      },
      {
        icon: "calendar" as const,
        title: "Início",
        text: data.startDate || "Imediato - a confirmar",
      },
      {
        icon: "contract" as const,
        title: "Contratação",
        text: data.contractType || "Regime CLT – EFETIVO",
      },
      {
        icon: "clock" as const,
        title: "Escala",
        text: data.workSchedule || "44h semanais",
      },
    ];

    rows.forEach((row, idx) => {
      const rowY = detailStartY + idx * rowSpacing;
      const iconCX = cardX + 38;
      const iconCY = rowY + 8;

      // Círculo marrom/vinho do ícone
      ctx.beginPath();
      ctx.arc(iconCX, iconCY, 18, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.wine;
      ctx.fill();

      // Desenha o ícone em branco dentro do círculo
      drawIcon(ctx, row.icon, iconCX, iconCY, 18, "#ffffff");

      // Texto do Detalhe (ex: "Local: Fortaleza - CE")
      ctx.textAlign = "left";
      ctx.font = "bold 17px 'Montserrat', 'Inter', sans-serif";
      ctx.fillStyle = PALETTE.textDark;
      const prefix = `${row.title}: `;
      ctx.fillText(prefix, cardX + 68, rowY + 14);

      const prefixWidth = ctx.measureText(prefix).width;
      ctx.font = "500 16px 'Montserrat', 'Inter', sans-serif";
      ctx.fillStyle = "#2e2320";

      // Trunca o texto se exceder o limite do card
      const maxTextWidth = cardW - 74 - prefixWidth;
      let displayVal = row.text;
      while (ctx.measureText(displayVal).width > maxTextWidth && displayVal.length > 5) {
        displayVal = displayVal.slice(0, -2) + "…";
      }
      ctx.fillText(displayVal, cardX + 68 + prefixWidth, rowY + 14);
    });

    ctx.restore();

    // 6. FAIXA ONDULADA DOURADA INFERIOR (REMUNERAÇÃO E BENEFÍCIOS)
    const waveY = 724;
    ctx.save();

    // Desenha a curva ondulada estilizada
    ctx.beginPath();
    ctx.moveTo(0, waveY + 12);
    ctx.bezierCurveTo(240, waveY - 24, 600, waveY + 28, W, waveY - 8);
    ctx.lineTo(W, 955);
    ctx.lineTo(0, 955);
    ctx.closePath();

    // Gradiente da faixa de benefícios
    const ribbonGrad = ctx.createLinearGradient(0, waveY, 0, 955);
    ribbonGrad.addColorStop(0, "#e8d8c2");
    ribbonGrad.addColorStop(0.5, "#eedfcb");
    ribbonGrad.addColorStop(1, "#dec8ab");
    ctx.fillStyle = ribbonGrad;
    ctx.fill();

    // Linha dourada do contorno superior da onda
    ctx.beginPath();
    ctx.moveTo(0, waveY + 12);
    ctx.bezierCurveTo(240, waveY - 24, 600, waveY + 28, W, waveY - 8);
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // TÍTULO DA FAIXA: REMUNERAÇÃO E BENEFÍCIOS
    ctx.textAlign = "center";
    ctx.font = "900 28px 'Montserrat', sans-serif";
    ctx.fillStyle = PALETTE.wine;
    ctx.fillText("REMUNERAÇÃO E BENEFÍCIOS", W / 2, waveY + 48);

    // 5 COLUNAS DE BENEFÍCIOS COM ÍCONES DOURADOS
    const benefitCols = [
      {
        icon: "coins" as const,
        label: "Salário:",
        value: data.salary || "R$ 1.839,41",
        boldVal: true,
      },
      {
        icon: "meal" as const,
        label: "VALE REFEIÇÃO",
        value: data.mealVoucher || "R$ 35,00/dia",
        boldVal: false,
      },
      {
        icon: "aid" as const,
        label: "AJUDA DE CUSTO",
        value: data.costAid || "(de acordo com o roteiro)",
        boldVal: false,
      },
      {
        icon: "health" as const,
        label: "CONVÊNIO MÉDICO",
        value: data.healthInsurance || "e odontológico",
        boldVal: false,
      },
      {
        icon: "phone" as const,
        label: "APARELHO",
        value: data.corporatePhone || "CORPORATIVO",
        boldVal: false,
      },
    ];

    const colWidth = W / 5;
    benefitCols.forEach((col, idx) => {
      const colCenterX = colWidth * idx + colWidth / 2;
      const iconCY = waveY + 98;

      // Ícone dourado/bronzeado
      drawIcon(ctx, col.icon, colCenterX, iconCY, 26, PALETTE.goldDark);

      // Label (ex: "VALE REFEIÇÃO")
      ctx.textAlign = "center";
      ctx.font = "800 13px 'Montserrat', sans-serif";
      ctx.fillStyle = PALETTE.wineDark;
      ctx.fillText(col.label, colCenterX, waveY + 145);

      // Valor (ex: "R$ 35,00/dia")
      ctx.font = col.boldVal
        ? "800 16px 'Montserrat', sans-serif"
        : "600 13px 'Montserrat', sans-serif";
      ctx.fillStyle = PALETTE.textDark;

      // Trunca se muito longo
      let val = col.value;
      if (val.length > 24) val = val.slice(0, 22) + "…";
      ctx.fillText(val, colCenterX, waveY + 168);
    });

    ctx.restore();

    // 7. RODAPÉ INFERIOR (CTA + AVISO)
    const footerY = 960;
    ctx.save();

    // Pílula Vinho de Chamada para Ação (Acesse o link na nossa bio do Instagram...)
    const ctaX = 110;
    const ctaY = footerY + 8;
    const ctaW = 860;
    const ctaH = 48;
    const ctaRadius = 24;

    ctx.shadowColor = "rgba(64, 17, 20, 0.25)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;

    ctx.beginPath();
    ctx.roundRect(ctaX, ctaY, ctaW, ctaH, ctaRadius);
    ctx.fillStyle = PALETTE.wine;
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 20px 'Montserrat', sans-serif";
    ctx.fillText(data.ctaText || "Acesse o link na nossa bio do Instagram para se candidatar! 👆", W / 2, ctaY + 31);

    // Disclaimer inferior com ícone de atenção
    ctx.font = "600 13px 'Montserrat', sans-serif";
    ctx.fillStyle = "#4a3b36";
    ctx.fillText(
      data.disclaimer || "⚠️ Atenção: Inscrições abertas! Confira todos os detalhes sobre perfil e requisitos diretamente em nosso portal.",
      W / 2,
      ctaY + 80
    );

    ctx.restore();

    // Converte para dataUrl para permitir download e visualização rápida
    try {
      const dataUrl = canvas.toDataURL("image/png");
      setCanvasDataUrl(dataUrl);
    } catch {
      // ignore
    }

    setIsRendering(false);
  }, [data, companyName]);

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

  // Copia a imagem direto para a área de transferência para colar no WhatsApp / Canva
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
      console.warn("Clipboard write failed, downloading fallback:", err);
      handleDownload();
    }
  };

  return (
    <div className="flex flex-col items-center">
      {/* Barra de Ações Rápidas no Topo do Preview */}
      <div className="mb-4 flex flex-wrap items-center justify-between w-full gap-2 px-1">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-[#faece7] px-3 py-1 text-xs font-bold text-[#8f281e]">
            <Sparkles className="size-3.5" />
            1080 × 1080 px (Feed Instagram)
          </span>
          {isRendering && (
            <span className="text-xs text-[#71717a] flex items-center gap-1">
              <RefreshCw className="size-3 animate-spin" /> Renderizando...
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onRandomModel && (
            <button
              type="button"
              onClick={onRandomModel}
              title="Trocar foto do modelo de varejo"
              className="flex items-center gap-1.5 rounded-xl border border-[#e4e4e7] bg-white px-3 py-1.5 text-xs font-medium text-[#0a0a0a] shadow-xs hover:bg-[#fafaf9] transition-colors"
            >
              <RefreshCw className="size-3.5 text-[#71717a]" />
              Trocar modelo
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyImage}
            title="Copiar imagem para colar direto no WhatsApp, Telegram ou Canva"
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
                Copiar imagem
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
            <Eye className="size-3.5" /> Clique para ampliar
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
              <span className="text-sm font-bold text-[#0a0a0a]">Pré-visualização 1080×1080 (HQ)</span>
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
    </div>
  );
}
