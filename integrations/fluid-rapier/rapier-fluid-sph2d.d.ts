export interface SphBoundaryState {
  count: number;
  positions: Float32Array;
  velocities: Float32Array;
  densities: Float32Array;
}

export interface SphBoundaryConfig {
  smoothingRadius: number;
  obstacleSize: { x: number; y: number };
  targetDensity: number;
  pressureMultiplier: number;
}

export interface SphBoundaryLoadOptions {
  state: SphBoundaryState;
  config: SphBoundaryConfig;
  bodyPosition: { x: number; y: number };
  bodyVelocity?: { x: number; y: number };
  pressureScale?: number;
  dragScale?: number;
  maxForce?: number;
  fluidDensity?: number;
  gravity?: number;
  buoyancyScale?: number;
}

export interface SphBoundaryLoadResult {
  force: { x: number; y: number };
  pressureForce: { x: number; y: number };
  buoyancyForce: { x: number; y: number };
  dragForce: { x: number; y: number };
  contactParticles: number;
  submergedFraction: number;
}

export function estimateSphBoundaryLoad(options: SphBoundaryLoadOptions): SphBoundaryLoadResult;
