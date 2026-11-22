/**
 * Multi-trial verification that 2-qubit entanglement, local purity/radius,
 * and joint probabilities vary continuously (not only 0/1 snaps).
 *
 * Pure family used throughout:
 *   |ψ(α)⟩ = cos(α)|00⟩ + sin(α)|11⟩
 * For this Schmidt form, E = 2(1 − Tr(ρ_A²)) = sin²(2α).
 * α = 0 → separable; α = π/8 → E = 1/2; α = π/4 → Bell / E = 1.
 */

import { describe, expect, it } from 'vitest'
import { createQubit, type Complex } from './qubit.ts'
import {
  applyCnot,
  applyLocalGate,
  bellPhiPlus,
  createTwoQubit,
  entanglement,
  evaluateTwoQubitCircuit,
  jointProbabilities,
  prepareBellFromZero,
  productState,
  reducedQubit,
  twoQubitPurity,
  type Matrix4,
  type TwoQubitState,
} from './twoQubit.ts'

const D = 6
const EPS = 1e-9

function c(re: number, im = 0): Complex {
  return { re: re === 0 ? 0 : re, im: im === 0 ? 0 : im }
}

function projectorFromAmplitudes(amps: readonly Complex[]): TwoQubitState {
  const z = c(0)
  const rho: Matrix4 = [
    [z, z, z, z],
    [z, z, z, z],
    [z, z, z, z],
    [z, z, z, z],
  ]
  for (let i = 0; i < 4; i += 1) {
    for (let j = 0; j < 4; j += 1) {
      const a = amps[i]!
      const b = amps[j]!
      rho[i]![j] = c(a.re * b.re + a.im * b.im, a.im * b.re - a.re * b.im)
    }
  }
  return { rho }
}

/** |ψ(α)⟩ = cos(α)|00⟩ + sin(α)|11⟩ */
function schmidtPhi(alpha: number): TwoQubitState {
  return projectorFromAmplitudes([c(Math.cos(alpha)), c(0), c(0), c(Math.sin(alpha))])
}

/** Analytic E for the Schmidt family above. */
function expectedE(alpha: number): number {
  const s = Math.sin(2 * alpha)
  return s * s
}

function blochRadius(state: TwoQubitState, wire: 0 | 1): number {
  const v = reducedQubit(state, wire).vector
  return Math.hypot(v.qx, v.qy, v.qz)
}

function expectInUnitInterval(value: number, label: string): void {
  expect(Number.isFinite(value), `${label} must be finite`).toBe(true)
  expect(value, `${label} >= 0`).toBeGreaterThanOrEqual(-EPS)
  expect(value, `${label} <= 1`).toBeLessThanOrEqual(1 + EPS)
}

function expectProbabilitiesSane(state: TwoQubitState): void {
  const p = jointProbabilities(state)
  for (const [key, value] of Object.entries(p) as [string, number][]) {
    expectInUnitInterval(value, key)
  }
  expect(p.p00 + p.p01 + p.p10 + p.p11).toBeCloseTo(1, D)
}

function expectLocalConsistentWithE(state: TwoQubitState, e: number): void {
  const q0 = reducedQubit(state, 0)
  const q1 = reducedQubit(state, 1)
  const r0 = blochRadius(state, 0)
  const r1 = blochRadius(state, 1)

  expectInUnitInterval(q0.state.p, 'q0.p')
  expectInUnitInterval(q1.state.p, 'q1.p')
  expectInUnitInterval(q0.purity, 'q0.purity')
  expectInUnitInterval(q1.purity, 'q1.purity')

  // E = 2(1 − Tr(ρ_A²)) ⇒ Tr(ρ_A²) = 1 − E/2 and |r|² = 1 − E
  expect(q0.purity).toBeCloseTo(1 - e / 2, D)
  expect(q1.purity).toBeCloseTo(1 - e / 2, D)
  expect(r0 * r0).toBeCloseTo(1 - e, D)
  expect(r1 * r1).toBeCloseTo(1 - e, D)
  expect(q0.state.p).toBeCloseTo(r0, D)
  expect(q1.state.p).toBeCloseTo(r1, D)
}

