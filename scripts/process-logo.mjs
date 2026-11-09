import sharp from "sharp";
import fs from "fs";
import path from "path";

async function processLogo() {
  const inputPath = "C:/Users/Luciano/.gemini/antigravity/brain/0eb95dbc-3d0f-4f1d-8825-14b28d27cc03/.user_uploaded/media_1794194789962_eae078fe.jpg";
  
  const img = sharp(inputPath);
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  console.log(`Original image: ${width}x${height}, channels: ${channels}`);

  // Analisa cor do fundo amostrando as bordas
  let bgR = 0, bgG = 0, bgB = 0, bgCount = 0;
  for (let x = 0; x < width; x += 20) {
    for (let y = 0; y < 100; y += 20) {
      const idx = (y * width + x) * channels;
      bgR += data[idx];
      bgG += data[idx + 1];
      bgB += data[idx + 2];
      bgCount++;
    }
  }
  bgR = Math.round(bgR / bgCount);
  bgG = Math.round(bgG / bgCount);
  bgB = Math.round(bgB / bgCount);
  console.log(`Average background: R=${bgR}, G=${bgG}, B=${bgB}`);

  // Buffer RGBA para o logo com fundo transparente
  const rgba = Buffer.alloc(width * height * 4);
  const rgbaWhite = Buffer.alloc(width * height * 4);

  // Logo Burgundy alvo: #5c0f24 / rgb(92, 15, 36)
  const targetLogoR = 92;
  const targetLogoG = 15;
  const targetLogoB = 36;

  for (let i = 0; i < width * height; i++) {
    const srcIdx = i * channels;
    const destIdx = i * 4;

    const r = data[srcIdx];
    const g = data[srcIdx + 1];
    const b = data[srcIdx + 2];

    // Luminância do pixel
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    // Se lum >= 220, é fundo -> transparente
    // Se lum <= 110, é logo puro -> opaco
    let alpha = 0;
    if (lum >= 225) {
      alpha = 0;
    } else if (lum <= 100) {
      alpha = 255;
    } else {
      const factor = (225 - lum) / (225 - 100);
      alpha = Math.round(Math.min(255, Math.max(0, factor * 255)));
    }

    // Logo vinho original com transparência
    // Matiza levemente em direção à cor da marca para eliminar ruído da textura do papel
    if (alpha > 0) {
      const t = alpha / 255;
      rgba[destIdx] = Math.round(targetLogoR * t + r * (1 - t));
      rgba[destIdx + 1] = Math.round(targetLogoG * t + g * (1 - t));
      rgba[destIdx + 2] = Math.round(targetLogoB * t + b * (1 - t));
      rgba[destIdx + 3] = alpha;

      // Versão branca com transparência idêntica
      rgbaWhite[destIdx] = 255;
      rgbaWhite[destIdx + 1] = 255;
      rgbaWhite[destIdx + 2] = 255;
      rgbaWhite[destIdx + 3] = alpha;
    } else {
      rgba[destIdx] = 0;
      rgba[destIdx + 1] = 0;
      rgba[destIdx + 2] = 0;
      rgba[destIdx + 3] = 0;

      rgbaWhite[destIdx] = 0;
      rgbaWhite[destIdx + 1] = 0;
      rgbaWhite[destIdx + 2] = 0;
      rgbaWhite[destIdx + 3] = 0;
    }
  }

  const outDir = path.resolve("public/images");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // 1. Logo completo em vinho (com auto-trim para remover espaço vazio)
  await sharp(rgba, { raw: { width, height, channels: 4 } })
    .trim()
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(path.join(outDir, "tarhget-logo.png"));

  console.log("Saved public/images/tarhget-logo.png");

  // 2. Logo completo em branco (com auto-trim)
  await sharp(rgbaWhite, { raw: { width, height, channels: 4 } })
    .trim()
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(path.join(outDir, "tarhget-logo-white.png"));

  console.log("Saved public/images/tarhget-logo-white.png");

  // 3. Ícone / Símbolo circular "T" (corte na parte superior do logo onde fica o emblema)
  // No 1024x1024 original, o emblema fica de y=280 a y=600 e x=340 a x=684
  await sharp(rgba, { raw: { width, height, channels: 4 } })
    .extract({ left: 330, top: 270, width: 364, height: 320 })
    .trim()
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(path.join(outDir, "tarhget-icon.png"));

  console.log("Saved public/images/tarhget-icon.png");

  // 4. Ícone / Símbolo circular em branco
  await sharp(rgbaWhite, { raw: { width, height, channels: 4 } })
    .extract({ left: 330, top: 270, width: 364, height: 320 })
    .trim()
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(path.join(outDir, "tarhget-icon-white.png"));

  console.log("Saved public/images/tarhget-icon-white.png");
}

processLogo().catch(console.error);
