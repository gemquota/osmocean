import * as RAPIER from '@dimforge/rapier2d-compat';
import { createSim } from '../sph/2d/canvas2d/sim.ts';
import { estimateSphBoundaryLoad } from './rapier-fluid-sph2d.js';
import { applyOceanSurfaceBoundary } from './fluid-ocean-boundary.js';

type Probe = { x: number; z: number };
type OceanSample = { count: number; time: number; points: Probe[]; data: Float32Array };
type OceanWindow = Window & {
  osmoceanOceanProbes?: Probe[];
  osmoceanOceanProbeResults?: OceanSample;
};

const FIXED_DT = 1 / 120;
const MAX_STEPS = 6;
const PROBE_COUNT = 25;
const canvas = document.querySelector<HTMLCanvasElement>('#sim-canvas')!;
const stateLabel = document.querySelector<HTMLElement>('#engine-state')!;
const forceLabel = document.querySelector<HTMLElement>('#force-state')!;
const oceanLabel = document.querySelector<HTMLElement>('#ocean-state')!;
const pauseButton = document.querySelector<HTMLButtonElement>('#pause')!;
const resetButton = document.querySelector<HTMLButtonElement>('#reset')!;
const oceanFrame = document.querySelector<HTMLIFrameElement>('#ocean-frame');
const rapierEnabled = new URLSearchParams(location.search).get('rapier') !== '0';

await RAPIER.init();
const sim = createSim(canvas);
sim.config.timeScale = 1;
sim.config.maxTimestepFPS = 120;
sim.config.iterationsPerFrame = 1;
sim.config.obstacleSize = rapierEnabled ? { x: 1.8, y: 0.65 } : { x: 0, y: 0 };

const world = new RAPIER.World({ x: 0, y: -sim.config.gravity });
world.timestep = FIXED_DT;

const floor = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -4.55));
world.createCollider(RAPIER.ColliderDesc.cuboid(8.55, 0.1), floor);
for (const x of [-8.55, 8.55]) {
  const wall = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.1, 4.65), wall);
}

const start = { x: 0, y: -0.75 };
let body: RAPIER.RigidBody | null = null;
if (rapierEnabled) {
  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(start.x, start.y)
    .lockRotations()
    .setLinearDamping(0.12);
  body = world.createRigidBody(bodyDesc);
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(sim.config.obstacleSize.x * 0.5, sim.config.obstacleSize.y * 0.5)
      .setDensity(0.65).setFriction(0.8).setRestitution(0.02),
    body,
  );
} else {
  resetButton.hidden = true;
}

const oceanProbes: Probe[] = Array.from({ length: PROBE_COUNT }, (_, i) => ({
  x: -8 + (16 * i) / (PROBE_COUNT - 1),
  z: 0,
}));
let previousOceanSample: OceanSample | null = null;
let lastOceanSampleTime = -1;
let oceanConnected = false;
let oceanBoundaryStats = { appliedParticles: 0, maxWaveHeight: 0 };

function connectOcean() {
  if (!oceanFrame?.contentWindow) return;
  try {
    (oceanFrame.contentWindow as OceanWindow).osmoceanOceanProbes = oceanProbes;
    oceanConnected = true;
  } catch {
    oceanConnected = false;
  }
}
if (oceanFrame) {
  oceanFrame.addEventListener('load', connectOcean);
  connectOcean();
}

let paused = false;
let accumulator = 0;
let last = performance.now();
let lastForce = { x: 0, y: 0 };
const PRESSURE_SCALE = 0.0005;
const DRAG_SCALE = 0.025;
const MAX_FORCE = 80;

function resetBody() {
  if (!body) return;
  body.setTranslation(start, true);
  body.setLinvel({ x: 0, y: 0 }, true);
  body.setAngvel(0, true);
}

pauseButton.addEventListener('click', () => {
  paused = !paused;
  pauseButton.textContent = paused ? 'RESUME' : 'PAUSE';
});
resetButton.addEventListener('click', resetBody);

function ingestOceanBoundary() {
  if (!oceanFrame?.contentWindow) return;
  const sample = (oceanFrame.contentWindow as OceanWindow).osmoceanOceanProbeResults;
  if (!sample || sample.time <= lastOceanSampleTime) return;
  const spawn = sim.config.spawnRegions[0];
  const baseSurfaceY = spawn.position.y + spawn.size.y * 0.5;
  oceanBoundaryStats = applyOceanSurfaceBoundary({
    state: sim.state,
    config: sim.config,
    sample,
    previousSample: previousOceanSample,
    baseSurfaceY,
    heightScale: 0.65,
    blend: 0.12,
    spring: 2.4,
    maxVelocityDelta: 2.5,
  });
  previousOceanSample = sample;
  lastOceanSampleTime = sample.time;
}

function fixedStep() {
  if (body) {
    const position = body.translation();
    sim.config.obstacleCentre = { x: position.x, y: position.y };
  }
  ingestOceanBoundary();
  sim.step(FIXED_DT);

  if (body) {
    const result = estimateSphBoundaryLoad({
      state: sim.state,
      config: sim.config,
      bodyPosition: body.translation(),
      bodyVelocity: body.linvel(),
      pressureScale: PRESSURE_SCALE,
      dragScale: DRAG_SCALE,
      maxForce: MAX_FORCE,
    });
    lastForce = result.force;
    body.addForce(result.force, true);
    world.step();
  }
}

function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!oceanConnected) connectOcean();
  if (!paused) {
    accumulator = Math.min(accumulator + dt, FIXED_DT * MAX_STEPS);
    let steps = 0;
    while (accumulator >= FIXED_DT && steps < MAX_STEPS) {
      fixedStep();
      accumulator -= FIXED_DT;
      steps++;
    }
  }
  if (body) {
    const p = body.translation();
    sim.config.obstacleCentre = { x: p.x, y: p.y };
  }
  sim.draw();
  const engines = rapierEnabled ? 'SPH + RAPIER 2D' : 'SPH';
  stateLabel.textContent = `${engines} · ${sim.state.count.toLocaleString()} PARTICLES · ${paused ? 'PAUSED' : 'RUNNING'}`;
  forceLabel.textContent = rapierEnabled
    ? `BODY LOAD: ${Math.hypot(lastForce.x, lastForce.y).toFixed(2)} (SCALED 2D)`
    : 'RAPIER BODY DISABLED';
  oceanLabel.textContent = oceanConnected
    ? `OCEAN QUERY ${lastOceanSampleTime >= 0 ? 'LIVE' : 'WAITING'} · ${oceanBoundaryStats.appliedParticles} SURFACE PARTICLES FORCED · WAVE ${oceanBoundaryStats.maxWaveHeight.toFixed(3)}`
    : 'WAITING FOR SAME-ORIGIN OCEAN FRAME';
  requestAnimationFrame(frame);
}
stateLabel.textContent = 'INITIALISING COUPLED SOLVERS';
requestAnimationFrame(frame);