describe('continuous & partial entanglement trials', () => {
  const ALPHA_TRIALS = [
    { name: 'separable α=0', alpha: 0, targetE: 0 },
    { name: 'weak α=π/16', alpha: Math.PI / 16, targetE: expectedE(Math.PI / 16) },
    { name: 'partial E≈0.5 (α=π/8)', alpha: Math.PI / 8, targetE: 0.5 },
    { name: 'strong α=3π/16', alpha: (3 * Math.PI) / 16, targetE: expectedE((3 * Math.PI) / 16) },
    { name: 'maximal α=π/4', alpha: Math.PI / 4, targetE: 1 },
  ] as const

  it.each(ALPHA_TRIALS)(
    'tracks analytic E for $name without snapping past the continuum',
    ({ alpha, targetE }) => {
      const state = schmidtPhi(alpha)
      const e = entanglement(state)

      expectInUnitInterval(e, 'entanglement')
      expect(e).toBeCloseTo(targetE, D)
      expect(e).toBeCloseTo(expectedE(alpha), D)

      // Partial trials must land strictly between the endpoints (no 0/1 snap).
      if (targetE > 0.05 && targetE < 0.95) {
        expect(e).toBeGreaterThan(0.05)
        expect(e).toBeLessThan(0.95)
        expect(e).not.toBeCloseTo(0, 2)
        expect(e).not.toBeCloseTo(1, 2)
      }
    },
  )

  it('sweeps α smoothly: E rises monotonically and hits ~0.5 mid-band', () => {
    const steps = 17
    const values: number[] = []

    for (let i = 0; i < steps; i += 1) {
      const alpha = (i / (steps - 1)) * (Math.PI / 4)
      const e = entanglement(schmidtPhi(alpha))
      expectInUnitInterval(e, `E(α=${alpha})`)
      expect(e).toBeCloseTo(expectedE(alpha), D)
      values.push(e)
    }

    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]!).toBeGreaterThanOrEqual(values[i - 1]! - EPS)
    }

    expect(values[0]).toBeCloseTo(0, D)
    expect(values[values.length - 1]).toBeCloseTo(1, D)

    // Mid-band sample near α=π/8 must be partial (~0.5), not a binary snap.
    const mid = values[Math.floor((steps - 1) / 2)]!
    expect(mid).toBeCloseTo(0.5, 2)
    expect(mid).toBeGreaterThan(0.35)
    expect(mid).toBeLessThan(0.65)
  })

  it('keeps consecutive α steps continuous (small ΔE, no jumps to only 0 or 1)', () => {
    const steps = 24
    let previous = entanglement(schmidtPhi(0))

    for (let i = 1; i < steps; i += 1) {
      const alpha = (i / (steps - 1)) * (Math.PI / 4)
      const e = entanglement(schmidtPhi(alpha))
      const delta = Math.abs(e - previous)

      // Uniform α grid → E = sin²(2α) changes by less than ~0.15 per step here.
      expect(delta).toBeLessThan(0.15)

      if (i > 1 && i < steps - 1) {
        const snappedBinary = (e < 1e-6 || e > 1 - 1e-6) && previous > 0.1 && previous < 0.9
        expect(snappedBinary).toBe(false)
      }

      previous = e
    }
  })

  it('matches concurrence≈0.5 family point with continuous (non-extremal) E', () => {
    // Concurrence C = |sin(2α)|; C = 0.5 ⇒ α = π/12, E = C² = 0.25.
    const alpha = Math.PI / 12
    const concurrence = Math.abs(Math.sin(2 * alpha))
    const e = entanglement(schmidtPhi(alpha))

    expect(concurrence).toBeCloseTo(0.5, D)
    expect(e).toBeCloseTo(concurrence * concurrence, D)
    expect(e).toBeCloseTo(0.25, D)
    expect(e).toBeGreaterThan(0.1)
    expect(e).toBeLessThan(0.4)
  })
})

