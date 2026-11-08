const finite = Number.isFinite;

/**
 * Build a Rapier 3D heightfield matrix from a world-space height function.
 * Rapier's nrows/ncols are subdivision counts; the matrix therefore has
 * (nrows + 1) * (ncols + 1) samples stored column-major.
 */
export function createHeightfieldGrid({
  heightAt,
  sampleRows = 257,
  sampleCols = 257,
  span = 2400,
  verticalScale = 160,
}) {
  if (typeof heightAt !== "function") throw new TypeError("heightAt must be a function");
  if (!Number.isInteger(sampleRows) || sampleRows < 2) throw new RangeError("sampleRows must be an integer >= 2");
  if (!Number.isInteger(sampleCols) || sampleCols < 2) throw new RangeError("sampleCols must be an integer >= 2");
  if (!finite(span) || span <= 0) throw new RangeError("span must be finite and positive");
  if (!finite(verticalScale) || verticalScale <= 0) throw new RangeError("verticalScale must be finite and positive");

  const heights = new Float32Array(sampleRows * sampleCols);
  for (let col = 0; col < sampleCols; col++) {
    const x = (col / (sampleCols - 1) - 0.5) * span;
    for (let row = 0; row < sampleRows; row++) {
      const z = (row / (sampleRows - 1) - 0.5) * span;
      const height = heightAt(x, z);
      if (!finite(height)) throw new TypeError(`heightAt returned a non-finite value at sample (${row}, ${col})`);
      heights[col * sampleRows + row] = height / verticalScale;
    }
  }

  return Object.freeze({
    nrows: sampleRows - 1,
    ncols: sampleCols - 1,
    sampleRows,
    sampleCols,
    heights,
    scale: Object.freeze({ x: span, y: verticalScale, z: span }),
  });
}
