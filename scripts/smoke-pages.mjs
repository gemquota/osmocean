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
          const panStayedOnXZ = Math.abs(controls.target.y - startTarget.y) < 0.001;
          const pivotYawApplied = Boolean(window.__osmoceanTouchGesture?.yawPivot);
          const noRollAfterYaw = camera.up.distanceTo(startUp) < 0.001;
          const beforeVerticalDrag = camera.position.y;
          dispatch('touchstart', [touch(1, 120, 300), touch(2, 180, 300), touch(3, 240, 300)]);
          dispatch('touchmove', [touch(1, 120, 270), touch(2, 180, 270), touch(3, 240, 270)]);
          const verticalDragMovedY = Math.abs(camera.position.y - beforeVerticalDrag) > 0.01;
          const verticalDragMarker = Boolean(window.__osmoceanTouchGesture?.verticalDrag);
          dispatch('touchend', []);
          gestures = {
            marker: Boolean(window.__osmoceanTouchGesture),
            panned: controls.target.distanceTo(startTarget) > 0.01,
            panStayedOnXZ,
            zoomed: camera.position.distanceTo(controls.target) !== startPosition.distanceTo(startTarget),
            rotated: endDirection.distanceTo(startDirection) > 0.001,
            pivotYaw: pivotYawApplied,
            verticalDragMovedY,
            verticalDragMarker,
            noRoll: noRollAfterYaw
          };
        }
      }
      return { sampled: before.length, moved, gestures, updateCount: window.__osmoceanEcology?.updateCount ?? 0, updatesDuringWait, firstFishPosition: current[0]?.root.position.toArray() ?? null, firstFishVelocity: current[0]?.velocity.length() ?? null, tickCount: window.__osmoceanTickCount ?? 0, fallbackTicks: window.__osmoceanFallbackTicks ?? 0, lastFrameError: window.__osmoceanLastFrameError ?? null, bootError: document.querySelector('#osmocean-boot-error')?.textContent ?? null, visibility: document.visibilityState, lastUpdateDt: window.__osmoceanEcology?.lastUpdateDt ?? 0, lastUpdateElapsed: window.__osmoceanEcology?.lastUpdateElapsed ?? 0 };
    });
    if (motion.sampled < 1 || motion.updateCount < 1 || motion.updatesDuringWait < 1 || motion.moved < 1) throw new Error(`Fish simulation did not advance: ${JSON.stringify({ motion, errors })}`);
    if (motion.gestures && (!motion.gestures.marker || !motion.gestures.panned || !motion.gestures.panStayedOnXZ || !motion.gestures.zoomed || !motion.gestures.rotated || !motion.gestures.pivotYaw || !motion.gestures.verticalDragMovedY || !motion.gestures.verticalDragMarker || !motion.gestures.noRoll)) {
      throw new Error(`Two-finger camera gesture incomplete: ${JSON.stringify(motion.gestures)}`);
    }
    const ecology = await page.evaluate(() => {
      const canvas = window.app?.renderer?.domElement || [...document.querySelectorAll('canvas')].find(el => { const r = el.getBoundingClientRect(); return r.width > 100 && r.height > 100; });
      const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
      const ecology = window.__osmoceanEcology;
      const depths = ecology?.fish?.map(f => ecology.lastSurfaceY - f.root.position.y) ?? [];
      return { mode: window.__osmoceanDisplayMode, cameraY: window.app?.camera?.position?.y, fish: ecology?.fish?.length ?? 0, minFishDepth: depths.length ? Math.min(...depths) : null, maxFishDepth: depths.length ? Math.max(...depths) : null, minAllowedDepth: ecology?.params?.minDepth, maxAllowedDepth: ecology?.params?.maxDepth, fishModelLoaded: window.app?.fishModelLoaded ?? ecology?.modelLoaded ?? false, speciesModelCount: window.app?.fishSpeciesModelCount ?? 0, speciesPopulation: ecology?.getStats?.().species ?? {}, fishRoles: ecology?.getStats?.().roles ?? {}, reefRockAssets: window.app?.reefRockAssetCount ?? 0, visibleFish: (() => { const camera = window.app?.camera; const V = camera?.position?.constructor; if (!camera || !V) return 0; camera.updateMatrixWorld(true); return (window.__osmoceanEcology?.fish ?? []).filter(f => { const p = f.root.getWorldPosition(new V()).project(camera); return p.z >= -1 && p.z <= 1 && Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1; }).length; })(), cameraPosition: window.app?.camera?.position?.toArray?.() ?? null, cameraDirection: (() => { const camera=window.app?.camera,V=camera?.position?.constructor;if(!camera||!V)return null;return camera.getWorldDirection(new V()).toArray();})(), ecologyGroupPosition: window.__osmoceanEcology?.group?.position?.toArray?.() ?? null, fishSamples: (() => { const camera=window.app?.camera,V=camera?.position?.constructor;if(!camera||!V)return[];camera.updateMatrixWorld(true);return(window.__osmoceanEcology?.fish??[]).slice(0,8).map(f=>{const world=f.root.getWorldPosition(new V()),ndc=world.clone().project(camera);let meshes=0;f.root.traverse(o=>{if(o.isMesh)meshes++;});return{local:f.root.position.toArray(),world:world.toArray(),ndc:ndc.toArray(),rootVisible:f.root.visible,meshes,modelled:f.modelled};});})(), reefChildren: ecology?.group?.children?.length ?? 0, reefVisible: ecology?.group?.visible, rendererCalls: window.app?.renderer?.info?.render?.calls, rendererTriangles: window.app?.renderer?.info?.render?.triangles, canvas: canvas ? [canvas.width,canvas.height,canvas.getBoundingClientRect().width,canvas.getBoundingClientRect().height] : null, contextLost: gl?.isContextLost?.() ?? null, glError: gl?.getError?.() ?? null, bootStatus: window.__osmoceanBootStatus };
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
