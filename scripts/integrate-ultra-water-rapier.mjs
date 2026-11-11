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
const polyfishRoot = path.resolve(process.argv[4] || '_upstream/polyfish');
const fishAssetsRoot = path.resolve(process.argv[5] || '_upstream/fish-assets');
const fishModelSource = path.join(polyfishRoot, 'assets/models/fish_rigged.glb');
if (!fs.existsSync(fishModelSource)) throw new Error('Pinned PolyFish model missing: ' + fishModelSource);
copy(fishModelSource, path.join(upstream, 'public/models/osmocean/fish_rigged.glb'));
copy(path.join(polyfishRoot, 'LICENSE'), path.join(upstream, 'public/models/osmocean/POLYFISH-LICENSE.txt'));
const detailedFish = [
  'anglerfish','black_lion_fish','coral_grouper','goblin_shark','humphead','lionfish',
  'parrot_fish','puffer','shark','sunfish','swordfish','tuna'
];
const fishModelDir = path.join(upstream, 'public/models/osmocean/species');
for (const species of detailedFish) {
  const source = path.join(fishAssetsRoot, 'assets/quaternius/animated-fish-bundle/Models', species + '.glb');
  if (!fs.existsSync(source)) throw new Error('Pinned CC0 fish species model missing: ' + source);
  copy(source, path.join(fishModelDir, species + '.glb'));
}
copy(path.join(fishAssetsRoot, 'assets/quaternius/animated-fish-bundle/License.txt'),
  path.join(upstream, 'public/models/osmocean/species/QUATERNIUS-CC0-LICENSE.txt'));
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
  "controls.maxDistance = 6000;",
  `controls.maxDistance = 6000;
if (mobile) {
  const surface = renderer.domElement;
  surface.style.touchAction = 'pan-y';
  let gesture = null;
  const points = event => [...event.touches].slice(0, 2).map(t => ({ x: t.clientX, y: t.clientY }));
  const measure = p => ({
    x: (p[0].x + p[1].x) * 0.5,
    y: (p[0].y + p[1].y) * 0.5,
    distance: Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y),
    angle: Math.atan2(p[1].y - p[0].y, p[1].x - p[0].x)
  });
  const wrapAngle = value => Math.atan2(Math.sin(value), Math.cos(value));
  const worldUp = new THREE.Vector3(0, 1, 0);
  const raycaster = new THREE.Raycaster();
  surface.addEventListener('touchstart', event => {
    if (event.touches.length !== 2) { gesture = null; return; }
    event.preventDefault();
    gesture = { ...measure(points(event)), height: surface.clientHeight || innerHeight };
  }, { passive: false });
  surface.addEventListener('touchmove', event => {
    if (!gesture || event.touches.length !== 2) return;
    event.preventDefault();
    const p = measure(points(event));
    const viewScale = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) *
      camera.position.distanceTo(controls.target) / Math.max(1, gesture.height);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const pan = right.multiplyScalar(-(p.x - gesture.x) * viewScale)
      .addScaledVector(up, (p.y - gesture.y) * viewScale);
    camera.position.add(pan);
    controls.target.add(pan);

    // Twist yaws the camera around the world-space point beneath the two-finger
    // midpoint. The view plane is perpendicular to the camera direction and
    // passes through the orbit target, giving a stable pivot even in open water.
    const twist = wrapAngle(p.angle - gesture.angle);
    let yawPivotApplied = false;
    if (Math.abs(twist) > 0.0001) {
      const rect = surface.getBoundingClientRect();
      const midpoint = new THREE.Vector2(
        ((p.x - rect.left) / Math.max(1, rect.width)) * 2 - 1,
        -((p.y - rect.top) / Math.max(1, rect.height)) * 2 + 1
      );
      raycaster.setFromCamera(midpoint, camera);
      const viewNormal = camera.getWorldDirection(new THREE.Vector3());
      const pivotPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(viewNormal, controls.target);
      const pivot = raycaster.ray.intersectPlane(pivotPlane, new THREE.Vector3()) || controls.target.clone();
      const yaw = new THREE.Quaternion().setFromAxisAngle(worldUp, twist);
      camera.position.sub(pivot).applyQuaternion(yaw).add(pivot);
      controls.target.sub(pivot).applyQuaternion(yaw).add(pivot);
      camera.up.copy(worldUp);
      camera.quaternion.premultiply(yaw);
      yawPivotApplied = true;
    }

    const zoomFactor = gesture.distance / Math.max(p.distance, 1);
    const offset = camera.position.clone().sub(controls.target);
    offset.multiplyScalar(THREE.MathUtils.clamp(zoomFactor, 0.85, 1.18));
    offset.setLength(THREE.MathUtils.clamp(offset.length(), 4, 900));
    camera.position.copy(controls.target).add(offset);
    controls.update();
    camera.up.copy(worldUp);
    gesture = { ...p, height: gesture.height };
    window.__osmoceanTouchGesture = { pan: true, rotate: true, zoom: true, yawPivot: yawPivotApplied, noRoll: camera.up.distanceTo(worldUp) < 1e-6 };
  }, { passive: false });
  const endGesture = event => {
    if (event.touches.length < 2) gesture = null;
    else if (event.touches.length === 2) gesture = { ...measure(points(event)), height: surface.clientHeight || innerHeight };
  };
  surface.addEventListener('touchend', endGesture, { passive: true });
  surface.addEventListener('touchcancel', endGesture, { passive: true });
}`,
  'two-finger pan, twist and pinch camera gestures');
