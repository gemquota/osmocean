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
    this.radius = mobile ? 900 : 1800;
    this.depthRange = mobile ? [5, 13] : [5, 18];
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

    const proceduralBones = [];
    visual.traverse(node => {
      if (node.isBone && /(tail|fin|spine|caudal|body)/i.test(node.name)) {
        proceduralBones.push({ node, base: node.quaternion.clone(), phase: this.range(0, Math.PI * 2), amplitude: /tail|caudal/i.test(node.name) ? 0.24 : 0.1, axis: new THREE.Vector3(0, 1, 0), offset: new THREE.Quaternion() });
      }
    });
    const mixer = model.animations.length ? new THREE.AnimationMixer(visual) : null;
    if (mixer) {
      const clip = model.animations.find(item => /swim|idle|move/i.test(item.name)) ?? model.animations[0];
      mixer.clipAction(clip).play();
    }

    const near = index < Math.ceil(this.count * 0.4);
    const angle = this.range(0, Math.PI * 2);
    const radius = near ? this.range(10, 42) : Math.sqrt(this.random()) * this.radius;
    const center = new THREE.Vector3(Math.cos(angle) * radius,
      -this.range(this.depthRange[0], this.depthRange[1]),
      Math.sin(angle) * radius);
    const orbit = this.range(7, near ? 24 : 42);
    const speed = this.range(0.055, 0.15) * (model.id.includes('shark') || model.id === 'tuna' ? 1.35 : 1);
    const phase = this.range(0, Math.PI * 2);
    const verticalPhase = this.range(0, Math.PI * 2);
    const initialTurn = Math.atan2(-Math.cos(phase * 0.83 + verticalPhase * 0.2) * 0.705, -Math.sin(phase));
    root.position.set(center.x + Math.cos(phase) * orbit, center.y + Math.sin(phase * 0.47 + verticalPhase) * 2.8, center.z + Math.sin(phase * 0.83 + verticalPhase * 0.2) * orbit * 0.85);
    this.group.add(root);
    this.animals.push({ root, visual, mixer, proceduralBones, center, orbit, speed, phase, verticalPhase,
      turn: initialTurn, bank: 0, model: model.id });
  }

  update(dt, elapsed = this.elapsed + dt) {
    if (!this.animals.length || !Number.isFinite(dt) || dt <= 0) return;
    const THREE = this.THREE;
    this.elapsed = elapsed;
    const step = Math.min(dt, 0.05);
    for (const animal of this.animals) {
      const t = elapsed * animal.speed + animal.phase;
      const zPhase = t * 0.83 + animal.verticalPhase * 0.2;
      const yPhase = t * 0.47 + animal.verticalPhase;
      const vertical = Math.sin(yPhase) * 2.8;
      const direction = new THREE.Vector3(
        -Math.sin(t),
        Math.cos(yPhase) * 2.8 * 0.47 / Math.max(0.5, animal.orbit),
        Math.cos(zPhase) * 0.83 * 0.85
      ).normalize();
      const desiredYaw = Math.atan2(-direction.z, direction.x);
      let deltaYaw = Math.atan2(Math.sin(desiredYaw - animal.turn), Math.cos(desiredYaw - animal.turn));
      deltaYaw = THREE.MathUtils.clamp(deltaYaw, -step * 0.9, step * 0.9);
      animal.turn += deltaYaw;
      const horizontalSpeed = Math.hypot(direction.x, direction.z);
      const desiredPitch = Math.atan2(direction.y, Math.max(0.001, horizontalSpeed));
      animal.root.rotation.set(0, animal.turn, -desiredPitch);
      animal.bank = THREE.MathUtils.damp(animal.bank, THREE.MathUtils.clamp(-deltaYaw * 2.2, -0.22, 0.22), 2.4, step);
      animal.visual.rotation.x = animal.bank;
      animal.root.position.set(
        animal.center.x + Math.cos(t) * animal.orbit,
        animal.center.y + vertical,
        animal.center.z + Math.sin(zPhase) * animal.orbit * 0.85
      );
      if (animal.mixer) animal.mixer.update(step);
      else for (const bone of animal.proceduralBones) {
        const angle = Math.sin(elapsed * animal.speed * (bone.amplitude > 0.2 ? 5.2 : 2.4) + bone.phase) * bone.amplitude;
        bone.offset.setFromAxisAngle(bone.axis, angle);
        bone.node.quaternion.copy(bone.base).multiply(bone.offset);
      }
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
