import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const upstream = path.resolve(process.argv[2] || '_upstream/fluid');
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

const manifestPath = path.join(upstream, 'package.json');
const manifest = JSON.parse(read(manifestPath));
manifest.dependencies ||= {};
manifest.dependencies['@dimforge/rapier2d-compat'] = '0.21.0';
write(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const integrationDir = path.join(upstream, 'src/osmocean');
copy(path.join(repoRoot, 'src/adapters/rapier-fluid-sph2d.js'), path.join(integrationDir, 'rapier-fluid-sph2d.js'));
copy(path.join(repoRoot, 'integrations/fluid-rapier/rapier-fluid-sph2d.d.ts'), path.join(integrationDir, 'rapier-fluid-sph2d.d.ts'));
copy(path.join(repoRoot, 'src/adapters/fluid-ocean-boundary.js'), path.join(integrationDir, 'fluid-ocean-boundary.js'));
copy(path.join(repoRoot, 'integrations/fluid-rapier/fluid-ocean-boundary.d.ts'), path.join(integrationDir, 'fluid-ocean-boundary.d.ts'));
copy(path.join(repoRoot, 'integrations/fluid-rapier/fluid-ocean-rapier.ts'), path.join(integrationDir, 'fluid-ocean-rapier.ts'));
copy(path.join(repoRoot, 'integrations/fluid-rapier/fluid-ocean-rapier.css'), path.join(integrationDir, 'fluid-ocean-rapier.css'));
copy(path.join(repoRoot, 'integrations/fluid-rapier/fluid-ocean-rapier.html'), path.join(upstream, 'fluid-ocean-rapier.html'));
copy(path.join(repoRoot, 'integrations/fluid-rapier/main.ts'), path.join(integrationDir, 'rapier-fluid-2d.ts'));
copy(path.join(repoRoot, 'integrations/fluid-rapier/rapier-fluid-2d.css'), path.join(integrationDir, 'rapier-fluid-2d.css'));
copy(path.join(repoRoot, 'integrations/fluid-rapier/rapier-fluid-2d.html'), path.join(upstream, 'rapier-fluid-2d.html'));

const vitePath = path.join(upstream, 'vite.config.ts');
let vite = read(vitePath);
vite = replaceExactly(
  vite,
  "'main-index': resolve(__dirname, 'index.html'),",
  "'main-index': resolve(__dirname, 'index.html'),\n        'osmocean-rapier-fluid': resolve(__dirname, 'rapier-fluid-2d.html'),
        'osmocean-fluid-ocean-rapier': resolve(__dirname, 'fluid-ocean-rapier.html'),
  'Vite multi-page input'
);
write(vitePath, vite);
console.log('Injected Osmocean SPH/Rapier and ocean-boundary demos into the pinned upstream fluid build.');
