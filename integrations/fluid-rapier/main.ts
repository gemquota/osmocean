import * as RAPIER from '@dimforge/rapier2d-compat';
import { createSim } from '../sph/2d/canvas2d/sim.ts';
import { estimateSphBoundaryLoad } from '../../adapters/rapier-fluid-sph2d.js';

const FIXED_DT = 1 / 120;
const MAX_STEPS = 6;
const canvas = document.querySelector<HTMLCanvasElement>('#sim-canvas')!;
const stateLabel = document.querySelector<HTMLElement>('#engine-state')!;
const forceLabel = document.querySelector<HTMLElement>('#force-state')!;
const pauseButton = document.querySelector<HTMLButtonElement>('#pause')!;
const resetButton = document.querySelector<HTMLButtonElement>('#reset')!;

await RAPIER.init();
const sim = createSim(canvas);
sim.config.timeScale = 1;
sim.config.maxTimestepFPS = 120;
sim.config.iterationsPerFrame = 1;
sim.config.obstacleSize = { x: 1.8, y: 0.65 };

const world = new RAPIER.World({ x: 0, y: -sim.config.gravity });
world.timestep = FIXED_DT;

const floor = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -4.55));
world.createCollider(RAPIER.ColliderDesc.cuboid(8.55, 0.1), floor);
for (const x of [-8.55, 8.55]) {
  const wall = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.1, 4.65), wall);
}

const start = { x: 0, y: -0.75 };
const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
  .setTranslation(start.x, start.y)
  .lockRotations()
  .setLinearDamping(0.12);
const body = world.createRigidBody(bodyDesc);
world.createCollider(
  RAPIER.ColliderDesc.cuboid(sim.config.obstacleSize.x * 0.5, sim.config.obstacleSize.y * 0.5)
    .setDensity(1.4).setFriction(0.8).setRestitution(0.02),
  body,
);

let paused = false;
let accumulator = 0;
let last = performance.now();
let lastForce = { x: 0, y: 0 };
const PRESSURE_SCALE = 0.0005;
const DRAG_SCALE = 0.025;
const MAX_FORCE = 80;

function resetBody() {
  body.setTranslation(start, true);
  body.setLinvel({ x: 0, y: 0 }, true);
  body.setAngvel(0, true);
}

pauseButton.addEventListener('click', () => {
  paused = !paused;
  pauseButton.textContent = paused ? 'RESUME' : 'PAUSE';
});

resetButton.addEventListener('click', resetBody);

function fixedStep() {
  const position = body.translation();
  sim.config.obstacleCentre = { x: position.x, y: position.y };

  // Upstream SPH owns particle integration and resolves its AABB obstacle
  // collision against the Rapier body's latest pose.
  sim.step(FIXED_DT);

  const result = estimateSphBoundaryLoad({
    state: sim.state,
    config: sim.config,
    bodyPosition: position,
    bodyVelocity: body.linvel(),
    pressureScale: PRESSURE_SCALE,
    dragScale: DRAG_SCALE,
    maxForce: MAX_FORCE,
  });
  lastForce = result.force;
  body.addForce(result.force, true);
  world.step();
}

function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!paused) {
    accumulator = Math.min(accumulator + dt, FIXED_DT * MAX_STEPS);
    let steps = 0;
    while (accumulator >= FIXED_DT && steps < MAX_STEPS) {
      fixedStep();
      accumulator -= FIXED_DT;
      steps++;
    }
  }
  const p = body.translation();
  sim.config.obstacleCentre = { x: p.x, y: p.y };
  sim.draw();
  stateLabel.textContent = `RAPIER 2D · ${sim.state.count.toLocaleString()} SPH PARTICLES · ${paused ? 'PAUSED' : 'RUNNING'}`;
  forceLabel.textContent = `BOUNDARY LOAD: ${Math.hypot(lastForce.x, lastForce.y).toFixed(2)} N (SCALED)`;
  requestAnimationFrame(frame);
}
stateLabel.textContent = 'RAPIER 2D · INITIALISED';
requestAnimationFrame(frame);
