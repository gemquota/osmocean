export interface OceanBoundarySample {
  count: number;
  time: number;
  points: Array<{ x: number; z: number }>;
  data: Float32Array;
}

export interface OceanBoundaryState {
  count: number;
  positions: Float32Array;
  velocities: Float32Array;
}

export function applyOceanSurfaceBoundary(options: {
  state: OceanBoundaryState;
  config: { smoothingRadius: number };
  sample: OceanBoundarySample;
  previousSample?: OceanBoundarySample | null;
  baseSurfaceY: number;
  heightScale?: number;
  blend?: number;
  spring?: number;
  maxVelocityDelta?: number;
}): {
  appliedParticles: number;
  meanWaveHeight: number;
  maxWaveHeight: number;
  meanWaveVelocity: number;
  sampleTime: number;
};
