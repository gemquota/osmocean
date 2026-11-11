import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const SPECIES = [
  'anglerfish','black_lion_fish','coral_grouper','goblin_shark','humphead','lionfish',
  'parrot_fish','puffer','shark','sunfish','swordfish','tuna'
];

export class MarineModelViewer {
  constructor(THREE, scene, { baseUrl = './', mobile = false, seed = 0x51f15e } = {}) {
    this.THREE = THREE;
    this.scene = scene;
    this.loader = new GLTFLoader();
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
    this.randomState = seed >>> 0;
    this.models = [];
    this.animals = [];
    this.elapsed = 0;
    this.count = mobile ? 18 : 34;
    this.radius = mobile ? 100 : 155;
    this.depthRange = mobile ? [8, 48] : [8, 72];
    this.group = new THREE.Group();
    this.group.name = 'Marine model display';
    scene.add(this.group);
    this.ready = this.load();
  }

  random() {
    let x = this.randomState;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.randomState = x >>> 0;
    return this.randomState / 4294967296;
  }

  range(min, max) { return min + this.random() * (max - min); }

  async load() {
    const loaded = await Promise.all(SPECIES.map(async (id) => {
      try {
        const gltf = await this.loader.loadAsync(this.baseUrl + 'models/osmocean/species/' + id + '.glb');
        return { id, scene: gltf.scene, animations: gltf.animations ?? [] };
      } catch (error) {
        console.warn('[Osmocean] Marine model unavailable:', id, error);
        return null;
      }
    }));
    this.models = loaded.filter(Boolean);
    if (!this.models.length) throw new Error('No animated marine species models could be loaded');
    for (let i = 0; i < this.count; i++) this.addAnimal(i);
    window.__osmoceanMarineViewer = {
      ready: true, modelCount: this.models.length, animalCount: this.animals.length,
      animatedCount: this.animals.filter(a => a.mixer).length,
      species: this.models.map(model => model.id)
    };
    return this;
  }

  addAnimal(index) {
    const THREE = this.THREE;
    const model = this.models[index % this.models.length];
    const root = new THREE.Group();
    const visual = cloneSkeleton(model.scene);
    visual.traverse(node => {
      if ((node.isMesh || node.isSkinnedMesh) && node.material) {
        node.material = Array.isArray(node.material)
          ? node.material.map(material => material.clone())
          : node.material.clone();
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of materials) {
          material.roughness = Math.min(1, Math.max(0.28, material.roughness ?? 0.65));
        }
      }
    });
    visual.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(visual);
    const size = bounds.getSize(new THREE.Vector3());
    const longest = size.x >= size.z && size.x >= size.y ? 'x' : size.z >= size.y ? 'z' : 'y';
    if (longest === 'z') visual.rotation.y = Math.PI / 2;
    else if (longest === 'y') visual.rotation.z = -Math.PI / 2;
    visual.updateMatrixWorld(true);
    const orientedBounds = new THREE.Box3().setFromObject(visual);
    const extent = orientedBounds.getSize(new THREE.Vector3());
    const targetLength = this.range(2.4, 5.2);
    visual.scale.setScalar(targetLength / Math.max(extent.x, extent.y, extent.z, 0.001));
    visual.updateMatrixWorld(true);
    const scaledBounds = new THREE.Box3().setFromObject(visual);
    visual.position.sub(scaledBounds.getCenter(new THREE.Vector3()));
    root.add(visual);

    const mixer = model.animations.length ? new THREE.AnimationMixer(visual) : null;
    if (mixer) {
      const clip = model.animations.find(item => /swim|idle|move/i.test(item.name)) ?? model.animations[0];
      mixer.clipAction(clip).play();
    }

    const near = index < Math.ceil(this.count * 0.65);
    const angle = this.range(0, Math.PI * 2);
    const radius = near ? this.range(18, 78) : this.range(85, this.radius);
    const center = new THREE.Vector3(Math.cos(angle) * radius,
      -this.range(this.depthRange[0], this.depthRange[1]),
      Math.sin(angle) * radius);
    const orbit = this.range(7, near ? 24 : 42);
    const speed = this.range(0.055, 0.15) * (model.id.includes('shark') || model.id === 'tuna' ? 1.35 : 1);
    const phase = this.range(0, Math.PI * 2);
    const verticalPhase = this.range(0, Math.PI * 2);
    root.position.copy(center);
    this.group.add(root);
    this.animals.push({ root, visual, mixer, center, orbit, speed, phase, verticalPhase,
      turn: this.range(0, Math.PI * 2), bank: 0, model: model.id });
  }

  update(dt, elapsed = this.elapsed + dt) {
    if (!this.animals.length || !Number.isFinite(dt) || dt <= 0) return;
    const THREE = this.THREE;
    this.elapsed = elapsed;
    const step = Math.min(dt, 0.05);
    for (const animal of this.animals) {
      const t = elapsed * animal.speed + animal.phase;
      const target = new THREE.Vector3(
        animal.center.x + Math.cos(t) * animal.orbit,
        animal.center.y + Math.sin(t * 0.43 + animal.verticalPhase) * 2.8,
        animal.center.z + Math.sin(t) * animal.orbit
      );
      const direction = target.sub(animal.root.position);
      const distance = direction.length();
      if (distance > 1e-5) {
        direction.normalize();
        const forward = new THREE.Vector3(Math.cos(animal.turn), 0, -Math.sin(animal.turn));
        const desiredYaw = Math.atan2(-direction.z, direction.x);
        let deltaYaw = Math.atan2(Math.sin(desiredYaw - animal.turn), Math.cos(desiredYaw - animal.turn));
        deltaYaw = THREE.MathUtils.clamp(deltaYaw, -step * 0.7, step * 0.7);
        animal.turn += deltaYaw;
        const horizontalSpeed = Math.hypot(direction.x, direction.z);
        const desiredPitch = Math.atan2(direction.y, Math.max(0.001, horizontalSpeed));
        animal.root.rotation.set(0, animal.turn, -desiredPitch);
        animal.bank = THREE.MathUtils.damp(animal.bank, THREE.MathUtils.clamp(-deltaYaw * 2.2, -0.22, 0.22), 2.4, step);
        animal.visual.rotation.x = animal.bank;
        const travel = Math.min(distance, step * (animal.model.includes('shark') ? 7.5 : 4.8));
        animal.root.position.addScaledVector(direction, travel);
      }
      if (animal.mixer) animal.mixer.update(step);
    }
  }

  dispose() {
    for (const animal of this.animals) {
      this.group.remove(animal.root);
      animal.mixer?.stopAllAction();
    }
    this.animals.length = 0;
    this.scene.remove(this.group);
  }
}
