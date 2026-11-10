import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const upstream = path.resolve(process.argv[2] || '_upstream/ultra-water');
const read = (file) => fs.readFileSync(file, 'utf8');
const write = (file, value) => fs.writeFileSync(file, value);
const copy = (from, to) => {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
};
function replaceExactly(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error('Expected one ' + label + ' match, found ' + count);
  return source.replace(before, after);
}

const packagePath = path.join(upstream, 'package.json');
const manifest = JSON.parse(read(packagePath));
manifest.dependencies ||= {};
manifest.dependencies['@dimforge/rapier3d-compat'] = '0.21.0';
write(packagePath, JSON.stringify(manifest, null, 2) + '\n');

const osmoceanDir = path.join(upstream, 'src/osmocean');
copy(path.join(repoRoot, 'src/adapters/rapier-ultra-water.js'), path.join(osmoceanDir, 'rapier-ultra-water.js'));
copy(path.join(repoRoot, 'src/core/vector3.js'), path.join(osmoceanDir, 'vector3.js'));
copy(path.join(repoRoot, 'src/core/heightfield-grid.js'), path.join(osmoceanDir, 'heightfield-grid.js'));
let adapter = read(path.join(osmoceanDir, 'rapier-ultra-water.js'));
adapter = replaceExactly(adapter, '"../core/vector3.js"', '"./vector3.js"', 'adapter vector import');
write(path.join(osmoceanDir, 'rapier-ultra-water.js'), adapter);
copy(path.join(repoRoot, 'scripts/upstream/rapierFloaters.js'), path.join(upstream, 'src/scene/rapierFloaters.js'));


// Import the pinned SPH implementation into the Ultra-Water application so all
// three engines share the same Three.js scene and animation lifecycle.
const fluidRoot = path.resolve(process.argv[3] || '_upstream/fluid');
for (const file of [
  'config.ts', 'kernels.ts', 'physics.ts', 'spatial.ts', 'spawn.ts', 'types.ts'
]) copy(path.join(fluidRoot, 'src/sph/2d/common', file), path.join(osmoceanDir, 'sph/common', file));
for (const file of ['sim.ts', 'renderer.ts']) copy(
  path.join(fluidRoot, 'src/sph/2d/canvas2d', file),
  path.join(osmoceanDir, 'sph/canvas2d', file)
);
copy(path.join(repoRoot, 'src/adapters/rapier-fluid-sph2d.js'), path.join(osmoceanDir, 'rapier-fluid-sph2d.js'));
copy(path.join(repoRoot, 'scripts/upstream/UnifiedCoupling.js'), path.join(osmoceanDir, 'UnifiedCoupling.js'));
write(packagePath, JSON.stringify(manifest, null, 2) + '\n');

const mainPath = path.join(upstream, 'src/main.js');
let main = read(mainPath);
main = replaceExactly(main,
  "import { Floaters } from './scene/floaters.js';",
  "import { Floaters } from './scene/floaters.js';\nimport { RapierFloaters } from './scene/rapierFloaters.js';\nimport * as RAPIER from '@dimforge/rapier3d-compat';\nimport { createUnifiedCoupling } from './osmocean/UnifiedCoupling.js';",
  'floater import');
