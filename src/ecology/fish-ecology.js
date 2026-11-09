/**
 * Ultra-Water Ecology — first native fish-agent layer.
 * Rendering is a view of agent state; movement and traits live in this module.
 * No dependency on the SPH/Rapier experiments.
 */
export class FishEcology {
  constructor(THREE, scene, options = {}) {
    this.THREE = THREE;
    this.scene = scene;
    this.params = {
      population: options.population ?? 72,
      worldRadius: options.worldRadius ?? 95,
      minDepth: options.minDepth ?? 3,
      maxDepth: options.maxDepth ?? 24,
      neighbourRadius: options.neighbourRadius ?? 18,
      separationRadius: options.separationRadius ?? 5,
      maxAcceleration: options.maxAcceleration ?? 5,
      ...options.params,
    };
    this.randomState = options.seed ?? 0x51f15e;
    this.fish = [];
    this.group = new THREE.Group();
    this.group.name = 'Ultra-Water Ecology / fish population';
    scene.add(this.group);
    this.materials = [
      new THREE.MeshStandardMaterial({ color: 0x65c8c8, roughness: 0.48, metalness: 0.04 }),
      new THREE.MeshStandardMaterial({ color: 0xe7b75c, roughness: 0.52 }),
      new THREE.MeshStandardMaterial({ color: 0x8b9ee8, roughness: 0.5 }),
      new THREE.MeshStandardMaterial({ color: 0xb6d58b, roughness: 0.56 }),
    ];
    this.bodyGeometry = new THREE.SphereGeometry(1, 12, 8);
    this.tailGeometry = new THREE.ConeGeometry(0.42, 0.8, 3);
    this.eyeGeometry = new THREE.SphereGeometry(0.075, 6, 5);
    this.populate(this.params.population);
  }

  random() {
    // Small deterministic PRNG: reproducible populations from a saved seed.
    let x = this.randomState | 0;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.randomState = x | 0;
    return (x >>> 0) / 4294967296;
  }

  makeFish(index) {
    const T = this.THREE;
    const genes = Object.freeze({
      speed: 2.1 + this.random() * 2.6,
      size: 0.65 + this.random() * 0.8,
      cohesion: 0.25 + this.random() * 0.8,
      alignment: 0.25 + this.random() * 0.9,
      separation: 0.7 + this.random() * 1.1,
      sensoryRange: 12 + this.random() * 14,
      metabolism: 0.7 + this.random() * 0.7,
      camouflage: this.random(),
    });
    const root = new T.Group();
    const material = this.materials[Math.floor(this.random() * this.materials.length)];
    const body = new T.Mesh(this.bodyGeometry, material);
    body.scale.set(0.9 * genes.size, 0.42 * genes.size, 0.28 * genes.size);
    body.castShadow = false;
    body.receiveShadow = false;
    root.add(body);
    const tail = new T.Mesh(this.tailGeometry, material);
    tail.rotation.z = Math.PI / 2;
    tail.position.x = -0.82 * genes.size;
    tail.scale.set(0.7 * genes.size, 0.58 * genes.size, 0.22 * genes.size);
    root.add(tail);
    const eyeMaterial = new T.MeshBasicMaterial({ color: 0x07151b });
    for (const side of [-1, 1]) {
      const eye = new T.Mesh(this.eyeGeometry, eyeMaterial);
      eye.position.set(0.38 * genes.size, 0.12 * genes.size, side * 0.245 * genes.size);
      root.add(eye);
    }
    root.position.set(
      (this.random() - 0.5) * this.params.worldRadius * 1.4,
      -(this.params.minDepth + this.random() * (this.params.maxDepth - this.params.minDepth)),
      (this.random() - 0.5) * this.params.worldRadius * 1.4,
    );
    this.group.add(root);
    const heading = new T.Vector3(this.random() - 0.5, (this.random() - 0.5) * 0.2, this.random() - 0.5).normalize();
    return {
      id: index, root, tail, genes, heading,
      velocity: heading.clone().multiplyScalar(genes.speed * 0.55),
      energy: 0.7 + this.random() * 0.3,
      age: 0,
      phase: this.random() * Math.PI * 2,
    };
  }

  populate(count) {
    const target = Math.max(0, Math.min(500, Math.round(count)));
    while (this.fish.length < target) this.fish.push(this.makeFish(this.fish.length));
    while (this.fish.length > target) {
      const fish = this.fish.pop();
      this.group.remove(fish.root);
      fish.root.traverse(node => { if (node.isMesh) node.geometry = node.geometry; });
    }
    this.params.population = target;
  }

