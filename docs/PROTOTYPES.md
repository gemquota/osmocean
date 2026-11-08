# Prototype Register

Prototypes are deliberately isolated from production architecture until their contracts, assumptions, and performance have been reviewed.

## P-001 — Relative-water quadratic drag

- **Status:** Implemented; unit tests added.
- **Location:** `src/physics/drag.js`
- **Purpose:** establish the invariant that drag depends on body velocity relative to local water velocity.
- **Model:** lumped quadratic drag using supplied density, coefficient, and effective reference area.
- **Assumptions:** constant local sample over the evaluated body; user-supplied effective area and coefficient; no distributed body integration, lift, added mass, turbulence, or free-surface effects.
- **Acceptance:** zero relative velocity gives zero force; force opposes relative motion; doubling speed quadruples force magnitude; co-moving water removes drag.
- **Limitations:** this is a reference force function, not a complete creature model or calibrated hydrodynamics solver.

## P-002 — Uniform water-field contract

- **Status:** Implemented; unit tests added.
- **Location:** `src/environment/water-field.js`
- **Purpose:** define the initial sampling shape for a time- and position-addressed water environment.
- **Current implementation:** uniform, time-independent velocity and density.
- **Acceptance:** stable sample shape, explicit validity, finite input checks, and no mutable leakage of field configuration.
- **Limitations:** no spatial interpolation, time evolution, boundaries, turbulence, or environmental coupling.

## Promotion rule

A prototype is not production-ready merely because its tests pass. Promotion requires an architecture review, integration tests, numerical stability analysis where applicable, representative performance measurements, and explicit limitations.