const bootDiagnostics = [
  "const bootError = document.createElement('pre');",
  "bootError.id = 'osmocean-boot-error';",
  "bootError.hidden = true;",
  "bootError.style.cssText = 'position:fixed;z-index:99999;inset:12px 12px auto;padding:14px;background:#2a1010;color:#ffd8d8;border:1px solid #b44;border-radius:8px;white-space:pre-wrap;font:12px/1.4 ui-monospace,monospace;max-height:45vh;overflow:auto';",
  "document.body.appendChild(bootError);",
  "function reportBootError(error) {",
  "  bootError.hidden = false;",
  "  bootError.textContent = 'OSMOCEAN / RAPIER STARTUP ERROR\\n' + (error?.stack || error?.message || String(error));",
  "  window.__osmoceanBootStatus = 'error';",
  "}",
  "window.addEventListener('error', (event) => reportBootError(event.error || event.message));",
  "window.addEventListener('unhandledrejection', (event) => reportBootError(event.reason));",
  "window.__osmoceanBootStatus = 'rapier-initializing';",
  "window.__osmoceanRapierReady = false;",
  "try {",
  "  await RAPIER.init();",
  "  window.__osmoceanBootStatus = 'rapier-ready';",
  "  window.__osmoceanRapierReady = true;",
  "} catch (error) {",
  "  reportBootError(error);",
  "  window.__osmoceanRapierReady = false;",
  "}",
  "document.title = 'Ultra-Water + Rapier | Osmocean';",
  "",
  "const REFLECT_LAYER = 1;"
].join('\n');
main = replaceExactly(main, 'const REFLECT_LAYER = 1;', bootDiagnostics, 'Rapier WASM initialization and visible startup diagnostics');
main = replaceExactly(main,
  'const floaters = new Floaters({ scene, heightAt: islandHeight, patchMaterial: terrain.patchProp });',
  "let floaters;\ntry { floaters = window.__osmoceanRapierReady ? new RapierFloaters({ RAPIER, scene, heightAt: islandHeight, patchMaterial: terrain.patchProp, query }) : new Floaters({ scene, heightAt: islandHeight, patchMaterial: terrain.patchProp }); } catch (error) { reportBootError(error); floaters = new Floaters({ scene, heightAt: islandHeight, patchMaterial: terrain.patchProp }); }\nlet osmoceanUnified = null;\nwindow.__osmoceanBootStatus = window.__osmoceanRapierReady ? 'rapier-world-ready' : 'fallback-world-ready';",
  'floater runtime construction');
main = replaceExactly(main,
  'const pts = floaters.collectPoints([camera.position]);',
  'const pts = floaters.collectPoints([camera.position], elapsed);',
  'batched query collection');
main = replaceExactly(main, 'floaters.step(dt);', 'osmoceanUnified?.step(dt, elapsed, ocean.params);\n  floaters.step(dt, elapsed);', 'shared unified world frame and current simulation time');
main = replaceExactly(main,
  'const query = new WaterQuery(renderer, surface, 512);',
  'const query = new WaterQuery(renderer, surface, 1024);',
  'batched query capacity');
main = replaceExactly(main,
  "const gui = new GUI({ title: 'Gelatin Water' });",
  "const gui = new GUI({ title: 'Ultra-Water · Rapier 3D' });",
  'Rapier scene GUI title');
for (const line of [
  "fFloat.add(floaters.params, 'drag', 0, 6, 0.01);\n",
  "fFloat.add(floaters.params, 'angularDrag', 0, 4, 0.01);\n",
  "fFloat.add(floaters.params, 'buoyancy', 0, 2, 0.01);\n",
]) main = replaceExactly(main, line, '', 'legacy custom-integrator control');
main = replaceExactly(main,
  'window.app = {\n  camera, controls, sky, post, surface, ocean, terrain, timer, views, quality, renderer, floaters, query, underwater, spray, snow, caustics, floatShadow,',
  "window.__osmoceanBootStatus = 'scene-initialized';\nwindow.app = {\n  camera, controls, sky, post, surface, ocean, terrain, timer, views, quality, renderer, floaters, query, underwater, spray, snow, caustics, floatShadow, physicsEngine: 'Rapier 3D 0.21.0',",
  'runtime diagnostics export');
