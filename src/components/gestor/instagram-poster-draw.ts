/**
 * Desenho do cartaz de vaga (1080×1080) no navegador, em camadas:
 * fundo bege → foto → degradê → faixa dourada → textos e ícones.
 *
 * As peças fixas (cabeçalho "Oportunidade de emprego", ícones, logo, mão do
 * botão) foram recortadas do cartaz oficial e ficam em /images/poster. A
 * fonte (Roboto Condensed) é servida pelo próprio site, então o cartaz nunca
 * sai em Arial por falta de internet ou atraso do Google Fonts.
 */
import {
  balanceTitle,
  benefitCenters,
  cleanPosterText,
  posterBenefits,
  posterDisclaimer,
  posterInfoRows,
  posterTitle,
  wrapWords,
  type PosterBenefitIcon,
  type PosterInfoIcon,
} from "@/server/models/poster.model";
import type { SocialJobPostData } from "@/server/models/social-post.model";

export const POSTER_SIZE = 1080;

const BEIGE = "#e6cfa6";
const INK = "#2b0e0b";
const BROWN = "#3a1410";
const BAR = "#350c0c";
const CTA_TEXT = "#e2c592";
const FONT = '"Roboto Condensed Poster", "Roboto Condensed", "Arial Narrow", sans-serif';

/** Foto padrão (a modelo do cartaz oficial, sem texto e sem logo por cima). */
export const DEFAULT_POSTER_PHOTO = "/images/poster/foto-padrao.jpg";

/** Fotos antigas do template "achatado" passam a usar a foto limpa. */
export function posterPhotoSrc(modelImage: string | null | undefined): string {
  if (
    !modelImage ||
    /master-(base|template|original|clean)|official-model/.test(modelImage)
  ) {
    return DEFAULT_POSTER_PHOTO;
  }
  return modelImage;
}

// Faixa dourada: bordas de cima e de baixo, amostradas a cada 20 px a partir
// do cartaz oficial.
const RIBBON_TOP = [
  748.3, 755.7, 762, 767.1, 771, 774, 776, 777.2, 777.6, 777.4, 776.7, 775.5, 774, 772.1, 770, 767.8, 765.4, 763,
  760.6, 758.2, 755.9, 753.6, 751.4, 749.3, 747.3, 745.3, 743.5, 741.8, 740.1, 738.6, 737.1, 735.7, 734.4, 733.2,
  732.1, 731.1, 730.3, 729.7, 729.3, 729.2, 729.4, 730.1, 731.2, 732.8, 735.1, 738.2, 742.1, 746.9, 752.8, 759.9,
  768.2, 777.9, 789.1, 801.8, 816.2,
];
const RIBBON_BOTTOM = [
  771.9, 778.4, 783.6, 787.7, 790.8, 792.9, 794.2, 794.7, 794.6, 794, 792.8, 791.3, 789.5, 787.5, 785.2, 782.9, 780.4,
  778, 775.5, 773.1, 770.7, 768.4, 766.1, 764, 761.9, 759.9, 758.1, 756.3, 754.6, 753, 751.5, 750.2, 748.9, 747.8,
  746.8, 746, 745.4, 745, 745, 745.2, 745.9, 747, 748.7, 751, 753.9, 757.6, 762.2, 767.8, 774.4, 782.2, 791.2, 801.5,
  813.2, 826.4, 841.1,
];

const INFO_ICONS: PosterInfoIcon[] = ["local", "roteiro", "inicio", "contrato", "escala"];
const BENEFIT_ICONS: PosterBenefitIcon[] = ["salary", "meal", "aid", "health", "phone"];

