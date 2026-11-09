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
  "import { RapierFloaters } from './scene/rapierFloaters.js';\\nimport * as RAPIER from '@dimforge/rapier3d-compat';\\nimport { createUnifiedCoupling } from './osmocean/UnifiedCoupling.js';",
  "import { RapierFloaters } from './scene/rapierFloaters.js';\\nimport * as RAPIER from '@dimforge/rapier3d-compat';\\nimport { createUnifiedCoupling } from './osmocean/UnifiedCoupling.js';\\nimport { FishEcology } from './ecology/fish-ecology.js';",
  'native fish ecology import');
main = replaceExactly(main,
  "const floaters = new RapierFloaters({ RAPIER, scene, heightAt: islandHeight, patchMaterial: terrain.patchProp, query });\nlet osmoceanUnified = null;\nwindow.__osmoceanBootStatus = 'rapier-world-ready';",
  "const floaters = new RapierFloaters({ RAPIER, scene, heightAt: islandHeight, patchMaterial: terrain.patchProp, query });\nconst ecology = new FishEcology(THREE, scene, { population: 72, seed: 0x51f15e });\nlet osmoceanUnified = null;\nwindow.__osmoceanBootStatus = 'rapier-world-ready';",
  'native fish ecology construction');
main = replaceExactly(main,
  "if (mobile) gui.close();",
  "const fEcology = gui.addFolder('Ecology');\nfEcology.add(ecology.params, 'population', 0, 250, 1).onChange((n) => ecology.populate(n));\nfEcology.add(ecology.params, 'worldRadius', 20, 300, 1);\nfEcology.add(ecology.params, 'neighbourRadius', 4, 40, 1);\nfEcology.add(ecology.params, 'maxDepth', 5, 60, 1);\nfEcology.close();\nif (mobile) gui.close();",
  'live ecology controls');
main = replaceExactly(main,
  '  floaters.step(dt);',
  '  floaters.step(dt);\n  ecology.update(dt, elapsed, camWater);',
  'fish ecology frame update');
main = replaceExactly(main,
  'camera, controls, sky, post, surface, ocean, terrain, timer, views, quality, renderer, floaters, query, underwater, spray, snow, caustics, floatShadow,',
  'camera, controls, sky, post, surface, ocean, terrain, timer, views, quality, renderer, floaters, query, underwater, spray, snow, caustics, floatShadow, ecology,',
  'expose ecology diagnostics');
write(mainPath, main);

console.log('Integrated Ultra-Water, Rapier and native fish ecology into one Three.js scene and render lifecycle.');