main = replaceExactly(main,
  "import { Floaters } from './scene/floaters.js';",
  "import { Floaters } from './scene/floaters.js';\nimport { RapierFloaters } from './scene/rapierFloaters.js';\nimport * as RAPIER from '@dimforge/rapier3d-compat';\nimport { createUnifiedCoupling } from './osmocean/UnifiedCoupling.js';\nimport { FishEcology } from './ecology/fish-ecology.js';\nimport { createReef } from './ecology/reef-environment.js';\nimport { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';",
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
  `const mobile = args.has('mobile') || (!args.has('desktop') && matchMedia('(pointer: coarse)').matches);`,
  `const mobile = args.has('mobile') || (!args.has('desktop') && (matchMedia('(pointer: coarse)').matches || navigator.webdriver));\n// Keep the sun shadow target enabled: underwater shafts sample its depth texture even on low-power devices.`,
  'use the low-cost GPU profile for software-rendered browsers and mobile devices');
main = replaceExactly(main,
  `const quality = mobile
  ? { resolution: 0.6, msaa: 2, reflections: true, reflectionScale: 0.35, autoResolution: true }
  : { resolution: 1, msaa: 4, reflections: true, reflectionScale: 0.5 };`,
  `const quality = mobile
  ? { resolution: 0.5, msaa: 0, reflections: false, reflectionScale: 0.25, autoResolution: true }
  : { resolution: 1, msaa: 4, reflections: true, reflectionScale: 0.5 };`,
  'conservative mobile GPU profile');
