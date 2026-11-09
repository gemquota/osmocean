import { chromium } from 'playwright';

const base = process.env.OSMOCEAN_BASE_URL || 'https://gemquota.github.io/osmocean';
const browser = await chromium.launch({
  headless: true,
  args: [
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
const failures = [];

async function openPage(path, label) {
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  const errors = [];
  const badOsmoceanResponses = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400 && (new URL(response.url()).pathname.includes('/osmocean/fluid/') || new URL(response.url()).pathname.includes('/osmocean/ultra-water/'))) {
      badOsmoceanResponses.push(`${response.status()} ${response.url()}`);
    }
  });
  const response = await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  if (!response || !response.ok()) throw new Error(`${label}: HTTP ${response?.status() ?? 'no response'}`);
  await page.locator('#sim-canvas').waitFor({ state: 'visible', timeout: 20000 });
  const canvasSize = await page.locator('#sim-canvas').evaluate(el => ({
    width: el.width, height: el.height,
    rectWidth: el.getBoundingClientRect().width,
    rectHeight: el.getBoundingClientRect().height,
  }));
  if (canvasSize.rectWidth < 100 || canvasSize.rectHeight < 100) {
    throw new Error(`${label}: simulation canvas has no usable layout size: ${JSON.stringify(canvasSize)}`);
  }
  const fullscreen = await page.locator('.triplet').evaluate(el => {
    const rect = el.getBoundingClientRect();
    return { width: rect.width, height: rect.height, viewportWidth: innerWidth, viewportHeight: innerHeight,
      scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight,
      ocean: document.querySelector('.ocean-pane').getBoundingClientRect().toJSON(),
      fluid: document.querySelector('.fluid-pane').getBoundingClientRect().toJSON() };
  });
  if (fullscreen.width < 100 || fullscreen.height < 100 ||
      fullscreen.scrollWidth > fullscreen.viewportWidth + 1 ||
      fullscreen.scrollHeight > fullscreen.viewportHeight + 1) {
    throw new Error(`${label}: not a full-screen, no-scroll layout: ${JSON.stringify(fullscreen)}`);
  }
  await page.waitForFunction(() =>
    document.querySelector('#engine-state')?.textContent?.includes('RUNNING'),
    null, { timeout: 30000 },
  );
  console.log(`PASS ${label}: full-screen ${Math.round(fullscreen.width)}x${Math.round(fullscreen.height)}; canvas ${Math.round(canvasSize.rectWidth)}x${Math.round(canvasSize.rectHeight)}; ${await page.locator('#engine-state').innerText()}`);
  return { page, errors, badOsmoceanResponses };
}

try {
  const fluid = await openPage('/fluid/rapier-fluid-2d.html', 'Fluid + Rapier');
  await fluid.page.locator('#pause').click();
  await fluid.page.waitForFunction(() => document.querySelector('#engine-state')?.textContent?.includes('PAUSED'));
  await fluid.page.locator('#pause').click();
  await fluid.page.waitForFunction(() => document.querySelector('#engine-state')?.textContent?.includes('RUNNING'));
  console.log('PASS Fluid + Rapier: pause/resume controls');
  await fluid.page.close();
  if (fluid.errors.length) failures.push(`Fluid + Rapier page errors: ${fluid.errors.join('; ')}`);

  const pair = await openPage('/fluid/fluid-ocean-rapier.html?rapier=0', 'Fluid + Ultra-Water');
  await pair.page.waitForFunction(() =>
    document.querySelector('#ocean-state')?.textContent?.includes('OCEAN QUERY LIVE'),
    null, { timeout: 60000 },
  );
  const pairOcean = await pair.page.locator('#ocean-state').innerText();
  const pairFrame = await pair.page.locator('#ocean-frame').evaluate(el => ({ src: el.src, ready: el.contentDocument?.readyState, title: el.contentDocument?.title, probeCount: el.contentWindow?.osmoceanOceanProbes?.length ?? 0, resultTime: el.contentWindow?.osmoceanOceanProbeResults?.time ?? null }));
  console.log(`PAIR OCEAN FRAME ${JSON.stringify(pairFrame)}`);
  const pairBody = await pair.page.locator('#force-state').innerText();
  if (!pairBody.includes('RAPIER BODY DISABLED')) throw new Error(`Fluid + Ultra-Water: unexpected body state: ${pairBody}`);
  console.log(`PASS Fluid + Ultra-Water: ${pairOcean}; ${pairBody}`);
  await pair.page.close();
  if (pair.errors.length) failures.push(`Fluid + Ultra-Water page errors: ${pair.errors.join('; ')}`);
  if (pair.badOsmoceanResponses.length) failures.push(`Fluid + Ultra-Water HTTP errors: ${pair.badOsmoceanResponses.join('; ')}`);

  const triple = await openPage('/fluid/fluid-ocean-rapier.html?rapier=1', 'All three engines');
  await triple.page.waitForFunction(() =>
    document.querySelector('#ocean-state')?.textContent?.includes('OCEAN QUERY LIVE'),
    null, { timeout: 60000 },
  );
  const tripleOcean = await triple.page.locator('#ocean-state').innerText();
  const tripleBody = await triple.page.locator('#force-state').innerText();
  if (!tripleBody.includes('BODY LOAD:')) throw new Error(`All three engines: missing Rapier body telemetry: ${tripleBody}`);
  console.log(`PASS All three engines: ${tripleOcean}; ${tripleBody}`);
  await triple.page.close();
  if (triple.errors.length) failures.push(`Three-engine page errors: ${triple.errors.join('; ')}`);
  if (triple.badOsmoceanResponses.length) failures.push(`Three-engine HTTP errors: ${triple.badOsmoceanResponses.join('; ')}`);


  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const mobileErrors = [];
  mobile.on('pageerror', error => mobileErrors.push(error.message));
  const mobileResponse = await mobile.goto(`${base}/fluid/fluid-ocean-rapier.html?rapier=1`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  if (!mobileResponse?.ok()) throw new Error(`Mobile triplet: HTTP ${mobileResponse?.status() ?? 'no response'}`);
  await mobile.waitForFunction(() => document.querySelector('#engine-state')?.textContent?.includes('RUNNING'), null, { timeout: 30000 });
  const mobileLayout = await mobile.evaluate(() => {
    const ocean = document.querySelector('.ocean-pane').getBoundingClientRect();
    const fluid = document.querySelector('.fluid-pane').getBoundingClientRect();
    return { viewport: [innerWidth, innerHeight], scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
      ocean: [Math.round(ocean.width), Math.round(ocean.height)], fluid: [Math.round(fluid.width), Math.round(fluid.height)] };
  });
  if (mobileLayout.scroll[0] > mobileLayout.viewport[0] + 1 || mobileLayout.scroll[1] > mobileLayout.viewport[1] + 1 ||
      mobileLayout.ocean[1] < 250 || mobileLayout.fluid[1] < 250) {
    throw new Error(`Mobile triplet: unusable full-screen split: ${JSON.stringify(mobileLayout)}`);
  }
  if (mobileErrors.length) throw new Error(`Mobile triplet page errors: ${mobileErrors.join('; ')}`);
  console.log(`PASS Mobile triplet: ${JSON.stringify(mobileLayout)}`);
  await mobile.close();

  if (failures.length) throw new Error(failures.join('\n'));
  console.log('ALL OSMOCEAN RUNTIME SMOKE TESTS PASSED');
} finally {
  await browser.close();
}