export type PosterAssets = {
  header: HTMLImageElement;
  logo: HTMLImageElement;
  hand: HTMLImageElement;
  info: Record<PosterInfoIcon, HTMLImageElement>;
  benefit: Record<PosterBenefitIcon, HTMLImageElement>;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Não carregou ${src}`));
    img.src = src;
  });
}

let fontsReady: Promise<void> | null = null;

/** Registra a fonte do cartaz (uma vez por página). */
function loadPosterFonts(): Promise<void> {
  if (fontsReady) return fontsReady;
  fontsReady = (async () => {
    if (typeof FontFace === "undefined" || typeof document === "undefined") return;
    const weights = [400, 500, 600, 700];
    const faces = weights.map(
      (w) =>
        new FontFace("Roboto Condensed Poster", `url(/fonts/roboto-condensed-latin-${w}-normal.woff2) format("woff2")`, {
          weight: String(w),
          style: "normal",
        })
    );
    const loaded = await Promise.allSettled(faces.map((f) => f.load()));
    loaded.forEach((r) => {
      if (r.status === "fulfilled") document.fonts.add(r.value);
    });
  })();
  return fontsReady;
}

let assetsReady: Promise<PosterAssets> | null = null;

export function loadPosterAssets(): Promise<PosterAssets> {
  if (assetsReady) return assetsReady;
  assetsReady = (async () => {
    const base = "/images/poster";
    const [header, logo, hand, infoImgs, benefitImgs] = await Promise.all([
      loadImage(`${base}/cabecalho.png`),
      loadImage(`${base}/logo.png`),
      loadImage(`${base}/mao.png`),
      Promise.all(INFO_ICONS.map((n) => loadImage(`${base}/info-${n}.png`))),
      Promise.all(BENEFIT_ICONS.map((n) => loadImage(`${base}/beneficio-${n}.png`))),
      loadPosterFonts(),
    ]);
    return {
      header,
      logo,
      hand,
      info: Object.fromEntries(INFO_ICONS.map((n, i) => [n, infoImgs[i]])) as PosterAssets["info"],
      benefit: Object.fromEntries(BENEFIT_ICONS.map((n, i) => [n, benefitImgs[i]])) as PosterAssets["benefit"],
    };
  })();
  // Se falhar, permite tentar de novo no próximo desenho.
  assetsReady.catch(() => {
    assetsReady = null;
  });
  return assetsReady;
}

export function loadPosterPhoto(src: string): Promise<HTMLImageElement> {
  return loadImage(src).catch(() => loadImage(DEFAULT_POSTER_PHOTO));
}

type Ctx = CanvasRenderingContext2D;

function font(ctx: Ctx, weight: number, size: number) {
  ctx.font = `${weight} ${size}px ${FONT}`;
}

/** Diminui a letra até o texto caber na largura. */
function fitSize(ctx: Ctx, text: string, weight: number, size: number, maxWidth: number, min: number): number {
  let s = size;
  font(ctx, weight, s);
  while (s > min && ctx.measureText(text).width > maxWidth) {
    s -= 1;
    font(ctx, weight, s);
  }
  return s;
}

/** Foto no recorte da direita, cobrindo a área sem distorcer. */
function drawPhoto(ctx: Ctx, photo: HTMLImageElement, isDefault: boolean) {
  const x = 560;
  const w = POSTER_SIZE - x;
  const h = 830;
  if (isDefault) {
    ctx.drawImage(photo, x, 0, w, h);
  } else {
    const scale = Math.max(w / photo.naturalWidth, h / photo.naturalHeight);
    const sw = w / scale;
    const sh = h / scale;
    const sx = (photo.naturalWidth - sw) / 2;
    const sy = Math.max(0, (photo.naturalHeight - sh) * 0.25); // rosto costuma ficar no alto
    ctx.drawImage(photo, sx, sy, sw, sh, x, 0, w, h);
  }
  // Degradê que funde a foto no bege, como no original.
  const fade = ctx.createLinearGradient(x, 0, x + (isDefault ? 70 : 110), 0);
  fade.addColorStop(0, "rgba(230,207,166,1)");
  fade.addColorStop(1, "rgba(230,207,166,0)");
  ctx.fillStyle = fade;
  ctx.fillRect(x, 0, isDefault ? 70 : 110, h);
}

function ribbonPath(ctx: Ctx, edge: number[]) {
  edge.forEach((y, i) => {
    const x = Math.min(POSTER_SIZE, i * 20);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
}

function drawRibbon(ctx: Ctx) {
  // Bege por baixo da faixa até o fim do cartaz.
  ctx.beginPath();
  ribbonPath(ctx, RIBBON_BOTTOM);
  ctx.lineTo(POSTER_SIZE, POSTER_SIZE);
  ctx.lineTo(0, POSTER_SIZE);
  ctx.closePath();
  ctx.fillStyle = BEIGE;
  ctx.fill();

  // A faixa dourada.
  ctx.beginPath();
  ribbonPath(ctx, RIBBON_TOP);
  for (let i = RIBBON_BOTTOM.length - 1; i >= 0; i--) ctx.lineTo(Math.min(POSTER_SIZE, i * 20), RIBBON_BOTTOM[i]);
  ctx.closePath();
  const gold = ctx.createLinearGradient(0, 0, POSTER_SIZE, 0);
  gold.addColorStop(0, "#9b7640");
  gold.addColorStop(0.32, "#b48c4f");
  gold.addColorStop(0.5, "#dcb873");
  gold.addColorStop(0.68, "#b8904f");
  gold.addColorStop(1, "#94723f");
  ctx.fillStyle = gold;
  ctx.fill();
}

function drawTitleBox(ctx: Ctx, data: SocialJobPostData) {
  const box = { x: 50, y: 268, w: 558, h: 150 };
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = BROWN;
  ctx.beginPath();
  ctx.roundRect(box.x + 1.25, box.y + 1.25, box.w - 2.5, box.h - 2.5, 16);
  ctx.stroke();

  const cx = box.x + box.w / 2;
  const maxW = box.w - 40;
  const title = posterTitle(data.roleTitle || "", data.location);
  const segment = cleanPosterText(data.segmentSubtitle).toUpperCase();

  // Tamanho do título: o maior que caiba em até duas linhas.
  let size = 55;
  let lines: string[] = [title];
  for (; size >= 34; size -= 2) {
    font(ctx, 700, size);
    lines = balanceTitle(title, (t) => ctx.measureText(t).width);
    if (lines.length <= 2 && lines.every((l) => ctx.measureText(l).width <= maxW)) break;
  }
  const lineH = size * 0.88;
  const segSize = segment ? fitSize(ctx, segment, 500, 25, maxW + 14, 15) : 0;
  const blockH = lines.length * lineH + (segment ? segSize + 10 : 0);
  let y = box.y + (box.h - blockH) / 2 + lineH * 0.86;

  ctx.fillStyle = BROWN;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  font(ctx, 700, size);
  for (const line of lines) {
    ctx.fillText(line, cx, y);
    y += lineH;
  }
  if (segment) {
    font(ctx, 500, segSize);
    ctx.fillStyle = INK;
    ctx.fillText(segment, cx, y - lineH + segSize + 12);
  }
}

function drawInfoRows(ctx: Ctx, data: SocialJobPostData, assets: PosterAssets) {
  const rows = posterInfoRows(data);
  if (rows.length === 0) return;
  const textX = 110;
  // O texto do cartaz original é mais estreito que a fonte: comprime na horizontal.
  const K = 0.9;
  const width = (t: string) => ctx.measureText(t).width * K;
  const fill = (t: string, x: number, y: number) => {
    ctx.save();
    ctx.scale(K, 1);
    ctx.fillText(t, x / K, y);
    ctx.restore();
  };
  const maxW = 636 - textX;
  const bottom = 752;

  // Começa no tamanho do original (37 px) e reduz até tudo caber acima da faixa.
  for (let size = 37; size >= 22; size -= 1) {
    const lineH = Math.round(size * 0.97);
    const layouts = rows.map((row) => {
      font(ctx, 700, size);
      const labelW = width(`${row.label} `);
      font(ctx, 400, size);
      // A primeira linha divide espaço com o rótulo.
      const words = row.value.split(/\s+/);
      const first: string[] = [];
      let i = 0;
      for (; i < words.length; i++) {
        const next = [...first, words[i]].join(" ");
        if (first.length && labelW + width(next) > maxW) break;
        first.push(words[i]);
      }
      const rest = wrapWords(words.slice(i).join(" "), maxW, width);
      return { row, labelW, lines: [first.join(" "), ...rest] };
    });
    // Centro de cada linha: passo de ~62 px como no original, um pouco mais
    // quando a linha vizinha ocupa duas linhas.
    const step = size * (62 / 37);
    const centers: number[] = [];
    layouts.forEach((l, idx) => {
      if (idx === 0) centers.push(458 + (l.lines.length - 1) * lineH * 0.5);
      else {
        const prev = layouts[idx - 1];
        const extra = prev.lines.length > 1 || l.lines.length > 1 ? size * (4 / 37) : 0;
        centers.push(centers[idx - 1] + step + Math.max(0, extra));
      }
    });
    const last = layouts.length - 1;
    const bottomLine = centers[last] + (layouts[last].lines.length - 1) * lineH * 0.5 + size * 0.36;
    const tooLong = layouts.some((l) => l.lines.length > 2);
    if ((bottomLine > bottom || tooLong) && size > 22) continue;

    layouts.forEach((l, idx) => {
      const cy = centers[idx];
      ctx.drawImage(assets.info[l.row.icon], 45, cy - 28, 56, 56);
      let baseline = cy - (l.lines.length - 1) * lineH * 0.5 + size * 0.36;
      ctx.textAlign = "left";
      ctx.fillStyle = INK;
      font(ctx, 700, size);
      fill(l.row.label, textX, baseline);
      font(ctx, 400, size);
      l.lines.forEach((line, i) => {
        fill(line, i === 0 ? textX + l.labelW : textX, baseline);
        baseline += lineH;
      });
    });
    return;
  }
}

function drawBenefits(ctx: Ctx, data: SocialJobPostData, assets: PosterAssets) {
  const benefits = posterBenefits(data);
  if (benefits.length === 0) return;

  ctx.textAlign = "center";
  ctx.fillStyle = BROWN;
  font(ctx, 700, 44);
  ctx.fillText("REMUNERAÇÃO E BENEFÍCIOS", 540, 829);

  const centers = benefitCenters(benefits.length);
  const colW = Math.min(204, 1020 / benefits.length) - 10;
  benefits.forEach((b, i) => {
    const cx = centers[i];
    ctx.drawImage(assets.benefit[b.icon], cx - 42, 830, 84, 60);
    ctx.fillStyle = INK;
    const labelSize = fitSize(ctx, b.label, 700, 26, colW, 18);
    ctx.fillText(b.label, cx, 913);
    if (b.strongValue) {
      font(ctx, 700, labelSize);
      const lines = wrapWords(b.value, colW, (t) => ctx.measureText(t).width).slice(0, 2);
      lines.forEach((line, k) => ctx.fillText(line, cx, 939 + k * 25));
    } else {
      font(ctx, 400, 26);
      const lines = wrapWords(b.value, colW, (t) => ctx.measureText(t).width).slice(0, 3);
      lines.forEach((line, k) => ctx.fillText(line, cx, 940 + k * 25));
    }
  });
}

function drawCta(ctx: Ctx, data: SocialJobPostData, assets: PosterAssets) {
  const text = cleanPosterText(data.ctaText) || "Acesse o link na nossa bio do Instagram para se candidatar!";
  ctx.fillStyle = BAR;
  ctx.beginPath();
  ctx.roundRect(118, 981, 846, 47, 23.5);
  ctx.fill();
  ctx.fillStyle = CTA_TEXT;
  ctx.textAlign = "center";
  fitSize(ctx, text, 600, 31, 780, 18);
  ctx.fillText(text, 532, 1015);
  ctx.drawImage(assets.hand, 941, 974);
}

function drawWarning(ctx: Ctx, x: number, baseline: number, size: number) {
  const h = size * 0.82;
  const w = h * 1.1;
  const top = baseline - h + 1;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, top);
  ctx.lineTo(x + w, top + h);
  ctx.lineTo(x, top + h);
  ctx.closePath();
  ctx.fillStyle = "#f2b01e";
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  font(ctx, 700, size * 0.7);
  ctx.fillText("!", x + w / 2, top + h - 2);
}

function drawDisclaimer(ctx: Ctx, data: SocialJobPostData) {
  const text = posterDisclaimer(data.disclaimer);
  if (!text) return;
  const size = 22;
  const prefix = "Atenção: ";
  font(ctx, 700, size);
  const prefixW = ctx.measureText(prefix).width;
  font(ctx, 400, size);
  const maxW = 600;
  // Primeira linha divide espaço com o ícone e o "Atenção:".
  const words = text.split(/\s+/);
  const first: string[] = [];
  let i = 0;
  for (; i < words.length; i++) {
    const next = [...first, words[i]].join(" ");
    if (first.length && 26 + prefixW + ctx.measureText(next).width > maxW) break;
    first.push(words[i]);
  }
  const rest = wrapWords(words.slice(i).join(" "), maxW, (t) => ctx.measureText(t).width).slice(0, 1);

  const firstText = first.join(" ");
  const firstW = 26 + prefixW + ctx.measureText(firstText).width;
  let x = 540 - firstW / 2;
  const y = 1052;
  drawWarning(ctx, x, y, size);
  x += 26;
  ctx.textAlign = "left";
  ctx.fillStyle = INK;
  font(ctx, 700, size);
  ctx.fillText(prefix, x, y);
  font(ctx, 400, size);
  ctx.fillText(firstText, x + prefixW, y);
  if (rest[0]) {
    ctx.textAlign = "center";
    ctx.fillText(rest[0], 540, y + 23);
  }
}

/** Desenha o cartaz completo no canvas (1080×1080). */
export function drawPoster(
  ctx: Ctx,
  data: SocialJobPostData,
  assets: PosterAssets,
  photo: HTMLImageElement,
  photoSrc: string
) {
  const isDefault = photoSrc === DEFAULT_POSTER_PHOTO;
  ctx.fillStyle = BEIGE;
  ctx.fillRect(0, 0, POSTER_SIZE, POSTER_SIZE);

  drawPhoto(ctx, photo, isDefault);
  drawRibbon(ctx);

  // Logo: em foto diferente da oficial, um halo claro garante a leitura.
  if (!isDefault) {
    const halo = ctx.createRadialGradient(989, 92, 10, 989, 92, 95);
    halo.addColorStop(0, "rgba(255,255,255,0.75)");
    halo.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(880, 0, 200, 200);
  }
  ctx.drawImage(assets.logo, 916, 34);

  ctx.drawImage(assets.header, 40, 66);

  const code = cleanPosterText(data.jobCode);
  if (code) {
    ctx.textAlign = "left";
    ctx.fillStyle = INK;
    font(ctx, 500, 26);
    ctx.fillText(`VAGA Nº ${code}`, 50, 59);
  }

  drawTitleBox(ctx, data);
  drawInfoRows(ctx, data, assets);
  drawBenefits(ctx, data, assets);
  drawCta(ctx, data, assets);
  drawDisclaimer(ctx, data);
}
