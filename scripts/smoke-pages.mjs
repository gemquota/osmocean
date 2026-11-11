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
    const motion = await page.evaluate(async () => {
      const fish = window.__osmoceanEcology?.fish ?? [];
      const before = fish.slice(0, Math.min(12, fish.length)).map(f => f.root.position.clone());
      const updatesBefore = window.__osmoceanEcology?.updateCount ?? 0;
      await new Promise(resolve => setTimeout(resolve, 2200));
      const current = window.__osmoceanEcology?.fish ?? [];
      const moved = current.slice(0, before.length).filter((f, i) => f.root.position.distanceTo(before[i]) > 0.01).length;
      const updatesDuringWait = (window.__osmoceanEcology?.updateCount ?? 0) - updatesBefore;
      let gestures = null;
      if (matchMedia('(pointer: coarse)').matches || location.search.includes('mobile')) {
        const target = window.app?.renderer?.domElement;
        const camera = window.app?.camera;
        const controls = window.app?.controls;
        if (target && camera && controls) {
          const startPosition = camera.position.clone();
          const startTarget = controls.target.clone();
          const startUp = camera.up.clone();
          const startDirection = camera.getWorldDirection(new (window.app.camera.position.constructor)());
          const touch = (identifier, x, y) => new Touch({ identifier, target, clientX: x, clientY: y });
          const dispatch = (type, touches) => target.dispatchEvent(new TouchEvent(type, {
            touches, targetTouches: touches, changedTouches: touches, bubbles: true, cancelable: true
          }));
          dispatch('touchstart', [touch(1, 120, 300), touch(2, 260, 300)]);
          dispatch('touchmove', [touch(1, 105, 315), touch(2, 285, 325)]);
          dispatch('touchend', []);
          const endDirection = camera.getWorldDirection(new (window.app.camera.position.constructor)());
          gestures = {
            marker: Boolean(window.__osmoceanTouchGesture),
            panned: controls.target.distanceTo(startTarget) > 0.01,
            zoomed: camera.position.distanceTo(controls.target) !== startPosition.distanceTo(startTarget),
            rotated: endDirection.distanceTo(startDirection) > 0.001,
            pivotYaw: Boolean(window.__osmoceanTouchGesture?.yawPivot),
            noRoll: camera.up.distanceTo(startUp) < 0.001
          };
        }
      }
      return { sampled: before.length, moved, gestures, updateCount: window.__osmoceanEcology?.updateCount ?? 0, updatesDuringWait, firstFishPosition: current[0]?.root.position.toArray() ?? null, firstFishVelocity: current[0]?.velocity.length() ?? null, tickCount: window.__osmoceanTickCount ?? 0, fallbackTicks: window.__osmoceanFallbackTicks ?? 0, lastFrameError: window.__osmoceanLastFrameError ?? null, bootError: document.querySelector('#osmocean-boot-error')?.textContent ?? null, visibility: document.visibilityState, lastUpdateDt: window.__osmoceanEcology?.lastUpdateDt ?? 0, lastUpdateElapsed: window.__osmoceanEcology?.lastUpdateElapsed ?? 0 };
    });
    if (motion.sampled < 1 || motion.updateCount < 1 || motion.updatesDuringWait < 1 || motion.moved < 1) throw new Error(`Fish simulation did not advance: ${JSON.stringify({ motion, errors })}`);
    if (motion.gestures && (!motion.gestures.marker || !motion.gestures.panned || !motion.gestures.zoomed || !motion.gestures.rotated || !motion.gestures.pivotYaw || !motion.gestures.noRoll)) {
      throw new Error(`Two-finger camera gesture incomplete: ${JSON.stringify(motion.gestures)}`);
    }
    const ecology = await page.evaluate(() => {
      const canvas = window.app?.renderer?.domElement || [...document.querySelectorAll('canvas')].find(el => { const r = el.getBoundingClientRect(); return r.width > 100 && r.height > 100; });
      const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
      const ecology = window.__osmoceanEcology;
      const depths = ecology?.fish?.map(f => ecology.lastSurfaceY - f.root.position.y) ?? [];
      return { mode: window.__osmoceanDisplayMode, cameraY: window.app?.camera?.position?.y, fish: ecology?.fish?.length ?? 0, minFishDepth: depths.length ? Math.min(...depths) : null, maxFishDepth: depths.length ? Math.max(...depths) : null, minAllowedDepth: ecology?.params?.minDepth, maxAllowedDepth: ecology?.params?.maxDepth, fishModelLoaded: window.app?.fishModelLoaded ?? ecology?.modelLoaded ?? false, speciesModelCount: window.app?.fishSpeciesModelCount ?? 0, speciesPopulation: ecology?.getStats?.().species ?? {}, fishRoles: ecology?.getStats?.().roles ?? {}, reefRockAssets: window.app?.reefRockAssetCount ?? 0, reefChildren: ecology?.group?.children?.length ?? 0, reefVisible: ecology?.group?.visible, rendererCalls: window.app?.renderer?.info?.render?.calls, rendererTriangles: window.app?.renderer?.info?.render?.triangles, canvas: canvas ? [canvas.width,canvas.height,canvas.getBoundingClientRect().width,canvas.getBoundingClientRect().height] : null, contextLost: gl?.isContextLost?.() ?? null, glError: gl?.getError?.() ?? null, bootStatus: window.__osmoceanBootStatus };
    });
    console.log(`RENDER DIAGNOSTICS ${viewport.width}x${viewport.height}: ${JSON.stringify({ structure, ecology, errors })}`);
    try {
      await page.evaluate(() => { const el = [...document.querySelectorAll('canvas')].find(x => { const r=x.getBoundingClientRect(); return r.width>100 && r.height>100; }); if (el) el.id='osmocean-renderer'; });
      await page.screenshot({ path: `smoke-${viewport.width}.png`, timeout: 12000, animations: 'disabled' });
    } catch (error) { console.warn(`Canvas screenshot unavailable at ${viewport.width}px: ${error.message}`); }
    if (ecology.mode !== 'UNDERWATER REEF' || !(ecology.cameraY < 0) || ecology.fish < 24 || !ecology.fishModelLoaded || ecology.speciesModelCount < 10 || Object.keys(ecology.speciesPopulation).length < 4 || Object.keys(ecology.fishRoles).length < 2 || ecology.reefChildren < 100 || ecology.reefRockAssets < 2 || !ecology.reefVisible || ecology.minFishDepth < ecology.minAllowedDepth - 0.05 || ecology.maxFishDepth > ecology.maxAllowedDepth + 0.05) throw new Error(`Underwater reef population missing: ${JSON.stringify(ecology)}`);
    if (structure.visibleCanvases !== 1 || structure.iframes !== 0) {
      throw new Error(`Expected one renderer and no embedded applications: ${JSON.stringify(structure)}`);
    }
    if (structure.scroll[0] > structure.viewport[0] + 1 || structure.scroll[1] > structure.viewport[1] + 1) {
      throw new Error(`Unified scene overflows viewport: ${JSON.stringify(structure)}`);
    }

    const pause = page.locator('#osmocean-unified-pause');
    if (await pause.isVisible().catch(() => false)) {
      await page.evaluate(() => document.querySelector('#osmocean-unified-pause')?.click());
      await page.waitForFunction(() => document.querySelector('#osmocean-unified-status')?.textContent?.includes('PAUSED'), null, { timeout: 5000 });
      await page.evaluate(() => document.querySelector('#osmocean-unified-pause')?.click());
      await page.waitForFunction(() => document.querySelector('#osmocean-unified-status')?.textContent?.includes('LIVE'), null, { timeout: 5000 });
    }
    if (errors.length) throw new Error(`Runtime errors: ${errors.join('; ')}`);
    console.log(`PASS unified scene ${viewport.width}x${viewport.height}: ${JSON.stringify(structure)}`);
    await page.close();
  }
  console.log('UNIFIED OCEAN + SPH + RAPIER SMOKE TESTS PASSED');
} finally {
  await browser.close();
}
