/** Plain-English copy for the Bloch workbench UI. */

import { blochVector, type GateName, type QubitState } from './qubit.ts'

const EPS = 0.08

export type PlainProbabilities = {
  p0: number
  p1: number
}

export function describeGate(gate: GateName): string {
  switch (gate) {
    case 'I':
      return 'Identity leaves the state unchanged — a useful no-op for timing or placeholders.'
    case 'X':
      return 'Bit flip: swaps the chance of |0⟩ and |1⟩ (north ↔ south on the sphere).'
    case 'Y':
      return 'Y rotation flips the bit and adds a phase — the tip moves across both poles and the equator.'
    case 'Z':
      return 'Phase flip: keeps P(|0⟩) and P(|1⟩) the same, but rotates the tip around the vertical axis.'
    case 'H':
      return 'Hadamard creates (or undoes) a 50/50 superposition — from |0⟩ the tip swings to the equator.'
    case 'S':
      return 'S gate adds a quarter-turn phase (π/2) — probabilities stay put while the tip slides along the equator.'
    case 'T':
      return 'T gate adds an eighth-turn phase (π/4) — a gentler equatorial slide than S.'
  }
}

export function describePurity(p: number): string {
  if (p >= 1 - EPS) {
    return 'Certainty / coherence: p ≈ 1 — the tip sits on the sphere surface (a pure state).'
  }
  if (p <= EPS) {
    return 'Certainty / coherence: p ≈ 0 — the tip sits at the center (fully uncertain / mixed).'
  }
  return `Certainty / coherence: p = ${formatP(p)} — between center and surface; shorter tip means less coherence.`
}

export function describeState(state: QubitState, probs: PlainProbabilities): string {
  const { qx, qy, qz } = blochVector(state)
  const { p0, p1 } = probs

  if (state.p <= EPS) {
    return 'Fully mixed: equal chance of |0⟩ or |1⟩ no matter which way you look — the tip rests at the center.'
  }

  if (Math.abs(qz - state.p) < EPS && Math.hypot(qx, qy) < EPS) {
    return `Near |0⟩ (north pole): measurement almost always returns 0. P(|0⟩) ≈ ${pct(p0)}, P(|1⟩) ≈ ${pct(p1)}.`
  }

  if (Math.abs(qz + state.p) < EPS && Math.hypot(qx, qy) < EPS) {
    return `Near |1⟩ (south pole): measurement almost always returns 1. P(|0⟩) ≈ ${pct(p0)}, P(|1⟩) ≈ ${pct(p1)}.`
  }

  if (Math.abs(state.p - 1) < EPS && Math.abs(qz) < EPS && Math.abs(qy) < EPS && qx > 0) {
    return `Equal superposition |+⟩: a fair 50/50 coin between |0⟩ and |1⟩. P(|0⟩) ≈ ${pct(p0)}, P(|1⟩) ≈ ${pct(p1)}.`
  }

  if (Math.abs(state.p - 1) < EPS && Math.abs(qz) < EPS && Math.abs(qy) < EPS && qx < 0) {
    return `Equal superposition |−⟩: still 50/50 outcomes, with an opposite phase from |+⟩. P(|0⟩) ≈ ${pct(p0)}, P(|1⟩) ≈ ${pct(p1)}.`
  }

  if (Math.abs(state.p - 1) < EPS && Math.abs(qz) < EPS && Math.abs(qx) < EPS && qy > 0) {
    return `Circular superposition |+i⟩: still 50/50, phase pointing along +Y. P(|0⟩) ≈ ${pct(p0)}, P(|1⟩) ≈ ${pct(p1)}.`
  }

  if (Math.abs(state.p - 1) < EPS && Math.abs(qz) < EPS && Math.abs(qx) < EPS && qy < 0) {
    return `Circular superposition |−i⟩: still 50/50, phase pointing along −Y. P(|0⟩) ≈ ${pct(p0)}, P(|1⟩) ≈ ${pct(p1)}.`
  }

  if (Math.abs(p0 - p1) < EPS) {
    return `Balanced odds: about half |0⟩ and half |1⟩. P(|0⟩) ≈ ${pct(p0)}, P(|1⟩) ≈ ${pct(p1)}. The tip’s direction holds the relative phase.`
  }

  if (p0 > p1) {
    return `Tilted toward |0⟩: more likely to measure 0 than 1. P(|0⟩) ≈ ${pct(p0)}, P(|1⟩) ≈ ${pct(p1)}.`
  }

  return `Tilted toward |1⟩: more likely to measure 1 than 0. P(|0⟩) ≈ ${pct(p0)}, P(|1⟩) ≈ ${pct(p1)}.`
}

export function describeStatus(lastGate: GateName | null, p: number): string {
  if (!lastGate) {
    return 'Drag the tip or try a starter below. Gates move the tip; purity p sets how certain the state is.'
  }
  return `Applied ${lastGate}. ${describeGate(lastGate)} Purity p stays ${formatP(p)}.`
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`
}

function formatP(p: number): string {
  return (Math.round(p * 1000) / 1000).toFixed(3)
}
