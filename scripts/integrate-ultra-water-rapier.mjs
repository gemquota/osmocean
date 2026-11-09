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
  "import { RapierFloaters } from './scene/rapierFloaters.js';\nimport * as RAPIER from '@dimforge/rapier3d-compat';\nimport { createUnifiedCoupling } from './osmocean/UnifiedCoupling.js';",
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
  "try {",
  "  await RAPIER.init();",
  "  window.__osmoceanBootStatus = 'rapier-ready';",
  "} catch (error) {",
  "  reportBootError(error);",
  "  throw error;",
  "}",
  "document.title = 'Ultra-Water + Rapier | Osmocean';",
  "",
  "const REFLECT_LAYER = 1;"
].join('\n');
main = replaceExactly(main, 'const REFLECT_LAYER = 1;', bootDiagnostics, 'Rapier WASM initialization and visible startup diagnostics');
main = replaceExactly(main,
  'const floaters = new Floaters({ scene, heightAt: islandHeight, patchMaterial: terrain.patchProp });',
  "const floaters = new RapierFloaters({ RAPIER, scene, heightAt: islandHeight, patchMaterial: terrain.patchProp, query });\nconst osmoceanUnified = createUnifiedCoupling({ THREE, scene, RAPIER, floaters });\nwindow.__osmoceanBootStatus = 'rapier-world-ready';",
  'floater runtime construction');
main = replaceExactly(main,
  'const pts = floaters.collectPoints([camera.position]);',
  'const pts = floaters.collectPoints([camera.position], elapsed);',
  'batched query collection');
main = replaceExactly(main, 'floaters.step(dt);', 'floaters.step(dt, elapsed);', 'current simulation time for readback age');
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
main = replaceExactly(main, '  osmoceanUnified.step(dt, elapsed, ocean.params);
  ocean.update(dt, timer);', `
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
write(mainPath, main);

console.log('Integrated Ultra-Water, pinned SPH and Rapier into one Three.js scene and render lifecycle.');
