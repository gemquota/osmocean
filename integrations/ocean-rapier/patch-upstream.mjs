import { readFile, writeFile } from 'node:fs/promises';

const file = '_upstream/ultra-water/src/main.js';
let source = await readFile(file, 'utf8');
const oldImport = "import { Floaters } from './scene/floaters.js';";
if (!source.includes(oldImport)) throw new Error('Ultra-Water Floaters import not found; refusing an unsafe patch');
source = source.replace(oldImport, "import { RapierFloaters } from './scene/rapierFloaters.js';\nimport RAPIER from '@dimforge/rapier3d-compat';\n\nawait RAPIER.init();");
const oldCreate = "const floaters = new Floaters({ scene, heightAt: islandHeight, patchMaterial: terrain.patchProp });";
if (!source.includes(oldCreate)) throw new Error('Ultra-Water Floaters constructor not found; refusing an unsafe patch');
source = source.replace(oldCreate, "const floaters = new RapierFloaters({ RAPIER, scene, heightAt: islandHeight, patchMaterial: terrain.patchProp });");
await writeFile(file, source);
console.log('Patched Ultra-Water: Rapier now owns floater rigid bodies.');
