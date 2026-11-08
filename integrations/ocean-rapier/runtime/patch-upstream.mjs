import { readFile, writeFile } from 'node:fs/promises';

const file = '_upstream/ultra-water/src/main.js';
let source = await readFile(file, 'utf8');
const replacements = [
  ["import { Floaters } from './scene/floaters.js';", "import { RapierFloaters } from './scene/rapierFloaters.js';\nimport RAPIER from '@dimforge/rapier3d-compat';\n\nawait RAPIER.init();"],
  ["const floaters = new Floaters({ scene, heightAt: islandHeight, patchMaterial: terrain.patchProp });", "const floaters = new RapierFloaters({ RAPIER, scene, patchMaterial: terrain.patchProp });"],
  ["floaters.ingest(query, 1);", "floaters.ingest(query);"],
  ["const pts = floaters.collectPoints([camera.position]);\n  query.submit(pts, floaters.count, floaters.layout, elapsed);", "const pts = floaters.collectPoints([camera.position], elapsed);\n  query.submit(pts, floaters.count, floaters.layout, elapsed);"],
];
for (const [before, after] of replacements) {
  if (!source.includes(before)) throw new Error('Expected Ultra-Water integration seam not found: ' + before.slice(0, 90));
  source = source.replace(before, after);
}
source = source.replace("fFloat.add(floaters.params, 'drag', 0, 6, 0.01);\nfFloat.add(floaters.params, 'angularDrag', 0, 4, 0.01);\nfFloat.add(floaters.params, 'buoyancy', 0, 2, 0.01);", "// Rapier owns rigid-body integration; hydrodynamic coefficients are configured in the adapter.");
await writeFile(file, source);
console.log('Patched Ultra-Water to use the canonical Osmocean Rapier/WaterQuery adapter.');
