import * as RAPIER from '@dimforge/rapier2d-compat';
import { createSim } from './sph/canvas2d/sim.ts';
import { estimateSphBoundaryLoad } from './rapier-fluid-sph2d.js';

const FIXED_DT = 1 / 120;
const MAX_STEPS = 6;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * One Three.js scene, one render loop, one fixed-step coordinator.
 * Ultra-Water remains the far-field surface renderer; the pinned SPH solver
 * owns near-field particle state; Rapier owns the rigid body's state.
 * SPH is rendered as Three.js points into the same scene, never a second canvas.
 */
export async function createUnifiedCoupling({ THREE, scene }) {
  await RAPIER.init();

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

  const world = new RAPIER.World({ x: 0, y: -sph.config.gravity });
  world.timestep = FIXED_DT;
  const floor = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -4.35));
  world.createCollider(RAPIER.ColliderDesc.cuboid(8.1, 0.12), floor);
  for (const x of [-8.1, 8.1]) {
    const wall = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, 0));
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.12, 4.5), wall);
  }

  const start = { x: 0, y: -0.55 };
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(start.x, start.y).lockRotations().setLinearDamping(0.12)
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(0.9, 0.325).setDensity(0.65).setFriction(0.8).setRestitution(0.02),
    body
  );

  const count = sph.state.count;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setDrawRange(0, count);
  const material = new THREE.PointsMaterial({ size: 0.105, vertexColors: true, transparent: true, opacity: 0.92, sizeAttenuation: true });
  const particles = new THREE.Points(geometry, material);
  particles.frustumCulled = false;
  particles.position.set(0, 0, 0.25);
  scene.add(particles);

  const bodyMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.65, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xe7b86b, roughness: 0.42, metalness: 0.08 })
  );
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyMesh.position.set(start.x, start.y, 0.3);
  scene.add(bodyMesh);

  let accumulator = 0;
  let paused = false;
  let lastForce = { x: 0, y: 0 };
  let steps = 0;
  let waveEnergy = 0;
  const PRESSURE_SCALE = 0.0005;
  const DRAG_SCALE = 0.025;
  const MAX_FORCE = 80;

  function reset() {
    body.setTranslation(start, true);
    body.setLinvel({ x: 0, y: 0 }, true);
    body.setAngvel(0, true);
    sph.reset();
    accumulator = 0;
  }

  function applyWaveBoundary(time, oceanParams) {
    const windSpeed = clamp(oceanParams?.windSpeed ?? 8, 1, 25);
    const windDirection = (oceanParams?.windDirection ?? 0) * Math.PI / 180;
    const waveScale = clamp(oceanParams?.waveScale ?? 1, 0, 3);
    const amplitude = 0.018 * waveScale * Math.sqrt(windSpeed);
    const wavelength = clamp(2.5 + windSpeed * 0.22, 2.5, 8);
    const k = (Math.PI * 2) / wavelength;
    const omega = Math.sqrt(9.81 * k);
    const phaseSpeedX = Math.cos(windDirection);
    const phaseSpeedZ = Math.sin(windDirection);
    const pos = sph.state.positions;
    const vel = sph.state.velocities;
    let energy = 0;
    for (let i = 0; i < sph.state.count; i++) {
      const j = i * 2;
      const x = pos[j], y = pos[j + 1];
      if (y < 2.7) continue;
      const phase = k * (x * phaseSpeedX) - omega * time;
      const targetVy = amplitude * omega * Math.cos(phase);
      const targetVx = amplitude * omega * phaseSpeedZ * Math.sin(phase);
      const blend = clamp((y - 2.7) / 1.2, 0, 1) * 0.035;
      vel[j] += (targetVx - vel[j]) * blend;
      vel[j + 1] += (targetVy - vel[j + 1]) * blend;
      energy += Math.abs(targetVy);
    }
    waveEnergy = energy / Math.max(1, sph.state.count);
  }

  function fixedStep(time, oceanParams) {
    applyWaveBoundary(time, oceanParams);
    const p = body.translation();
    sph.config.obstacleCentre = { x: p.x, y: p.y };
    sph.step(FIXED_DT);

    const load = estimateSphBoundaryLoad({
      state: sph.state,
      config: sph.config,
      bodyPosition: p,
      bodyVelocity: body.linvel(),
      pressureScale: PRESSURE_SCALE,
      dragScale: DRAG_SCALE,
      maxForce: MAX_FORCE
    });
    lastForce = load.force;
    body.addForce(load.force, true);
    world.step();
    steps++;
  }

  function updateVisuals() {
    const pos = sph.state.positions;
    const vel = sph.state.velocities;
    const n = Math.min(sph.state.count, count);
    for (let i = 0; i < n; i++) {
      const j = i * 2, k = i * 3;
      positions[k] = pos[j];
      positions[k + 1] = pos[j + 1];
      positions[k + 2] = 0;
      const speed = Math.hypot(vel[j], vel[j + 1]);
      const t = clamp(speed / 8, 0, 1);
      colors[k] = 0.12 + 0.82 * t;
      colors[k + 1] = 0.72 - 0.28 * t;
      colors[k + 2] = 0.95 - 0.58 * t;
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    const p = body.translation();
    bodyMesh.position.set(p.x, p.y, 0.3);
    const v = body.linvel();
    const tilt = window.osmoceanTilt;
    if (tilt?.enabled) {
      const gx = clamp(tilt.x || 0, -6.5, 6.5);
      const gy = clamp(tilt.y || 0, -6.5, 6.5);
      world.gravity = { x: gx, y: -sph.config.gravity + gy };
    } else {
      world.gravity = { x: 0, y: -sph.config.gravity };
    }
    const status = document.getElementById('osmocean-unified-status');
    if (status) status.textContent = `UNIFIED · SPH ${n.toLocaleString()} · RAPIER 2D · ${paused ? 'PAUSED' : 'LIVE'} · BODY ${Math.hypot(v.x, v.y).toFixed(2)} m/s`;
  }

  function step(frameDt, time, oceanParams) {
    if (!paused) {
      accumulator = Math.min(accumulator + Math.min(frameDt, 0.05), FIXED_DT * MAX_STEPS);
      let countThisFrame = 0;
      while (accumulator >= FIXED_DT && countThisFrame < MAX_STEPS) {
        fixedStep(time, oceanParams);
        accumulator -= FIXED_DT;
        countThisFrame++;
      }
    }
    updateVisuals();
  }

  const hud = document.createElement('div');
  hud.id = 'osmocean-unified-hud';
  hud.innerHTML = '<strong>OSMOCEAN / UNIFIED WORLD</strong><span id="osmocean-unified-status">INITIALISING COUPLED SOLVERS</span><button id="osmocean-unified-pause" type="button">PAUSE</button><button id="osmocean-unified-reset" type="button">RESET BODY</button>';
  hud.style.cssText = 'position:fixed;z-index:10000;left:12px;bottom:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 12px;background:#04131ddd;border:1px solid #7bdac455;color:#dff8f1;font:10px/1.3 ui-monospace,monospace;letter-spacing:.04em;border-radius:5px;max-width:calc(100vw - 24px)';
  hud.querySelectorAll('button').forEach(button => {
    button.style.cssText = 'border:1px solid #527d7d;background:#0b2931;color:#b9f5e1;padding:7px 9px;border-radius:3px;font:inherit';
  });
  document.body.appendChild(hud);
  hud.querySelector('#osmocean-unified-pause').addEventListener('click', event => {
    paused = !paused;
    event.currentTarget.textContent = paused ? 'RESUME' : 'PAUSE';
  });
  hud.querySelector('#osmocean-unified-reset').addEventListener('click', reset);

  window.__osmoceanUnified = {
    engines: ['Ultra-Water FFT ocean', 'jeantimex/fluid SPH', 'Rapier 2D'],
    getDiagnostics: () => ({ steps, particles: sph.state.count, waveEnergy, bodyForce: lastForce, paused }),
    pause: () => { paused = true; },
    resume: () => { paused = false; },
    reset
  };
  updateVisuals();
  return { step, reset, dispose() { scene.remove(particles, bodyMesh); geometry.dispose(); material.dispose(); hiddenCanvas.remove(); hud.remove(); } };
}
