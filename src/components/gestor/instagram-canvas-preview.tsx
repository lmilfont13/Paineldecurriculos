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

  // Injeta Google Fonts no documento
  useEffect(() => {
    if (typeof document !== "undefined") {
      const fontId = "tarhget-official-template-fonts-v2";
      if (!document.getElementById(fontId)) {
        const link = document.createElement("link");
        link.id = fontId;
        link.rel = "stylesheet";
        link.href =
          "https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:ital,wght@0,500;0,600;0,700;0,800;1,700&family=Bebas+Neue&family=Great+Vibes&family=Montserrat:wght@700;800;900&display=swap";
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

    // Aguarda fontes externas
    try {
      if (typeof document !== "undefined" && document.fonts) {
        await Promise.allSettled([
          document.fonts.load('38px "Bebas Neue"'),
          document.fonts.load('18px "Barlow Semi Condensed"'),
          document.fonts.load('44px "Great Vibes"'),
          document.fonts.load('bold 14px "Montserrat"'),
        ]);
        await document.fonts.ready;
      }
    } catch {
      // continua com fontes nativas
    }

    const W = 1080;
    const H = 1080;
    canvas.width = W;
    canvas.height = H;

    // Determina a foto da modelo (oficial limpa ou alternativa)
    const modelSrc =
      data.modelImage && !data.modelImage.includes("master-template")
        ? data.modelImage
        : "/images/templates/official-model-clean.png";

    // Converte a imagem da modelo para base64 para injeção limpa no SVG
    let modelBase64 = "";
    try {
      if (modelSrc.startsWith("data:")) {
        modelBase64 = modelSrc;
      } else {
        const resp = await fetch(modelSrc);
        const blob = await resp.blob();
        modelBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }
    } catch (err) {
      console.warn("[canvas] Falha ao carregar imagem da modelo:", err);
    }

    // Tratamento de quebra do título do cargo
    const cleanTitle = (data.roleTitle || "CONSULTOR(A) MERCHAN JR").toUpperCase().trim();
    const words = cleanTitle.split(" ");
    let titleLine1 = cleanTitle;
    let titleLine2 = "";

    if (cleanTitle.length > 20 && words.length >= 2) {
      const mid = Math.ceil(words.length / 2);
      titleLine1 = words.slice(0, mid).join(" ");
      titleLine2 = words.slice(mid).join(" ");
    }

    // Tratamento de quebra da escala e roteiro se longos
    const routeText = data.route || "Cobertura de lojas conforme roteiro";
    let routeLine1 = routeText;
    let routeLine2 = "";
    if (routeText.includes("|")) {
      const parts = routeText.split("|");
      routeLine1 = parts[0].trim();
      routeLine2 = "| " + parts.slice(1).join("|").trim();
    }

    const scheduleText = data.workSchedule || "44h semanais — Seg a Sex e Sáb";
    let scheduleLine1 = scheduleText;
    let scheduleLine2 = "";
    if (scheduleText.includes("—")) {
      const parts = scheduleText.split("—");
      scheduleLine1 = parts[0].trim() + " —";
      scheduleLine2 = parts[1].trim();
    }

    // Escapa caracteres especiais para SVG
    const escapeXml = (str: string) =>
      str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

    // Geração do SVG Mestre com Fidelidade Absoluta
    const svgString = `
    <svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:ital,wght@0,500;0,600;0,700;0,800;1,700&amp;family=Bebas+Neue&amp;family=Great+Vibes&amp;family=Montserrat:wght@700;800;900&amp;display=swap');
          
          .font-vaga { font-family: 'Bebas Neue', Impact, sans-serif; font-size: 26px; fill: #1d1816; letter-spacing: 1.2px; }
          .font-oportunidade { font-family: 'Bebas Neue', Impact, sans-serif; font-size: 68px; fill: #431317; letter-spacing: 0.5px; }
          .font-de-emprego { font-family: 'Bebas Neue', Impact, sans-serif; font-size: 68px; fill: #a37a4a; letter-spacing: 0.5px; }
          .font-contratando { font-family: 'Great Vibes', 'Dancing Script', cursive; font-size: 44px; fill: #231012; }
          .font-logo-text { font-family: 'Montserrat', sans-serif; font-weight: 800; font-size: 15px; fill: #431317; letter-spacing: 3.5px; text-anchor: middle; }
          
          .font-role-title { font-family: 'Bebas Neue', Impact, sans-serif; font-size: 38px; fill: #241113; text-anchor: middle; letter-spacing: 0.5px; }
          .font-pill-text { font-family: 'Barlow Semi Condensed', sans-serif; font-weight: 700; font-size: 13px; fill: #2a1714; letter-spacing: 0.8px; text-anchor: middle; }
          
          .font-prefix { font-family: 'Barlow Semi Condensed', sans-serif; font-weight: 700; font-size: 18px; fill: #1a100e; }
          .font-detail-val { font-family: 'Barlow Semi Condensed', sans-serif; font-weight: 600; font-size: 17px; fill: #281915; }
          
          .font-ribbon-title { font-family: 'Bebas Neue', Impact, sans-serif; font-size: 30px; fill: #431317; letter-spacing: 1.5px; text-anchor: middle; }
          .font-benefit-label { font-family: 'Montserrat', sans-serif; font-weight: 800; font-size: 13px; fill: #431317; text-anchor: middle; }
          .font-benefit-val-bold { font-family: 'Bebas Neue', sans-serif; font-size: 21px; fill: #1a100e; text-anchor: middle; letter-spacing: 0.5px; }
          .font-benefit-val-sub { font-family: 'Barlow Semi Condensed', sans-serif; font-weight: 600; font-size: 14px; fill: #281914; text-anchor: middle; }
          
          .font-cta { font-family: 'Montserrat', sans-serif; font-weight: 800; font-size: 21px; fill: #ffffff; text-anchor: middle; }
          .font-disclaimer { font-family: 'Barlow Semi Condensed', sans-serif; font-weight: 600; font-size: 14px; fill: #3a2820; text-anchor: middle; }
        </style>

        <linearGradient id="bgGrad" x1="0" y1="0" x2="1080" y2="1080" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#faf6ed" />
          <stop offset="50%" stop-color="#f3ebdb" />
          <stop offset="100%" stop-color="#e9ddc9" />
        </linearGradient>

        <linearGradient id="waveGrad" x1="0" y1="730" x2="0" y2="960" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#eedfcb" />
          <stop offset="40%" stop-color="#e4d1b8" />
          <stop offset="100%" stop-color="#d1b794" />
        </linearGradient>

        <linearGradient id="fadeMaskGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#000000" stop-opacity="0" />
          <stop offset="25%" stop-color="#ffffff" stop-opacity="0.85" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="1" />
        </linearGradient>
        <mask id="modelFadeMask">
          <rect x="490" y="0" width="590" height="750" fill="url(#fadeMaskGrad)" />
        </mask>

        <filter id="cardShadow" x="-10%" y="-10%" width="125%" height="125%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#3d2218" flood-opacity="0.10" />
        </filter>

        <filter id="ctaShadow" x="-10%" y="-20%" width="120%" height="150%">
          <feDropShadow dx="0" dy="5" stdDeviation="6" flood-color="#431317" flood-opacity="0.25" />
        </filter>
      </defs>

      <!-- 1. FUNDO GERAL SATIN COM LEVE AQUECIMENTO -->
      <rect width="1080" height="1080" fill="url(#bgGrad)" />

      <!-- 2. FOTO DA MODELO DE VAREJO COM FUSÃO SUAVE -->
      ${
        modelBase64
          ? `<g mask="url(#modelFadeMask)">
               <image href="${modelBase64}" x="490" y="0" width="590" height="745" preserveAspectRatio="xMidYMid slice" />
             </g>`
          : ""
      }

      <!-- 3. LOGO OFICIAL TARHGET NO TOPO DIREITO -->
      <g transform="translate(935, 68)">
        <circle cx="0" cy="0" r="32" fill="none" stroke="#431317" stroke-width="3" />
        <line x1="-16" y1="-12" x2="16" y2="-12" stroke="#431317" stroke-width="4" stroke-linecap="round" />
        <line x1="0" y1="-12" x2="0" y2="18" stroke="#431317" stroke-width="3.5" stroke-linecap="round" />
        <text x="0" y="48" class="font-logo-text">TARHGET</text>
      </g>

      <!-- 4. CABEÇALHO DO POST (TOPO ESQUERDO) -->
      ${
        data.jobCode
          ? `<text x="50" y="58" class="font-vaga">VAGA Nº ${escapeXml(data.jobCode)}</text>`
          : ""
      }
      <text x="50" y="122" class="font-oportunidade">OPORTUNIDADE</text>
      <text x="50" y="182" class="font-de-emprego">DE EMPREGO</text>
      <text x="52" y="234" class="font-contratando">Estamos contratando!</text>

      <!-- 5. CARD PRINCIPAL COM BORDA DOURADA -->
      <g filter="url(#cardShadow)">
        <rect x="46" y="254" width="554" height="476" rx="24" fill="#fcf8ef" stroke="#ba9a6d" stroke-width="2.2" />
      </g>

      <!-- QUADRO DO CARGO DENTRO DO CARD -->
      <rect x="62" y="270" width="522" height="136" rx="18" fill="#fbf5e7" stroke="#3e221b" stroke-width="2.2" />
      ${
        titleLine2
          ? `<text x="323" y="322" class="font-role-title">${escapeXml(titleLine1)}</text>
             <text x="323" y="360" class="font-role-title">${escapeXml(titleLine2)}</text>`
          : `<text x="323" y="340" class="font-role-title">${escapeXml(titleLine1)}</text>`
      }

      <!-- Pílula do Segmento -->
      ${
        data.segmentSubtitle
          ? `<rect x="160" y="377" width="326" height="24" rx="12" fill="#f6efe0" stroke="#856d5c" stroke-width="1.2" />
             <text x="323" y="393" class="font-pill-text">${escapeXml(data.segmentSubtitle.toUpperCase())}</text>`
          : ""
      }

      <!-- 5 LINHAS COM OS 5 ÍCONES VETORIAIS CIRCULARES VINHO -->
      <!-- Linha 1: Local -->
      <g transform="translate(74, 442)">
        <circle cx="0" cy="0" r="18" fill="#431317" />
        <path d="M0 -8 A 5.5 5.5 0 0 1 0 3 L0 8 Z" fill="none" stroke="#ffffff" stroke-width="2" stroke-linejoin="round" />
        <circle cx="0" cy="-2.5" r="2" fill="#ffffff" />
      </g>
      <text x="104" y="448" class="font-prefix">Local: <tspan class="font-detail-val">${escapeXml(data.location || "Fortaleza - CE")}</tspan></text>

      <!-- Linha 2: Roteiro -->
      <g transform="translate(74, 494)">
        <circle cx="0" cy="0" r="18" fill="#431317" />
        <rect x="-8" y="-3" width="16" height="11" fill="none" stroke="#ffffff" stroke-width="1.8" />
        <path d="M-9 -3 L-6 -8 L6 -8 L9 -3 Z" fill="none" stroke="#ffffff" stroke-width="1.8" />
        <rect x="-2.5" y="2" width="5" height="6" fill="none" stroke="#ffffff" stroke-width="1.6" />
      </g>
      <text x="104" y="492" class="font-prefix">Roteiro: <tspan class="font-detail-val">${escapeXml(routeLine1)}</tspan></text>
      ${
        routeLine2
          ? `<text x="104" y="510" class="font-detail-val">${escapeXml(routeLine2)}</text>`
          : ""
      }

      <!-- Linha 3: Início -->
      <g transform="translate(74, 550)">
        <circle cx="0" cy="0" r="18" fill="#431317" />
        <rect x="-7" y="-6" width="14" height="14" rx="2" fill="none" stroke="#ffffff" stroke-width="1.8" />
        <line x1="-7" y1="-1" x2="7" y2="-1" stroke="#ffffff" stroke-width="1.6" />
        <line x1="-3.5" y1="-8" x2="-3.5" y2="-5" stroke="#ffffff" stroke-width="1.8" />
        <line x1="3.5" y1="-8" x2="3.5" y2="-5" stroke="#ffffff" stroke-width="1.8" />
      </g>
      <text x="104" y="556" class="font-prefix">Início: <tspan class="font-detail-val">${escapeXml(data.startDate || "Imediato - a confirmar")}</tspan></text>

      <!-- Linha 4: Contratação -->
      <g transform="translate(74, 604)">
        <circle cx="0" cy="0" r="18" fill="#431317" />
        <rect x="-6" y="-8" width="12" height="16" rx="1.5" fill="none" stroke="#ffffff" stroke-width="1.8" />
        <line x1="-3" y1="-3" x2="3" y2="-3" stroke="#ffffff" stroke-width="1.6" />
        <line x1="-3" y1="0.5" x2="3" y2="0.5" stroke="#ffffff" stroke-width="1.6" />
        <line x1="-3" y1="4" x2="1" y2="4" stroke="#ffffff" stroke-width="1.6" />
      </g>
      <text x="104" y="610" class="font-prefix">Contratação: <tspan class="font-detail-val">${escapeXml(data.contractType || "Regime CLT – EFETIVO")}</tspan></text>

      <!-- Linha 5: Escala -->
      <g transform="translate(74, 658)">
        <circle cx="0" cy="0" r="18" fill="#431317" />
        <circle cx="0" cy="0" r="7.5" fill="none" stroke="#ffffff" stroke-width="1.8" />
        <polyline points="0,-4.5 0,0 3.5,2" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" />
      </g>
      <text x="104" y="656" class="font-prefix">Escala: <tspan class="font-detail-val">${escapeXml(scheduleLine1)}</tspan></text>
      ${
        scheduleLine2
          ? `<text x="104" y="674" class="font-detail-val">${escapeXml(scheduleLine2)}</text>`
          : ""
      }

      <!-- 6. FAIXA ONDULADA DOURADA INFERIOR -->
      <path d="M 0 740 Q 280 770 540 735 T 1080 725 L 1080 965 L 0 965 Z" fill="url(#waveGrad)" stroke="#a37a4a" stroke-width="3" />
      <text x="540" y="775" class="font-ribbon-title">REMUNERAÇÃO E BENEFÍCIOS</text>

      <!-- 5 COLUNAS DE BENEFÍCIOS -->
      <!-- Col 1: Salário -->
      <g transform="translate(135, 815)">
        <ellipse cx="-2" cy="-4" rx="8" ry="3.5" fill="none" stroke="#856235" stroke-width="2" />
        <ellipse cx="-2" cy="1" rx="8" ry="3.5" fill="none" stroke="#856235" stroke-width="2" />
        <ellipse cx="-2" cy="6" rx="8" ry="3.5" fill="none" stroke="#856235" stroke-width="2" />
        <ellipse cx="6" cy="5" rx="6" ry="2.8" fill="none" stroke="#856235" stroke-width="2" />
      </g>
      <text x="135" y="855" class="font-benefit-label">Salário:</text>
      <text x="135" y="880" class="font-benefit-val-bold">${escapeXml(data.salary || "R$ 1.839,41")}</text>

      <!-- Col 2: VR -->
      <g transform="translate(335, 815)">
        <circle cx="0" cy="0" r="9" fill="none" stroke="#856235" stroke-width="2" />
        <line x1="-13" y1="-8" x2="-13" y2="8" stroke="#856235" stroke-width="2" stroke-linecap="round" />
        <line x1="13" y1="-8" x2="13" y2="8" stroke="#856235" stroke-width="2" stroke-linecap="round" />
      </g>
      <text x="335" y="855" class="font-benefit-label">VALE REFEIÇÃO</text>
      <text x="335" y="880" class="font-benefit-val-bold">${escapeXml(data.mealVoucher || "R$ 35,00/dia")}</text>

      <!-- Col 3: Ajuda -->
      <g transform="translate(535, 815)">
        <rect x="-10" y="2" width="4.5" height="7" fill="none" stroke="#856235" stroke-width="1.8" />
        <rect x="-3" y="-3" width="4.5" height="12" fill="none" stroke="#856235" stroke-width="1.8" />
        <rect x="4" y="-8" width="4.5" height="17" fill="none" stroke="#856235" stroke-width="1.8" />
        <path d="M-10 -2 L8 -11 L4 -11" fill="none" stroke="#856235" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <text x="535" y="855" class="font-benefit-label">AJUDA DE CUSTO</text>
      <text x="535" y="880" class="font-benefit-val-sub">${escapeXml(data.costAid || "(de acordo com o roteiro)")}</text>

      <!-- Col 4: Convênio -->
      <g transform="translate(735, 815)">
        <path d="M0 9 C-12 3 -12 -7 0 -2 C12 -7 12 3 0 9 Z" fill="none" stroke="#856235" stroke-width="2" stroke-linejoin="round" />
        <line x1="-3.5" y1="2" x2="3.5" y2="2" stroke="#856235" stroke-width="1.8" />
        <line x1="0" y1="-1.5" x2="0" y2="5.5" stroke="#856235" stroke-width="1.8" />
      </g>
      <text x="735" y="855" class="font-benefit-label">CONVÊNIO</text>
      <text x="735" y="880" class="font-benefit-val-sub">${escapeXml(data.healthInsurance || "e odontológico")}</text>

      <!-- Col 5: Aparelho -->
      <g transform="translate(935, 815)">
        <rect x="-7" y="-10" width="14" height="20" rx="3" fill="none" stroke="#856235" stroke-width="2" />
        <circle cx="0" cy="6" r="1.5" fill="#856235" />
      </g>
      <text x="935" y="855" class="font-benefit-label">APARELHO</text>
      <text x="935" y="880" class="font-benefit-val-bold">${escapeXml(data.corporatePhone || "CORPORATIVO")}</text>

      <!-- 7. RODAPÉ CTA COM PÍLULA VINHO E CURSOR -->
      <g filter="url(#ctaShadow)">
        <rect x="110" y="975" width="860" height="50" rx="25" fill="#431317" />
      </g>
      <text x="540" y="1007" class="font-cta">Acesse o link na nossa bio do Instagram para se candidatar! 👆</text>

      <!-- Disclaimer -->
      <text x="540" y="1052" class="font-disclaimer">${escapeXml(
        data.disclaimer ||
          "⚠️ Atenção: Inscrições abertas! Confira todos os detalhes sobre perfil e requisitos diretamente em nosso portal."
      )}</text>
    </svg>
    `;

    // Desenha o SVG no Canvas através de Blob URL
    try {
      const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          ctx.clearRect(0, 0, W, H);
          ctx.drawImage(img, 0, 0, W, H);
          URL.revokeObjectURL(url);
          resolve();
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("Falha ao renderizar SVG no canvas"));
        };
        img.src = url;
      });

      const dataUrl = canvas.toDataURL("image/png");
      setCanvasDataUrl(dataUrl);
    } catch (err) {
      console.error("[canvas] Erro ao renderizar:", err);
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
