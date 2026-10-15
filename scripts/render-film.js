const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

async function renderFilm() {
  const filmPath = path.resolve(__dirname, '../public/film.html');
  const soundtrackPath = path.resolve(__dirname, '../public/video/soundtrack_60s.wav');
  const outDir = path.resolve(__dirname, '../public/video');
  const outMp4 = path.join(outDir, 'apresentacao-cinematografica.mp4');

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log(`[RENDER] Iniciando renderizador cinematográfico 1080p 30fps...`);
  console.log(`[RENDER] HTML: ${filmPath}`);
  console.log(`[RENDER] Áudio: ${soundtrackPath}`);
  console.log(`[RENDER] Saída: ${outMp4}`);

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: [
      '--window-size=1920,1080',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--allow-file-access-from-files'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto(`file://${filmPath}`, { waitUntil: 'load' });

  // Initialize at t = 0
  await page.evaluate(() => window.seek(0));

  const FPS = 30;
  const DURATION_SEC = 60.0;
  const TOTAL_FRAMES = FPS * DURATION_SEC; // 1800 frames

  console.log(`[RENDER] Total de quadros a renderizar: ${TOTAL_FRAMES} (Duração: ${DURATION_SEC}s a ${FPS}fps)`);

  // Spawn ffmpeg with color balance grade and vignette
  const ffmpegArgs = [
    '-y',
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
    '-r', String(FPS),
    '-i', '-',
    '-i', soundtrackPath,
    '-vf', 'colorbalance=rs=0.03:gs=0.01:bs=-0.03:rm=-0.02:gm=0.01:bm=0.04,vignette=PI/4',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '19',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest',
    outMp4
  ];

  const ffmpeg = spawn('ffmpeg', ffmpegArgs, { stdio: ['pipe', 'inherit', 'inherit'] });

  ffmpeg.on('error', (err) => {
    console.error('[FFMPEG ERROR]', err);
  });

  const startTime = Date.now();
  let lastLogTime = Date.now();

  for (let f = 0; f < TOTAL_FRAMES; f++) {
    const t = f / FPS;
    await page.evaluate((time) => window.seek(time), t);

    const buffer = await page.screenshot({
      type: 'jpeg',
      quality: 92,
      omitBackground: false
    });

    // Write frame buffer to ffmpeg stdin
    const canContinue = ffmpeg.stdin.write(buffer);
    if (!canContinue) {
      await new Promise(resolve => ffmpeg.stdin.once('drain', resolve));
    }

    // Progress log every 150 frames (5 seconds of film)
    if (f > 0 && f % 150 === 0) {
      const elapsedSec = (Date.now() - startTime) / 1000;
      const fpsRender = (f / elapsedSec).toFixed(1);
      const remainingSec = ((TOTAL_FRAMES - f) / (f / elapsedSec)).toFixed(0);
      console.log(`[RENDER] Progresso: ${f}/${TOTAL_FRAMES} quadros (${(t).toFixed(1)}s / ${DURATION_SEC}s) | Velocidade: ${fpsRender} fps | Restante est.: ${remainingSec}s`);
    }
  }

  console.log(`[RENDER] Todos os ${TOTAL_FRAMES} quadros enviados. Finalizando MP4 no FFmpeg...`);
  ffmpeg.stdin.end();

  await new Promise((resolve, reject) => {
    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}`));
    });
  });

  await browser.close();

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  const stats = fs.statSync(outMp4);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

  console.log(`\n======================================================`);
  console.log(`[RENDER COMPLETO] Vídeo Cinematográfico Finalizado!`);
  console.log(`Arquivo: ${outMp4}`);
  console.log(`Tamanho: ${sizeMB} MB`);
  console.log(`Tempo total de render: ${totalTime}s`);
  console.log(`======================================================\n`);
}

renderFilm().catch(err => {
  console.error('[FATAL RENDER ERROR]', err);
  process.exit(1);
});
