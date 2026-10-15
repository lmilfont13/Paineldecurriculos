const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

async function renderParallel() {
  const filmPath = path.resolve(__dirname, '../public/film.html');
  const soundtrackPath = path.resolve(__dirname, '../public/video/soundtrack_60s.wav');
  const outDir = path.resolve(__dirname, '../public/video');
  const outMp4 = path.join(outDir, 'apresentacao-cinematografica.mp4');

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const FPS = 30;
  const DURATION_SEC = 60.0;
  const TOTAL_FRAMES = FPS * DURATION_SEC; // 1800 frames
  const NUM_WORKERS = 4;
  const framesPerWorker = Math.floor(TOTAL_FRAMES / NUM_WORKERS); // 450 frames each

  console.log(`[PARALLEL RENDER] 4 Workers em Paralelo | Total: ${TOTAL_FRAMES} quadros (450/worker)`);
  console.log(`[PARALLEL RENDER] Launching Chrome Headless...`);

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

  const workerPromises = [];
  const partFiles = [];
  const startTime = Date.now();

  for (let w = 0; w < NUM_WORKERS; w++) {
    const startFrame = w * framesPerWorker;
    const endFrame = (w === NUM_WORKERS - 1) ? TOTAL_FRAMES : (w + 1) * framesPerWorker;
    const partPath = path.join(outDir, `part_${w}.mp4`);
    partFiles.push(partPath);

    const workerPromise = (async () => {
      console.log(`[WORKER ${w}] Inicializando (Quadros ${startFrame} a ${endFrame - 1})...`);
      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
      await page.goto(`file://${filmPath}`, { waitUntil: 'load' });
      await page.evaluate(() => window.seek(0));

      const client = await page.target().createCDPSession();

      // Spawn FFmpeg for this segment
      const ffmpegArgs = [
        '-y',
        '-f', 'image2pipe',
        '-vcodec', 'mjpeg',
        '-r', String(FPS),
        '-i', '-',
        '-vf', 'colorbalance=rs=0.03:gs=0.01:bs=-0.03:rm=-0.02:gm=0.01:bm=0.04,vignette=PI/4',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '19',
        '-pix_fmt', 'yuv420p',
        partPath
      ];

      const ffmpeg = spawn('ffmpeg', ffmpegArgs, { stdio: ['pipe', 'ignore', 'inherit'] });

      for (let f = startFrame; f < endFrame; f++) {
        const t = f / FPS;
        await page.evaluate((time) => window.seek(time), t);

        const { data } = await client.send('Page.captureScreenshot', {
          format: 'jpeg',
          quality: 92
        });
        const buffer = Buffer.from(data, 'base64');

        const canContinue = ffmpeg.stdin.write(buffer);
        if (!canContinue) {
          await new Promise(resolve => ffmpeg.stdin.once('drain', resolve));
        }

        const localFrame = f - startFrame;
        if (localFrame > 0 && localFrame % 75 === 0) {
          const el = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`[WORKER ${w}] ${localFrame}/${endFrame - startFrame} quadros concluídos (${el}s transcorridos)`);
        }
      }

      ffmpeg.stdin.end();

      await new Promise((resolve, reject) => {
        ffmpeg.on('close', (code) => {
          if (code === 0) {
            console.log(`[WORKER ${w}] Segmento concluído com sucesso: ${partPath}`);
            resolve();
          } else {
            reject(new Error(`Worker ${w} FFmpeg exited with code ${code}`));
          }
        });
      });

      await page.close();
    })();

    workerPromises.push(workerPromise);
  }

  // Wait for all 4 workers to finish
  await Promise.all(workerPromises);
  await browser.close();

  console.log(`[PARALLEL RENDER] Todos os 4 segmentos foram renderizados com sucesso!`);
  console.log(`[PARALLEL RENDER] Concatenando segmentos e inserindo master áudio...`);

  // Write concat list
  const concatListPath = path.join(outDir, 'concat_list.txt');
  const fileLines = partFiles.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
  fs.writeFileSync(concatListPath, fileLines, 'utf8');

  // Concat and mux audio
  const concatArgs = [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatListPath,
    '-i', soundtrackPath,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest',
    outMp4
  ];

  await new Promise((resolve, reject) => {
    const mux = spawn('ffmpeg', concatArgs, { stdio: 'inherit' });
    mux.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`Concat FFmpeg exited with code ${code}`));
    });
  });

  // Clean up partial files
  for (const p of partFiles) {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  if (fs.existsSync(concatListPath)) fs.unlinkSync(concatListPath);

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  const stats = fs.statSync(outMp4);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

  console.log(`\n======================================================`);
  console.log(`[RENDER PARALELO COMPLETO] Vídeo Cinematográfico Finalizado!`);
  console.log(`Arquivo: ${outMp4}`);
  console.log(`Tamanho: ${sizeMB} MB`);
  console.log(`Tempo total: ${totalTime}s`);
  console.log(`======================================================\n`);
}

renderParallel().catch(err => {
  console.error('[FATAL RENDER ERROR]', err);
  process.exit(1);
});