const upstreamHtmlPath = path.join(upstream, 'index.html');
let upstreamHtml = read(upstreamHtmlPath);
upstreamHtml = replaceExactly(upstreamHtml, '<title>Gelatin Water</title>', '<title>Ultra-Water + Rapier | Osmocean</title>', 'upstream page title');
write(upstreamHtmlPath, upstreamHtml);
write(mainPath, main);
main = replaceExactly(main, '  ocean.update(dt, timer);', `
  // Device tilt changes the actual OceanSim wind spectrum, not just the camera or floaters.
  // Rebuild only after a meaningful change to avoid recompiling the FFT spectrum every frame.
  const deviceTilt = window.osmoceanTilt;
  const tiltX = deviceTilt?.enabled ? Math.max(-6.5, Math.min(6.5, deviceTilt.x || 0)) : 0;
  const tiltY = deviceTilt?.enabled ? Math.max(-6.5, Math.min(6.5, deviceTilt.y || 0)) : 0;
  window.__osmoceanBaseWind ||= { speed: ocean.params.windSpeed, direction: ocean.params.windDirection };
  const baseWind = window.__osmoceanBaseWind;
  const tiltMagnitude = Math.hypot(tiltX, tiltY);
  const targetDirection = tiltMagnitude > 0.25 ? baseWind.direction + Math.atan2(tiltX, -tiltY) * 180 / Math.PI * 0.55 : baseWind.direction;
  const targetSpeed = Math.max(1, Math.min(25, baseWind.speed + tiltMagnitude * 0.55));
  const directionDelta = ((targetDirection - ocean.params.windDirection + 540) % 360) - 180;
  if (Math.abs(directionDelta) >= 3 || Math.abs(targetSpeed - ocean.params.windSpeed) >= 0.2) {
    ocean.params.windDirection = ((ocean.params.windDirection + Math.max(-3, Math.min(3, directionDelta)) + 540) % 360) - 180;
    ocean.params.windSpeed += Math.max(-0.2, Math.min(0.2, targetSpeed - ocean.params.windSpeed));
    ocean.dirty = true;
  }
  ocean.update(dt, timer);
`, 'device tilt OceanSim wind coupling');
main = replaceExactly(main, 'views[ui.view]();', 'views[ui.view]();\nif (window.__osmoceanRapierReady && floaters instanceof RapierFloaters) { try { osmoceanUnified = createUnifiedCoupling({ THREE, scene, RAPIER, floaters, controls }); } catch (error) { reportBootError(error); } }', 'initialize unified scene after the camera preset');

// Add fish ecology after the Rapier integration has transformed the upstream entry point.
copy(path.join(repoRoot, 'src/ecology/fish-ecology.js'), path.join(upstream, 'src/ecology/fish-ecology.js'));
main = replaceExactly(main,
  "import { RapierFloaters } from './scene/rapierFloaters.js';\nimport * as RAPIER from '@dimforge/rapier3d-compat';\nimport { createUnifiedCoupling } from './osmocean/UnifiedCoupling.js';",
  "import { RapierFloaters } from './scene/rapierFloaters.js';\nimport * as RAPIER from '@dimforge/rapier3d-compat';\nimport { createUnifiedCoupling } from './osmocean/UnifiedCoupling.js';\nimport { FishEcology } from './ecology/fish-ecology.js';",
  'native fish ecology import');
main = replaceExactly(main,
  "const floaters = new RapierFloaters({ RAPIER, scene, heightAt: islandHeight, patchMaterial: terrain.patchProp, query });\nlet osmoceanUnified = null;\nwindow.__osmoceanBootStatus = 'rapier-world-ready';",
  "const floaters = new RapierFloaters({ RAPIER, scene, heightAt: islandHeight, patchMaterial: terrain.patchProp, query });\nconst ecology = new FishEcology(THREE, scene, { population: 72, seed: 0x51f15e });\nlet osmoceanUnified = null;\nwindow.__osmoceanBootStatus = 'rapier-world-ready';",
  'native fish ecology construction');
main = replaceExactly(main,
  "if (mobile) gui.close();",
  "const fEcology = gui.addFolder('Ecology');\nfEcology.add(ecology.params, 'population', 0, 250, 1).onChange((n) => ecology.populate(n));\nfEcology.add(ecology.params, 'worldRadius', 20, 300, 1);\nfEcology.add(ecology.params, 'neighbourRadius', 4, 40, 1);\nfEcology.add(ecology.params, 'maxDepth', 5, 60, 1);\nfEcology.close();\nconst fFood = gui.addFolder('Food web & energy');\nfFood.add(ecology.params, 'resourceCount', 0, 500, 1).onChange(n => ecology.seedResources(n));\nfFood.add(ecology.params, 'resourceRegrowth', 0, 0.2, 0.005);\nfFood.add(ecology.params, 'feedingRate', 0.02, 1, 0.01);\nfFood.close();\nconst fEvolution = gui.addFolder('Evolution & predation');\nfEvolution.add(ecology.params, 'mutationRate', 0, 0.5, 0.01);\nfEvolution.add(ecology.params, 'mutationStrength', 0.01, 0.5, 0.01);\nfEvolution.add(ecology.params, 'reproductionEnergy', 0.4, 1.4, 0.02);\nfEvolution.add(ecology.params, 'predationThreshold', 0, 1, 0.02);\nfEvolution.add(ecology.params, 'predationRate', 0, 2, 0.02);\nfEvolution.close();\nconst fEnvironment = gui.addFolder('Environment');\nfEnvironment.add(ecology.params, 'currentStrength', 0, 2, 0.02);\nfEnvironment.add(ecology.params, 'temperatureGradient', 0, 1, 0.02);\nfEnvironment.add(ecology.params, 'oxygenGradient', 0, 1, 0.02);\nfEnvironment.close();\nwindow.__osmoceanEcology = ecology;\nif (mobile) gui.close();",
  'live ecology controls');