describe('local purity & reduced Bloch vector trials', () => {
  const LOCAL_TRIALS = [
    { name: 'product |00⟩', state: () => createTwoQubit(), e: 0 },
    {
      name: 'product |+0⟩',
      state: () => productState(createQubit(Math.PI / 2, 0, 1), createQubit(0, 0, 1)),
      e: 0,
    },
    {
      name: 'product |01⟩ via X on q1',
      state: () => applyLocalGate(createTwoQubit(), 'X', 1),
      e: 0,
    },
    { name: 'partial E=0.5', state: () => schmidtPhi(Math.PI / 8), e: 0.5 },
    { name: 'partial E≈0.25 (C≈0.5)', state: () => schmidtPhi(Math.PI / 12), e: 0.25 },
    { name: 'Bell Φ+', state: () => bellPhiPlus(), e: 1 },
    { name: 'Bell via H·CNOT', state: () => prepareBellFromZero(), e: 1 },
  ] as const

  it.each(LOCAL_TRIALS)(
    'ties local purity/radius to entanglement for $name',
    ({ state, e: expected }) => {
      const s = state()
      const e = entanglement(s)
      expect(e).toBeCloseTo(expected, D)
      expectLocalConsistentWithE(s, e)
      expectProbabilitiesSane(s)
      expect(twoQubitPurity(s)).toBeCloseTo(1, D)
    },
  )

  it('shrinks local radius continuously as E rises across many α trials', () => {
    const samples = 13
    let previousRadius = 1

    for (let i = 0; i < samples; i += 1) {
      const alpha = (i / (samples - 1)) * (Math.PI / 4)
      const state = schmidtPhi(alpha)
      const e = entanglement(state)
      const r0 = blochRadius(state, 0)
      const r1 = blochRadius(state, 1)

      expect(r0).toBeCloseTo(r1, D)
      expect(r0).toBeCloseTo(Math.sqrt(Math.max(0, 1 - e)), D)
      expect(r0).toBeLessThanOrEqual(previousRadius + EPS)
      previousRadius = r0

      expectProbabilitiesSane(state)
    }

    expect(blochRadius(schmidtPhi(0), 0)).toBeCloseTo(1, D)
    expect(blochRadius(schmidtPhi(Math.PI / 4), 0)).toBeCloseTo(0, D)
    expect(blochRadius(schmidtPhi(Math.PI / 8), 0)).toBeCloseTo(Math.SQRT1_2, D)
  })

  it('keeps joint 4-outcome probabilities normalized on every circuit step', () => {
    const circuits = [
      [
        { kind: 'local' as const, gate: 'H' as const, wire: 0 as const },
        { kind: 'cnot' as const, control: 0 as const, target: 1 as const },
      ],
      [
        { kind: 'local' as const, gate: 'H' as const, wire: 0 as const },
        { kind: 'local' as const, gate: 'T' as const, wire: 1 as const },
        { kind: 'cnot' as const, control: 0 as const, target: 1 as const },
        { kind: 'local' as const, gate: 'S' as const, wire: 0 as const },
      ],
      [
        { kind: 'local' as const, gate: 'X' as const, wire: 0 as const },
        { kind: 'local' as const, gate: 'X' as const, wire: 1 as const },
        { kind: 'cnot' as const, control: 1 as const, target: 0 as const },
      ],
    ]

    for (const ops of circuits) {
      const { steps, final } = evaluateTwoQubitCircuit(createTwoQubit(), ops)
      expectProbabilitiesSane(final)
      expectInUnitInterval(entanglement(final), 'circuit final E')
      for (const step of steps) {
        expectProbabilitiesSane(step.state)
        expectInUnitInterval(entanglement(step.state), 'circuit step E')
      }
    }
  })
})

