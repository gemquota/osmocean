import { chromium } from 'playwright';

const base = process.env.OSMOCEAN_BASE_URL || 'https://gemquota.github.io/osmocean';
const browser = await chromium.launch({
  headless: true,
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

try {
  for (const viewport of [{ width: 1365, height: 900 }, { width: 390, height: 844 }]) {
    const isMobile = viewport.width < 500;
    const page = await browser.newPage({ viewport, isMobile, hasTouch: isMobile, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(`pageerror: ${error.stack || error.message}`));
    page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
    page.on('requestfailed', request => errors.push(`request failed: ${request.url()} ${request.failure()?.errorText || ''}`));
    const pageUrl = `${base}/ultra-water/${isMobile ? '?mobile' : ''}`;
    const response = await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (!response?.ok()) throw new Error(`Unified scene HTTP ${response?.status() ?? 'no response'}`);

    await page.waitForFunction(() => Boolean(window.__osmoceanUnified) || ['scene-initialized', 'error'].includes(window.__osmoceanBootStatus), null, { timeout: 60000 });
    await page.locator('#osmocean-unified-status').waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForFunction(() => {
      const c = [...document.querySelectorAll('canvas')].filter(el => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 100 && r.height > 100 && s.visibility !== 'hidden' && s.display !== 'none';
      });
      return c.length === 1 && c[0].width > 100 && c[0].height > 100;
    }, null, { timeout: 30000 });

    const structure = await page.evaluate(() => ({
      visibleCanvases: [...document.querySelectorAll('canvas')].filter(el => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 100 && r.height > 100 && s.visibility !== 'hidden' && s.display !== 'none';
      }).length,
      iframes: document.querySelectorAll('iframe').length,
      status: document.querySelector('#osmocean-unified-status')?.textContent,
      bootStatus: window.__osmoceanBootStatus,
      hasUnified: Boolean(window.__osmoceanUnified),
      bootError: document.querySelector('#osmocean-boot-error')?.textContent || null,
      diagnostics: window.__osmoceanUnified?.getDiagnostics?.(),
      viewport: [innerWidth, innerHeight],
      scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
    }));
    if (!structure.hasUnified) throw new Error(`Unified Rapier/SPH startup did not complete: ${JSON.stringify(structure)}`);
    await page.waitForTimeout(5000);
    const ecology = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
      return { mode: window.__osmoceanDisplayMode, cameraY: window.app?.camera?.position?.y, fish: window.__osmoceanEcology?.fish?.length ?? 0, reefChildren: window.__osmoceanEcology?.group?.children?.length ?? 0, reefVisible: window.__osmoceanEcology?.group?.visible, rendererCalls: window.app?.renderer?.info?.render?.calls, rendererTriangles: window.app?.renderer?.info?.render?.triangles, canvas: canvas ? [canvas.width,canvas.height,canvas.getBoundingClientRect().width,canvas.getBoundingClientRect().height] : null, contextLost: gl?.isContextLost?.() ?? null, glError: gl?.getError?.() ?? null, bootStatus: window.__osmoceanBootStatus };
    });
    console.log(`RENDER DIAGNOSTICS ${viewport.width}x${viewport.height}: ${JSON.stringify({ structure, ecology, errors })}`);
    try {
      await page.evaluate(() => { const el = [...document.querySelectorAll('canvas')].find(x => { const r=x.getBoundingClientRect(); return r.width>100 && r.height>100; }); if (el) el.id='osmocean-renderer'; });
      await page.locator('#osmocean-renderer').screenshot({ path: `smoke-${viewport.width}.png`, timeout: 12000, animations: 'disabled' });
    } catch (error) { console.warn(`Canvas screenshot unavailable at ${viewport.width}px: ${error.message}`); }
    if (ecology.mode !== 'UNDERWATER REEF' || !(ecology.cameraY < 0) || ecology.fish < 50 || ecology.reefChildren < 100 || !ecology.reefVisible) throw new Error(`Underwater reef population missing: ${JSON.stringify(ecology)}`);
    if (structure.visibleCanvases !== 1 || structure.iframes !== 0) {
      throw new Error(`Expected one renderer and no embedded applications: ${JSON.stringify(structure)}`);
    }
    if (structure.scroll[0] > structure.viewport[0] + 1 || structure.scroll[1] > structure.viewport[1] + 1) {
      throw new Error(`Unified scene overflows viewport: ${JSON.stringify(structure)}`);
    }

    const pause = page.locator('#osmocean-unified-pause');
    if (await pause.isVisible().catch(() => false)) {
      await pause.click();
      await page.waitForFunction(() => document.querySelector('#osmocean-unified-status')?.textContent?.includes('PAUSED'));
      await pause.click();
      await page.waitForFunction(() => document.querySelector('#osmocean-unified-status')?.textContent?.includes('LIVE'));
    }
    if (errors.length) throw new Error(`Runtime errors: ${errors.join('; ')}`);
    console.log(`PASS unified scene ${viewport.width}x${viewport.height}: ${JSON.stringify(structure)}`);
    await page.close();
  }
  console.log('UNIFIED OCEAN + SPH + RAPIER SMOKE TESTS PASSED');
} finally {
  await browser.close();
}
