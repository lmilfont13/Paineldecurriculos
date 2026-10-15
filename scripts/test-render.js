const puppeteer = require('puppeteer-core');
const path = require('path');

async function test() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: [
      '--window-size=1920,1080',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.setContent('<h1 style="color:white;background:#07070a;height:100vh;display:flex;align-items:center;justify-content:center;font-size:4rem;font-family:sans-serif;">TEST RENDER 1080P</h1>');
  
  const start = Date.now();
  for (let i = 0; i < 5; i++) {
    await page.screenshot({ type: 'jpeg', quality: 90 });
  }
  const elapsed = Date.now() - start;
  console.log(`5 frames took ${elapsed}ms (${(elapsed/5).toFixed(1)}ms per frame)`);

  await browser.close();
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