describe('mismatch / sanity trials', () => {
  it('refuses to call a separable product state maximally entangled', () => {
    const separable = [
      createTwoQubit(),
      productState(createQubit(Math.PI / 2, 0, 1), createQubit(0, 0, 1)),
      productState(createQubit(0, 0, 1), createQubit(Math.PI / 2, Math.PI / 2, 1)),
      applyLocalGate(applyLocalGate(createTwoQubit(), 'X', 0), 'H', 1),
    ]

    for (const state of separable) {
      const e = entanglement(state)
      expect(e).toBeCloseTo(0, D)
      expect(e).toBeLessThan(0.05)
      // Negative assertion: this is what a broken “always 1” implementation would hit.
      expect(e).not.toBeCloseTo(1, 1)
      expect(blochRadius(state, 0)).toBeGreaterThan(0.95)
    }
  })

  it('refuses to call a Bell state separable', () => {
    const bells = [bellPhiPlus(), prepareBellFromZero(), applyCnot(applyLocalGate(createTwoQubit(), 'H', 0), 0, 1)]

    for (const state of bells) {
      const e = entanglement(state)
      expect(e).toBeCloseTo(1, D)
      expect(e).toBeGreaterThan(0.95)
      expect(e).not.toBeCloseTo(0, 1)
      expect(blochRadius(state, 0)).toBeLessThan(0.05)
      expect(blochRadius(state, 1)).toBeLessThan(0.05)
    }
  })

  it('flags partial E≈0.5 as neither separable nor Bell', () => {
    const state = schmidtPhi(Math.PI / 8)
    const e = entanglement(state)

    expect(e).toBeCloseTo(0.5, D)
    expect(e).not.toBeCloseTo(0, 1)
    expect(e).not.toBeCloseTo(1, 1)

    // Sanity: claiming “binary only” would fail these bounds.
    expect(e > 0.4 && e < 0.6).toBe(true)
    expect(blochRadius(state, 0)).toBeGreaterThan(0.4)
    expect(blochRadius(state, 0)).toBeLessThan(0.9)
  })

  it('catches out-of-bounds entanglement as a hard failure condition', () => {
    const probes = [
      createTwoQubit(),
      schmidtPhi(Math.PI / 8),
      schmidtPhi(Math.PI / 12),
      bellPhiPlus(),
      evaluateTwoQubitCircuit(createTwoQubit(), [
        { kind: 'local', gate: 'H', wire: 1 },
        { kind: 'cnot', control: 1, target: 0 },
        { kind: 'local', gate: 'T', wire: 0 },
      ]).final,
    ]

    for (const state of probes) {
      const e = entanglement(state)
      // If entanglement ever leaves [0, 1], this trial must fail loudly.
      expect(e >= 0 && e <= 1).toBe(true)
      expectInUnitInterval(e, 'entanglement bounds')
      expectProbabilitiesSane(state)
    }
  })

  it('detects circuit transition: H alone stays product; CNOT then creates entanglement', () => {
    const afterH = applyLocalGate(createTwoQubit(), 'H', 0)
    expect(entanglement(afterH)).toBeCloseTo(0, D)
    expect(entanglement(afterH)).not.toBeCloseTo(1, 1)

    const afterCnot = applyCnot(afterH, 0, 1)
    expect(entanglement(afterCnot)).toBeCloseTo(1, D)
    expect(entanglement(afterCnot)).not.toBeCloseTo(0, 1)

    // Intermediate partial via Schmidt, not a gate snap artifact.
    const partial = schmidtPhi(Math.PI / 8)
    expect(entanglement(partial)).toBeCloseTo(0.5, D)
    expect(entanglement(partial)).toBeGreaterThan(entanglement(afterH))
    expect(entanglement(partial)).toBeLessThan(entanglement(afterCnot))
  })
})