main = replaceExactly(main, 'window.__osmoceanEcology = ecology;',
  `window.__osmoceanEcology = ecology;
const ecologyPanel = document.createElement('section');
ecologyPanel.id = 'osmocean-ecology-observatory';
ecologyPanel.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:9999;width:270px;max-width:calc(100vw - 24px);padding:12px;background:rgba(5,18,28,.88);color:#d8f3ef;border:1px solid rgba(115,220,210,.3);border-radius:10px;font:12px/1.45 system-ui;backdrop-filter:blur(12px);';
ecologyPanel.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center"><b style="letter-spacing:.12em">ECOLOGY OBSERVATORY</b><button id="eco-hide" style="background:#20414a;color:#d8f3ef;border:0;border-radius:5px;padding:4px 8px">Hide</button></div><div id="eco-stats" style="margin:8px 0;color:#b9d9d4">Initialising population…</div><canvas id="eco-history" width="246" height="76" style="width:100%;height:76px"></canvas><div style="opacity:.65;margin-top:4px">Population history · selectable live parameters in Ecology folders</div>';
document.body.appendChild(ecologyPanel);
ecologyPanel.querySelector('#eco-hide').onclick = () => { ecologyPanel.style.display = 'none'; };
const ecologyToggle = document.createElement('button');
ecologyToggle.textContent = 'ECOLOGY';
ecologyToggle.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:9998;background:#123943;color:#d8f3ef;border:1px solid #4b9b98;border-radius:7px;padding:8px 12px;font:11px system-ui;letter-spacing:.12em;display:none';
ecologyToggle.onclick = () => { ecologyPanel.style.display = 'block'; ecologyToggle.style.display = 'none'; };
document.body.appendChild(ecologyToggle);
ecologyPanel.querySelector('#eco-hide').onclick = () => { ecologyPanel.style.display = 'none'; ecologyToggle.style.display = 'block'; };
window.__osmoceanEcologyPanel = ecologyPanel;`,
  'mount ecology observatory panel');
main = replaceExactly(main,
  '  floaters.step(dt, elapsed);',
  '  floaters.step(dt, elapsed);\n  ecology.update(dt, elapsed, camWater);\n  if (window.__osmoceanEcologyPanel && window.__osmoceanEcologyPanel.style.display !== \'none\') { const stats = ecology.getStats(); const label = window.__osmoceanEcologyPanel.querySelector(\'#eco-stats\'); if (label) label.textContent = `Fish ${stats.population} · food ${Math.round(stats.resources)} · generation ${stats.meanGeneration.toFixed(1)} · speed ${stats.meanSpeed.toFixed(2)} · aggression ${stats.meanAggression.toFixed(2)}`; const canvas = window.__osmoceanEcologyPanel.querySelector(\'#eco-history\'); if (canvas) { const ctx = canvas.getContext(\'2d\'); const rows = ecology.history; ctx.clearRect(0,0,canvas.width,canvas.height); if (rows.length > 1) { const max = Math.max(1,...rows.map(r=>r.population)); ctx.strokeStyle = \'#74d6c4\'; ctx.lineWidth = 2; ctx.beginPath(); rows.forEach((r,i)=>{const x=i/(rows.length-1)*canvas.width,y=canvas.height-r.population/max*(canvas.height-6)-3;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}); ctx.stroke(); } } }',
  'fish ecology frame update');
main = replaceExactly(main,
  'camera, controls, sky, post, surface, ocean, terrain, timer, views, quality, renderer, floaters, query, underwater, spray, snow, caustics, floatShadow, physicsEngine: \'Rapier 3D 0.21.0\',',
  'camera, controls, sky, post, surface, ocean, terrain, timer, views, quality, renderer, floaters, query, underwater, spray, snow, caustics, floatShadow, ecology, physicsEngine: \'Rapier 3D 0.21.0\',',
  'expose ecology diagnostics');
write(mainPath, main);

console.log('Integrated Ultra-Water, pinned SPH and Rapier into one Three.js scene and render lifecycle.');
