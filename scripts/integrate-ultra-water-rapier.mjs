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
  if (count !== 1) throw new Error(`Expected one ${label} match, found ${count}`);
  return source.replace(before, after);
}

const packagePath = path.join(upstream, 'package.json');
const manifest = JSON.parse(read(packagePath));
manifest.dependencies ||= {};
manifest.dependencies['@dimforge/rapier3d-compat'] = '0.21.0';
write(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);

const osmoceanDir = path.join(upstream, 'src/osmocean');
copy(path.join(repoRoot, 'src/adapters/rapier-ultra-water.js'), path.join(osmoceanDir, 'rapier-ultra-water.js'));
copy(path.join(repoRoot, 'src/core/vector3.js'), path.join(osmoceanDir, 'vector3.js'));
let adapter = read(path.join(osmoceanDir, 'rapier-ultra-water.js'));
adapter = replaceExactly(adapter, '"../core/vector3.js"', '"./vector3.js"', 'adapter vector import');
write(path.join(osmoceanDir, 'rapier-ultra-water.js'), adapter);
copy(path.join(repoRoot, 'scripts/upstream/rapierFloaters.js'), path.join(upstream, 'src/scene/rapierFloaters.js'));

const mainPath = path.join(upstream, 'src/main.js');
let main = read(mainPath);
main = replaceExactly(main,
  "import { Floaters } from './scene/floaters.js';",
  "import { RapierFloaters } from './scene/rapierFloaters.js';\nimport * as RAPIER from '@dimforge/rapier3d-compat';",
  'floater import');
main = replaceExactly(main,
  'const REFLECT_LAYER = 1;',
  'await RAPIER.init();\n\nconst REFLECT_LAYER = 1;',
  'Rapier WASM initialization');
main = replaceExactly(main,
  'const floaters = new Floaters({ scene, heightAt: islandHeight, patchMaterial: terrain.patchProp });',
  'const floaters = new RapierFloaters({ RAPIER, scene, heightAt: islandHeight, patchMaterial: terrain.patchProp, query });',
  'floater runtime construction');
main = replaceExactly(main,
  'const pts = floaters.collectPoints([camera.position]);',
  'const pts = floaters.collectPoints([camera.position], elapsed);',
  'batched query collection');
for (const line of [
  "fFloat.add(floaters.params, 'drag', 0, 6, 0.01);\n",
  "fFloat.add(floaters.params, 'angularDrag', 0, 4, 0.01);\n",
  "fFloat.add(floaters.params, 'buoyancy', 0, 2, 0.01);\n",
]) main = replaceExactly(main, line, '', 'legacy custom-integrator control');
main = replaceExactly(main,
  'window.app = {\n  camera, controls, sky, post, surface, ocean, terrain, timer, views, quality, renderer, floaters, query, underwater, spray, snow, caustics, floatShadow,',
  "window.app = {\n  camera, controls, sky, post, surface, ocean, terrain, timer, views, quality, renderer, floaters, query, underwater, spray, snow, caustics, floatShadow, physicsEngine: 'Rapier 3D 0.21.0',",
  'runtime diagnostics export');
write(mainPath, main);
console.log('Integrated pinned Ultra-Water source with Rapier-owned floater bodies.');
