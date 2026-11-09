import { createSim } from './sph/canvas2d/sim.ts';
import { estimateSphBoundaryLoad } from './rapier-fluid-sph2d.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const FIXED_DT = 1 / 120;

/**
 * Couples the pinned SPH solver to the exact Rapier 3D world used by ocean
 * floaters. The callback runs inside RapierFloaters' fixed-step loop, before
 * its single world.step(). SPH particles and rigid bodies render in the
 * existing Ultra-Water Three.js scene and renderer.
 */
export function createUnifiedCoupling({ THREE, scene, RAPIER, floaters, controls }) {
  if (!THREE || !scene || !RAPIER || !floaters?.world || !floaters?.addCoupledStep) {
    throw new TypeError('Three.js scene, Rapier and shared floater world are required');
  }

  const hiddenCanvas = document.createElement('canvas');
  hiddenCanvas.width = 800;
  hiddenCanvas.height = 450;
  hiddenCanvas.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;height:450px;pointer-events:none';
  document.body.appendChild(hiddenCanvas);

  const sph = createSim(hiddenCanvas);
  sph.config.timeScale = 1;
  sph.config.maxTimestepFPS = 120;
  sph.config.iterationsPerFrame = 1;
  sph.config.boundsSize = { x: 16, y: 9 };
  sph.config.obstacleSize = { x: 1.8, y: 0.65 };
  sph.config.obstacleCentre = { x: 0, y: -0.55 };

  // This body belongs to the same Rapier 3D world and fixed-step schedule as
  // the ocean floaters. Its Z thickness is finite; SPH remains a 2D slice.
  const origin = { x: controls?.target?.x ?? 0, y: 0, z: controls?.target?.z ?? 0 };
  const start = { x: origin.x, y: -0.55, z: origin.z };
  const body = floaters.world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(start.x, start.y, start.z)
      .lockRotations()
      .setLinearDamping(0.12)
  );
  floaters.world.createCollider(
    RAPIER.ColliderDesc.cuboid(0.9, 0.325, 0.25)
      .setDensity(0.65).setFriction(0.8).setRestitution(0.02),
    body
  );

  const particleCount = sph.state.count;
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setDrawRange(0, particleCount);
  const material = new THREE.PointsMaterial({
    size: 0.105, vertexColors: true, transparent: true, opacity: 0.92, sizeAttenuation: true
  });
  const particles = new THREE.Points(geometry, material);
  particles.frustumCulled = false;
  particles.position.z = 0.25;
  scene.add(particles);

  const bodyMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.65, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xe7b86b, roughness: 0.42, metalness: 0.08 })
  );
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  scene.add(bodyMesh);

  let simulationTime = 0;
  let oceanParams = null;
  let paused = false;
  let fixedSteps = 0;
  let waveEnergy = 0;
  let lastForce = { x: 0, y: 0 };
  const PRESSURE_SCALE = 0.0005;
  const DRAG_SCALE = 0.025;
  const MAX_FORCE = 80;

  function applyWaveBoundary(time) {
    // Wave forcing follows the live FFT ocean wind/wave controls. This is an
    // explicit reduced-order boundary model, not a claim of exact FFT sampling.
    const windSpeed = clamp(oceanParams?.windSpeed ?? 8, 1, 25);
    const windDirection = (oceanParams?.windDirection ?? 0) * Math.PI / 180;
    const waveScale = clamp(oceanParams?.waveScale ?? 1, 0, 3);
    const amplitude = 0.018 * waveScale * Math.sqrt(windSpeed);
    const wavelength = clamp(2.5 + windSpeed * 0.22, 2.5, 8);
    const k = (Math.PI * 2) / wavelength;
    const omega = Math.sqrt(9.81 * k);
    const directionX = Math.cos(windDirection);
    const directionZ = Math.sin(windDirection);
    const pos = sph.state.positions;
    const vel = sph.state.velocities;
    let energy = 0;
    for (let i = 0; i < sph.state.count; i++) {
      const j = i * 2;
      const x = pos[j], y = pos[j + 1];
      if (y < 2.7) continue;
      const phase = k * (x * directionX) - omega * time;
      const targetVy = amplitude * omega * Math.cos(phase);
      const targetVx = amplitude * omega * directionZ * Math.sin(phase);
      const blend = clamp((y - 2.7) / 1.2, 0, 1) * 0.035;
      vel[j] += (targetVx - vel[j]) * blend;
      vel[j + 1] += (targetVy - vel[j + 1]) * blend;
      energy += Math.abs(targetVy);
    }
    waveEnergy = energy / Math.max(1, sph.state.count);
  }

  function coupledFixedStep(dt, time) {
    if (paused) return;
    const p = body.translation();
    sph.config.obstacleCentre = { x: p.x - origin.x, y: p.y - origin.y };
    applyWaveBoundary(time);
    sph.step(dt);

    const velocity = body.linvel();
    const load = estimateSphBoundaryLoad({
      state: sph.state,
      config: sph.config,
      bodyPosition: { x: p.x, y: p.y },
      bodyVelocity: { x: velocity.x, y: velocity.y },
      pressureScale: PRESSURE_SCALE,
      dragScale: DRAG_SCALE,
      maxForce: MAX_FORCE
    });
    lastForce = load.force;
    body.addForce({ x: load.force.x, y: load.force.y, z: 0 }, true);
    fixedSteps++;
  }

  const removeCoupledStep = floaters.addCoupledStep(coupledFixedStep);

  function reset() {
    body.setTranslation(start, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    sph.reset();
  }

  function updateVisuals() {
    const pos = sph.state.positions;
    const vel = sph.state.velocities;
    const n = Math.min(sph.state.count, particleCount);
    for (let i = 0; i < n; i++) {
      const j = i * 2, k = i * 3;
      positions[k] = origin.x + pos[j];
      positions[k + 1] = origin.y + pos[j + 1];
      positions[k + 2] = origin.z;
      const speed = Math.hypot(vel[j], vel[j + 1]);
      const t = clamp(speed / 8, 0, 1);
      colors[k] = 0.12 + 0.82 * t;
      colors[k + 1] = 0.72 - 0.28 * t;
      colors[k + 2] = 0.95 - 0.58 * t;
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    const p = body.translation();
    const q = body.rotation();
    bodyMesh.position.set(p.x, p.y, p.z);
    bodyMesh.quaternion.set(q.x, q.y, q.z, q.w);
    const v = body.linvel();
    const status = document.getElementById('osmocean-unified-status');
    if (status) status.textContent = `ONE WORLD · SPH ${n.toLocaleString()} · RAPIER 3D · ${paused ? 'PAUSED' : 'LIVE'} · BODY ${Math.hypot(v.x, v.y, v.z).toFixed(2)} m/s`;
  }

  function step(_frameDt, time, params) {
    simulationTime = time;
    oceanParams = params;
    updateVisuals();
  }

  const hud = document.createElement('div');
  hud.id = 'osmocean-unified-hud';
  hud.innerHTML = '<strong>OSMOCEAN / ONE WORLD</strong><span id="osmocean-unified-status">INITIALISING COUPLED SOLVERS</span><button id="osmocean-unified-pause" type="button">PAUSE</button><button id="osmocean-unified-reset" type="button">RESET BODY</button>';
  hud.style.cssText = 'position:fixed;z-index:10000;left:12px;bottom:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 12px;background:#04131ddd;border:1px solid #7bdac455;color:#dff8f1;font:10px/1.3 ui-monospace,monospace;letter-spacing:.04em;border-radius:5px;max-width:calc(100vw - 24px)';
  hud.querySelectorAll('button').forEach(button => {
    button.style.cssText = 'border:1px solid #527d7d;background:#0b2931;color:#b9f5e1;padding:7px 9px;border-radius:3px;font:inherit';
  });
  document.body.appendChild(hud);
  hud.querySelector('#osmocean-unified-pause').addEventListener('click', event => {
    paused = !paused;
    floaters.paused = paused;
    event.currentTarget.textContent = paused ? 'RESUME' : 'PAUSE';
  });
  hud.querySelector('#osmocean-unified-reset').addEventListener('click', reset);

  window.__osmoceanUnified = {
    engines: ['Ultra-Water FFT ocean', 'jeantimex/fluid SPH', 'Rapier 3D shared world'],
    getDiagnostics: () => ({ fixedSteps, particles: sph.state.count, waveEnergy, bodyForce: lastForce, paused, time: simulationTime }),
    pause: () => { paused = true; floaters.paused = true; },
    resume: () => { paused = false; floaters.paused = false; },
    reset
  };
  updateVisuals();
  return {
    step,
    reset,
    dispose() {
      removeCoupledStep();
      floaters.world.removeRigidBody(body);
      scene.remove(particles, bodyMesh);
      geometry.dispose();
      material.dispose();
      bodyMesh.geometry.dispose();
      bodyMesh.material.dispose();
      hiddenCanvas.remove();
      hud.remove();
    }
  };
}
