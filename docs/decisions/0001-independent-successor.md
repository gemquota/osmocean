# ADR 0001: Osmocean is an independent successor

- **Status:** Accepted
- **Date:** 2026-11-09

## Context

Mocean is an existing autonomous aquatic-creature study with useful locomotion, flexible-body, dynamics, and manoeuvre work. Osmocean is intended to expand this into a broader marine simulation with a shared water environment and a more modular simulation architecture.

A GitHub fork would preserve a misleading source-history relationship and encourage wholesale inheritance of implementation constraints that may not fit the successor.

## Decision

Osmocean is a separate repository and independent successor. Mocean remains unchanged as the reference implementation during migration.

Features, algorithms, tests, visual design, and documentation may be selectively ported or reimplemented after review. Each feature receives a traceable migration disposition and acceptance evidence.

## Consequences

- No automatic source-history coupling.
- Migration decisions are explicit and reviewable.
- Mocean remains available for regression comparison.
- Parity is measured feature by feature, not inferred from copied files.