main = replaceExactly(main,
  'const query = new WaterQuery(renderer, surface, 512);',
  'const query = new WaterQuery(renderer, surface, mobile ? 512 : 1024);',
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
  "window.__osmoceanBootStatus = 'scene-initialized';\nwindow.app = {\n  camera, controls, sky, post, surface, ocean, terrain, timer, views, quality, renderer, floaters, query, underwater, spray, snow, caustics, floatShadow, physicsEngine: 'Rapier 3D 0.21.0', displayMode: 'UNDERWATER REEF', reef, reefRockAssetCount: reef.rockAssetCount, fishModelLoaded: ecology.modelLoaded, fishSpeciesModelCount: ecology.modelCatalog.filter(item => item.scene).length, fishSpeciesNames: ecology.modelCatalog.map(item => item.name),",
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
main = replaceExactly(main,
  "const ui = { view: 'Lagoon', benchmark: () => benchButton.click(), exposure: 1 };\ngui.add(ui, 'view', Object.keys(views)).name('camera').onChange((v) => views[v]());",
  "const ui = { view: 'Underwater', benchmark: () => benchButton.click(), exposure: 1 };",
  'lock initial camera preset to underwater');
main = replaceExactly(main, 'views[ui.view]();', 'views[ui.view]();\ncontrols.target.y = -10; controls.update();\nconst reefHeading = camera.getWorldDirection(new THREE.Vector3());\necology.group.position.set(camera.position.x + reefHeading.x * (mobile ? 7 : 10), 0, camera.position.z + reefHeading.z * (mobile ? 7 : 10));\nreef.group.position.y = -7.5;\ncontrols.enabled = false; controls.enableRotate = false; controls.enablePan = false; controls.enableZoom = false;\nunderwater.params.scattering = 0.055; underwater.params.shafts = 2.1; underwater.params.shaftRange = 72;\nwindow.__osmoceanDisplayMode = \'UNDERWATER REEF\';\nif (window.__osmoceanRapierReady && floaters instanceof RapierFloaters) { try { osmoceanUnified = createUnifiedCoupling({ THREE, scene, RAPIER, floaters, controls }); } catch (error) { reportBootError(error); } }', 'initialize locked underwater reef scene');

// Add fish ecology after the Rapier integration has transformed the upstream entry point.
copy(path.join(repoRoot, 'src/ecology/fish-ecology.js'), path.join(upstream, 'src/ecology/fish-ecology.js'));
copy(path.join(repoRoot, 'src/ecology/aquatic-physics.js'), path.join(upstream, 'src/ecology/aquatic-physics.js'));
copy(path.join(repoRoot, 'src/ecology/reef-environment.js'), path.join(upstream, 'src/ecology/reef-environment.js'));
copy(path.join(repoRoot, 'src/ecology/polyfish-swim-material.js'), path.join(upstream, 'src/ecology/polyfish-swim-material.js'));
main = replaceExactly(main,
  "let floaters;\ntry { floaters = window.__osmoceanRapierReady ? new RapierFloaters({ RAPIER, scene, heightAt: islandHeight, patchMaterial: terrain.patchProp, query }) : new Floaters({ scene, heightAt: islandHeight, patchMaterial: terrain.patchProp }); } catch (error) { reportBootError(error); floaters = new Floaters({ scene, heightAt: islandHeight, patchMaterial: terrain.patchProp }); }\nlet osmoceanUnified = null;\nwindow.__osmoceanBootStatus = window.__osmoceanRapierReady ? 'rapier-world-ready' : 'fallback-world-ready';",
  `let floaters;
try { floaters = window.__osmoceanRapierReady ? new RapierFloaters({ RAPIER, scene, heightAt: islandHeight, patchMaterial: terrain.patchProp, query }) : new Floaters({ scene, heightAt: islandHeight, patchMaterial: terrain.patchProp }); } catch (error) { reportBootError(error); floaters = new Floaters({ scene, heightAt: islandHeight, patchMaterial: terrain.patchProp }); }
let fishGltf = null;\ntry { fishGltf = await new GLTFLoader().loadAsync(import.meta.env.BASE_URL + 'models/osmocean/fish_rigged.glb'); } catch (error) { console.warn('[Osmocean] Rigged shoal fish fallback unavailable:', error); }\nconst assetLoader = new GLTFLoader();
const speciesDefinitions = [
  {id:'clownfish',name:'Clownfish',weight:5.5,scale:0.9,sizeClass:'shoal',detail:false},
  {id:'blue_tang',name:'Blue tang',weight:5.2,scale:1.0,sizeClass:'shoal',detail:false},
  {id:'cardinal_fish',name:'Cardinal fish',weight:4.8,scale:0.8,sizeClass:'shoal',detail:false},
  {id:'butterfly_fish',name:'Butterflyfish',weight:4.5,scale:1.0,sizeClass:'shoal',detail:false},
  {id:'tetra',name:'Tetra',weight:4.8,scale:0.8,sizeClass:'shoal',detail:false},
  {id:'mandarin_fish',name:'Mandarinfish',weight:3.6,scale:0.75,sizeClass:'shoal',detail:false},
  {id:'moorish_idol',name:'Moorish idol',weight:3.5,scale:1.1,sizeClass:'shoal',detail:false},
  {id:'royal_gramma',name:'Royal gramma',weight:3.2,scale:0.85,sizeClass:'shoal',detail:false},
  {id:'parrot_fish',name:'Parrotfish',weight:2.2,scale:1.35,sizeClass:'reef'},
  {id:'lionfish',name:'Lionfish',weight:1.6,scale:1.35,sizeClass:'reef',role:'predator'},
  {id:'black_lion_fish',name:'Black lionfish',weight:1.1,scale:1.45,sizeClass:'reef',role:'predator'},
  {id:'puffer',name:'Pufferfish',weight:1.7,scale:1.25,sizeClass:'reef'},
  {id:'coral_grouper',name:'Coral grouper',weight:1.3,scale:1.8,sizeClass:'large',role:'predator'},
  {id:'humphead',name:'Humphead wrasse',weight:0.9,scale:2.0,sizeClass:'large'},
  {id:'sunfish',name:'Ocean sunfish',weight:0.55,scale:2.25,sizeClass:'large'},
  {id:'tuna',name:'Tuna',weight:0.65,scale:2.2,sizeClass:'large',role:'predator'},
  {id:'swordfish',name:'Swordfish',weight:0.35,scale:2.5,sizeClass:'large',role:'predator'},
  {id:'shark',name:'Reef shark',weight:0.45,scale:2.65,sizeClass:'large',role:'predator'},
  {id:'goblin_shark',name:'Goblin shark',weight:0.18,scale:2.7,sizeClass:'large',role:'predator'},
  {id:'anglerfish',name:'Anglerfish',weight:0.22,scale:1.8,sizeClass:'large',role:'predator'}
];
const modelCatalog = (await Promise.all(speciesDefinitions.map(async definition => {
  try {
    if (definition.detail === false) return {...definition,scene:null,animations:[]};
    const gltf = await assetLoader.loadAsync(import.meta.env.BASE_URL + 'models/osmocean/species/' + definition.id + '.glb');
    return {...definition,scene:gltf.scene,animations:gltf.animations??[]};
  } catch (error) {
    console.warn('[Osmocean] Optional CC0 species model unavailable:',definition.id,error);
    return null;
  }
}))).filter(Boolean);
const reefRockTemplates = [];
for (const assetId of ['rock_moss_set_01','rock_moss_set_02']) {
  try { const rockGltf = await assetLoader.loadAsync(import.meta.env.BASE_URL + 'models/osmocean/reef/' + assetId + '.gltf'); reefRockTemplates.push(rockGltf.scene); }
  catch (error) { console.warn('[Osmocean] Optional CC0 rock asset unavailable:', assetId, error); }
}
const ecology = new FishEcology(THREE, scene, { population: mobile ? 32 : 48, modelBudget: mobile ? 8 : 14, worldRadius: mobile ? 10 : 18, minDepth: 3, maxDepth: mobile ? 16 : 20, resourceCount: mobile ? 80 : 120, seed: 0x51f15e, modelTemplate: fishGltf?.scene ?? null, modelAnimations: fishGltf?.animations ?? [], modelCatalog });
const reef = createReef(THREE, ecology.group, 0x71ef, mobile ? 0.35 : 0.5, { rockTemplates: reefRockTemplates });
let osmoceanUnified = null;
window.__osmoceanBootStatus = window.__osmoceanRapierReady ? 'rapier-world-ready' : 'fallback-world-ready';`,
  `let floaters;
try { floaters = window.__osmoceanRapierReady ? new RapierFloaters({ RAPIER, scene, heightAt: islandHeight, patchMaterial: terrain.patchProp, query }) : new Floaters({ scene, heightAt: islandHeight, patchMaterial: terrain.patchProp }); } catch (error) { reportBootError(error); floaters = new Floaters({ scene, heightAt: islandHeight, patchMaterial: terrain.patchProp }); }
const ecology = new FishEcology(THREE, scene, { population: 110, worldRadius: 42, minDepth: 3, maxDepth: 26, resourceCount: 220, seed: 0x51f15e });
const reef = createReef(THREE, ecology.group);
let osmoceanUnified = null;
window.__osmoceanBootStatus = window.__osmoceanRapierReady ? 'rapier-world-ready' : 'fallback-world-ready';`,
  'native fish ecology construction');
main = replaceExactly(main,
  "if (mobile) gui.close();",
  "const fEcology = gui.addFolder('Ecology');\nfEcology.add(ecology.params, 'population', 0, 300, 1).onChange((n) => ecology.populate(n));\nfEcology.add(ecology.params, 'worldRadius', 20, 300, 1);\nfEcology.add(ecology.params, 'neighbourRadius', 4, 40, 1);\nfEcology.add(ecology.params, 'maxDepth', 5, 60, 1);\nfEcology.close();\nconst fFood = gui.addFolder('Food web & energy');\nfFood.add(ecology.params, 'resourceCount', 0, 500, 1).onChange(n => ecology.seedResources(n));\nfFood.add(ecology.params, 'resourceRegrowth', 0, 0.2, 0.005);\nfFood.add(ecology.params, 'feedingRate', 0.02, 1, 0.01);\nfFood.close();\nconst fEvolution = gui.addFolder('Evolution & predation');\nfEvolution.add(ecology.params, 'mutationRate', 0, 0.5, 0.01);\nfEvolution.add(ecology.params, 'mutationStrength', 0.01, 0.5, 0.01);\nfEvolution.add(ecology.params, 'reproductionEnergy', 0.4, 1.4, 0.02);\nfEvolution.add(ecology.params, 'predationThreshold', 0, 1, 0.02);\nfEvolution.add(ecology.params, 'predationRate', 0, 2, 0.02);\nfEvolution.close();\nconst fEnvironment = gui.addFolder('Environment');\nfEnvironment.add(ecology.params, 'currentStrength', 0, 2, 0.02);\nfEnvironment.add(ecology.params, 'temperatureGradient', 0, 1, 0.02);\nfEnvironment.add(ecology.params, 'oxygenGradient', 0, 1, 0.02);\nfEnvironment.close();\nwindow.__osmoceanEcology = ecology;\nif (mobile) gui.close();",
  'live ecology controls');
main = replaceExactly(main, 'window.__osmoceanEcology = ecology;',
  `window.__osmoceanEcology = ecology;
const ecologyPanel = document.createElement('section');
ecologyPanel.id = 'osmocean-ecology-observatory';
ecologyPanel.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:9999;width:270px;max-width:calc(100vw - 24px);padding:12px;background:rgba(5,18,28,.88);color:#d8f3ef;border:1px solid rgba(115,220,210,.3);border-radius:10px;font:12px/1.45 system-ui;backdrop-filter:blur(12px);';
ecologyPanel.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center"><b style="letter-spacing:.12em">ECOLOGY OBSERVATORY</b><button id="eco-hide" style="background:#20414a;color:#d8f3ef;border:0;border-radius:5px;padding:4px 8px">Hide</button></div><div id="eco-stats" style="margin:8px 0;color:#b9d9d4">Initialising population…</div><canvas id="eco-history" width="246" height="76" style="width:100%;height:76px"></canvas><div style="opacity:.65;margin-top:4px">Population history · selectable live parameters in Ecology folders</div>';
document.body.appendChild(ecologyPanel);\nconst assetCredit = document.createElement('div'); assetCredit.textContent = 'CC0 reef rock assets · Powered by Poly Haven'; assetCredit.style.cssText = 'font-size:10px;opacity:.62;margin-top:3px'; ecologyPanel.appendChild(assetCredit);
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
  'function tick(now) {\n  const dt = Math.min((now - last) / 1000, 0.1);\n  last = now;',
  'let osmoceanTickCount = 0;\nfunction tick(now) {\n  const dt = Math.min((now - last) / 1000, 0.1);\n  last = now;\n  osmoceanTickCount++;\n  window.__osmoceanTickCount = osmoceanTickCount;\n  window.__osmoceanLastTickAt = performance.now();',
  'instrument the actual RAF tick');
main = replaceExactly(main,
  '    tick(now);',
  '    try { tick(now); } catch (error) { window.__osmoceanLastFrameError = error?.stack || error?.message || String(error); reportBootError(error); }',
  'keep RAF loop scheduled after recoverable frame errors');
main = replaceExactly(main,
  `// uncapped: frames back-to-back off the display's clock (it still shows the latest one at`,
  `const reefFrameWatchdog = setInterval(() => {
  if (document.hidden || uncapped || benchmarking) return;
  const now = performance.now();
  const lastTick = window.__osmoceanLastTickAt ?? now;
  if (now - lastTick < 250) return;
  window.__osmoceanFallbackTicks = (window.__osmoceanFallbackTicks ?? 0) + 1;
  try { tick(now); }
  catch (error) { window.__osmoceanLastFrameError = error?.stack || error?.message || String(error); reportBootError(error); }
}, 100);
// uncapped: frames back-to-back off the display's clock (it still shows the latest one at`,
  'recover the scene if the display RAF stalls');
main = replaceExactly(main, '  elapsed += dt;', '  elapsed += dt;\n  ecology.update(dt, elapsed, camWater);', 'advance fish ecology before renderer subsystems');
main = replaceExactly(main,
  '  floaters.step(dt, elapsed);',
  '  floaters.step(dt, elapsed);\n  if (window.__osmoceanEcologyPanel && window.__osmoceanEcologyPanel.style.display !== \'none\') { const stats = ecology.getStats(); const label = window.__osmoceanEcologyPanel.querySelector(\'#eco-stats\'); if (label) label.textContent = `Fish ${stats.population} · food ${Math.round(stats.resources)} · generation ${stats.meanGeneration.toFixed(1)} · speed ${stats.meanSpeed.toFixed(2)} · aggression ${stats.meanAggression.toFixed(2)}`; const canvas = window.__osmoceanEcologyPanel.querySelector(\'#eco-history\'); if (canvas) { const ctx = canvas.getContext(\'2d\'); const rows = ecology.history; ctx.clearRect(0,0,canvas.width,canvas.height); if (rows.length > 1) { const max = Math.max(1,...rows.map(r=>r.population)); ctx.strokeStyle = \'#74d6c4\'; ctx.lineWidth = 2; ctx.beginPath(); rows.forEach((r,i)=>{const x=i/(rows.length-1)*canvas.width,y=canvas.height-r.population/max*(canvas.height-6)-3;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}); ctx.stroke(); } } }',
  'fish ecology frame update');
main = replaceExactly(main,
  'camera, controls, sky, post, surface, ocean, terrain, timer, views, quality, renderer, floaters, query, underwater, spray, snow, caustics, floatShadow, physicsEngine: \'Rapier 3D 0.21.0\',',
  'camera, controls, sky, post, surface, ocean, terrain, timer, views, quality, renderer, floaters, query, underwater, spray, snow, caustics, floatShadow, ecology, physicsEngine: \'Rapier 3D 0.21.0\',',
  'expose ecology diagnostics');
write(mainPath, main);

console.log('Integrated Ultra-Water, pinned SPH and Rapier into one Three.js scene and render lifecycle.');
