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
  page.on('pageerror', error => errors.push(error.message));
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
  await page.waitForFunction(() =>
    document.querySelector('#engine-state')?.textContent?.includes('RUNNING'),
    null, { timeout: 30000 },
  );
  console.log(`PASS ${label}: canvas ${Math.round(canvasSize.rectWidth)}x${Math.round(canvasSize.rectHeight)}; ${await page.locator('#engine-state').innerText()}`);
  return { page, errors };
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
  const pairBody = await pair.page.locator('#force-state').innerText();
  if (!pairBody.includes('RAPIER BODY DISABLED')) throw new Error(`Fluid + Ultra-Water: unexpected body state: ${pairBody}`);
  console.log(`PASS Fluid + Ultra-Water: ${pairOcean}; ${pairBody}`);
  await pair.page.close();
  if (pair.errors.length) failures.push(`Fluid + Ultra-Water page errors: ${pair.errors.join('; ')}`);

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

  if (failures.length) throw new Error(failures.join('\n'));
  console.log('ALL OSMOCEAN RUNTIME SMOKE TESTS PASSED');
} finally {
  await browser.close();
}