  buildSpatialIndex() {
    const cell = this.params.neighbourRadius;
    const bins = new Map();
    for (const fish of this.fish) {
      const p = fish.root.position;
      const key = `${Math.floor(p.x / cell)},${Math.floor(p.y / cell)},${Math.floor(p.z / cell)}`;
      let bin = bins.get(key);
      if (!bin) bins.set(key, bin = []);
      bin.push(fish);
    }
    return { bins, cell };
  }

  update(dt, elapsed = 0, waterHeight = 0) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const T = this.THREE;
    const { bins, cell } = this.buildSpatialIndex();
    const radius2 = this.params.neighbourRadius ** 2;
    const separation2 = this.params.separationRadius ** 2;
    const maxStep = Math.min(dt, 1 / 20);
    const next = [];
    for (const fish of this.fish) {
      const p = fish.root.position;
      const cx = Math.floor(p.x / cell), cy = Math.floor(p.y / cell), cz = Math.floor(p.z / cell);
      const cohesion = new T.Vector3(), alignment = new T.Vector3(), separation = new T.Vector3();
      let neighbours = 0;
      for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
        const bin = bins.get(`${cx + x},${cy + y},${cz + z}`);
        if (!bin) continue;
        for (const other of bin) {
          if (other === fish) continue;
          const delta = other.root.position.clone().sub(p);
          const d2 = delta.lengthSq();
          if (d2 > radius2 || d2 < 1e-8) continue;
          neighbours++;
          cohesion.add(other.root.position);
          alignment.add(other.velocity);
          if (d2 < separation2) separation.addScaledVector(delta, -1 / d2);
        }
      }
      const steer = new T.Vector3();
      if (neighbours) {
        cohesion.multiplyScalar(1 / neighbours).sub(p).normalize().multiplyScalar(fish.genes.cohesion);
        alignment.multiplyScalar(1 / neighbours).normalize().multiplyScalar(fish.genes.alignment);
        steer.add(cohesion).add(alignment).addScaledVector(separation, fish.genes.separation);
      }
      // Soft habitat bounds and depth preference keep agents in the water column.
      const radial = Math.hypot(p.x, p.z);
      if (radial > this.params.worldRadius) steer.add(new T.Vector3(-p.x, 0, -p.z).normalize().multiplyScalar(1.8));
      if (p.y > waterHeight - this.params.minDepth) steer.y -= 1.2;
      if (p.y < waterHeight - this.params.maxDepth) steer.y += 1.2;
      steer.y += Math.sin(elapsed * 0.35 + fish.phase) * 0.08;
      if (steer.lengthSq() > 1e-8) fish.velocity.addScaledVector(steer.normalize(), this.params.maxAcceleration * maxStep);
      const speed = fish.velocity.length();
      const targetSpeed = fish.genes.speed * (0.65 + fish.energy * 0.35);
      if (speed > 1e-6) fish.velocity.multiplyScalar(T.MathUtils.damp(speed, targetSpeed, 1.8, maxStep) / speed);
      p.addScaledVector(fish.velocity, maxStep);
      fish.age += maxStep;
      fish.energy = Math.max(0.05, fish.energy - fish.genes.metabolism * maxStep * 0.0007);
      fish.heading.copy(fish.velocity).normalize();
      if (fish.heading.lengthSq() > 1e-8) {
        const forward = new T.Vector3(1, 0, 0);
        fish.root.quaternion.setFromUnitVectors(forward, fish.heading);
      }
      fish.tail.rotation.y = Math.sin(elapsed * (5 + fish.genes.speed) + fish.phase) * 0.55;
      next.push(fish);
    }
    this.fish = next;
  }

  getStats() {
    const n = this.fish.length;
    if (!n) return { population: 0, meanSpeed: 0, meanSize: 0, meanEnergy: 0 };
    const totals = this.fish.reduce((out, f) => {
      out.meanSpeed += f.genes.speed;
      out.meanSize += f.genes.size;
      out.meanEnergy += f.energy;
      return out;
    }, { population: n, meanSpeed: 0, meanSize: 0, meanEnergy: 0 });
    totals.meanSpeed /= n;
    totals.meanSize /= n;
    totals.meanEnergy /= n;
    return totals;
  }
}
