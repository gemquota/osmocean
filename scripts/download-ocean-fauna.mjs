import fs from 'node:fs';
import path from 'node:path';

const output = path.resolve(process.argv[2] || '_downloaded/ocean-fauna');
const manifestUrl = 'https://3dassets.dev/api/v1/packs/open-ocean-and-deep-sea-life';
fs.mkdirSync(output, { recursive: true });
const response = await fetch(manifestUrl);
if (!response.ok) throw new Error('Ocean fauna manifest request failed: ' + response.status);
const payload = await response.json();
const pack = payload.data;
if (pack?.licenseLabel !== 'CC0 1.0 Universal' || !Array.isArray(pack.assets)) {
  throw new Error('Unexpected ocean fauna manifest or licence; refusing unverified assets');
}
const assets = pack.assets.filter(asset =>
  asset.status === 'published' &&
  asset.category?.slug === 'animals' &&
  asset.license?.slug === 'cc0-1.0' &&
  asset.license?.attributionRequired === false &&
  asset.cdnUrl?.endsWith('/model.glb')
);
if (assets.length < 30) throw new Error('Expected at least 30 published CC0 animal models, found ' + assets.length);
const species = [];
for (const asset of assets) {
  const file = asset.id + '.glb';
  const target = path.join(output, file);
  if (!fs.existsSync(target) || fs.statSync(target).size < 1024) {
    const model = await fetch(asset.cdnUrl);
    if (!model.ok) throw new Error('Model download failed for ' + asset.title + ': ' + model.status);
    const bytes = Buffer.from(await model.arrayBuffer());
    if (bytes.length < 1024) throw new Error('Downloaded model is unexpectedly small: ' + asset.title);
    fs.writeFileSync(target, bytes);
  }
  const title = asset.title.replace(/ \(Ocean Animals: Whales, Sharks and Fish\)$/i, '');
  const normalized = title.toLowerCase();
  const dims = asset.stats?.sizeMeters ?? [2.3, 1, 1];
  const longest = Math.max(...dims);
  const predator = /shark|barracuda|marlin|swordfish|tuna|angler|orca|dolphin|seal|squid/i.test(normalized);
  const megafauna = /whale|orca|dolphin|seal|manta|ray/i.test(normalized);
  const deepwater = /angler|gulper|goblin|viper|lantern|fangtooth|deep/i.test(normalized);
  const minDepth = deepwater ? 140 : megafauna ? 18 : predator ? 24 : 4;
  const maxDepth = deepwater ? 390 : megafauna ? 260 : predator ? 300 : 180;
  const weight = megafauna ? 0.2 : predator ? 0.55 : 0.7;
  species.push({
    id: 'pelagic-' + asset.id,
    name: title.replace(/\b\w/g, letter => letter.toUpperCase()),
    file,
    scale: Math.max(0.45, longest / 2.3),
    weight,
    role: predator ? 'predator' : 'generalist',
    sizeClass: megafauna ? 'megafauna' : predator ? 'large' : 'pelagic',
    sizeMeters: dims,
    minDepth,
    maxDepth,
    triangles: asset.stats?.triangles ?? null,
    source: '3DAssets.dev',
    license: 'CC0-1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/'
  });
}
fs.writeFileSync(path.join(output, 'catalog.json'), JSON.stringify({
  pack: pack.title,
  packUrl: pack.url,
  license: 'CC0 1.0 Universal',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  species
}, null, 2) + '\n');
console.log('Downloaded ' + species.length + ' CC0 marine animal models (' +
  species.reduce((sum, item) => sum + (item.triangles ?? 0), 0) + ' triangles).');
