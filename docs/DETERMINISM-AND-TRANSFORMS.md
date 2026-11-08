# Determinism and Transform Contract

## Quaternion convention

- Quaternion layout is `{x, y, z, w}`, scalar component last.
- Inputs are normalized at rotation boundaries; zero and non-finite quaternions are rejected.
- Multiplication is the Hamilton product. For column-vector transforms, `a * b` applies `b` first, then `a`.
- Angles are radians.
- Positive rotation follows the right-hand rule.
- The world frame is right-handed with +Y up. The current provisional camera-facing convention is +Z toward the viewer.
- Vector rotation is `q * (v, 0) * conjugate(q)`.

## Rigid transforms

A transform maps local coordinates into world coordinates. Composition is parent-from-local:

`worldPosition = parentPosition + rotate(parentRotation, localPosition)`

`worldRotation = parentRotation * localRotation`

The inverse point operation subtracts translation then applies the conjugate rotation. Scale is intentionally excluded: these are rigid transforms, not general affine transforms.

## Deterministic random streams

`createSeededRandom(seed)` provides reproducible 32-bit output and [0,1) floating values. It is not cryptographic. Forking creates a repeatable child stream from the current parent state and a label. Callers should fork stable subsystem/entity labels rather than consume one global stream, so adding a random draw in one subsystem does not perturb unrelated systems.

## Update scheduler

The scheduler executes declared phases in declaration order. Within each phase it sorts by numeric order, then registration sequence. Registration and removal during dispatch are rejected. A thrown system error aborts the current tick and propagates; the scheduler resets its dispatch guard in `finally`, allowing controlled recovery by the caller.

The scheduler does not own simulation time, state integration, or rollback. It is an ordering primitive. The orchestrator owns tick boundaries and decides whether a failed tick invalidates the simulation state.
