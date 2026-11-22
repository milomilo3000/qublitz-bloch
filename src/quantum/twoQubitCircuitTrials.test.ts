/**
 * Multi-trial path checks for 2-qubit circuits of length 1–5.
 * At every gate step we verify joint probs, entanglement, and reduced
 * Bloch vectors (local tip length / purity) stay physically consistent.
 */

import { describe, expect, it } from 'vitest'
import {
  applyCnot,
  applyLocalGate,
  createTwoQubit,
  entanglement,
  evaluateTwoQubitCircuit,
  jointProbabilities,
  reducedQubit,
  twoQubitPurity,
  type TwoQubitOp,
  type TwoQubitState,
} from './twoQubit.ts'

const D = 6
const EPS = 1e-9

type PathSnapshot = {
  step: number
  op: TwoQubitOp | null
  e: number
  purity: number
  r0: number
  r1: number
  p0: number
  p1: number
  probs: ReturnType<typeof jointProbabilities>
}

function radius(state: TwoQubitState, wire: 0 | 1): number {
  const v = reducedQubit(state, wire).vector
  return Math.hypot(v.qx, v.qy, v.qz)
}

function snapshot(state: TwoQubitState, step: number, op: TwoQubitOp | null): PathSnapshot {
  const q0 = reducedQubit(state, 0)
  const q1 = reducedQubit(state, 1)
  return {
    step,
    op,
    e: entanglement(state),
    purity: twoQubitPurity(state),
    r0: radius(state, 0),
    r1: radius(state, 1),
    p0: q0.state.p,
    p1: q1.state.p,
    probs: jointProbabilities(state),
  }
}

function walkCircuit(ops: readonly TwoQubitOp[]): PathSnapshot[] {
  const initial = createTwoQubit()
  const path: PathSnapshot[] = [snapshot(initial, 0, null)]
  const { steps } = evaluateTwoQubitCircuit(initial, ops)
  steps.forEach((entry, index) => {
    path.push(snapshot(entry.state, index + 1, entry.op))
  })
  return path
}

function expectStepSane(snap: PathSnapshot): void {
  expect(Number.isFinite(snap.e)).toBe(true)
  expect(snap.e).toBeGreaterThanOrEqual(-EPS)
  expect(snap.e).toBeLessThanOrEqual(1 + EPS)

  expect(snap.purity).toBeCloseTo(1, D)
  expect(snap.r0).toBeCloseTo(snap.p0, D)
  expect(snap.r1).toBeCloseTo(snap.p1, D)

  // E = 2(1 − Tr(ρ_A²)) ⇒ |r|² = 1 − E for pure bipartite states
  expect(snap.r0 * snap.r0).toBeCloseTo(1 - snap.e, D)
  expect(snap.r1 * snap.r1).toBeCloseTo(1 - snap.e, D)

  const { p00, p01, p10, p11 } = snap.probs
  for (const value of [p00, p01, p10, p11]) {
    expect(value).toBeGreaterThanOrEqual(-EPS)
    expect(value).toBeLessThanOrEqual(1 + EPS)
  }
  expect(p00 + p01 + p10 + p11).toBeCloseTo(1, D)
}

function expectManualMatch(ops: readonly TwoQubitOp[], path: PathSnapshot[]): void {
  let state = createTwoQubit()
  expectStepSane(path[0]!)
  expect(path[0]!.e).toBeCloseTo(entanglement(state), D)

  ops.forEach((op, index) => {
    state = op.kind === 'local'
      ? applyLocalGate(state, op.gate, op.wire)
      : applyCnot(state, op.control, op.target)
    const snap = path[index + 1]!
    expect(snap.op).toEqual(op)
    expect(snap.e).toBeCloseTo(entanglement(state), D)
    expect(snap.r0).toBeCloseTo(radius(state, 0), D)
    expect(snap.r1).toBeCloseTo(radius(state, 1), D)
    expect(snap.probs).toEqual(jointProbabilities(state))
    expectStepSane(snap)
  })
}

const TRIALS: { name: string; ops: TwoQubitOp[] }[] = [
  // length 1
  {
    name: '1-gate H on q0',
    ops: [{ kind: 'local', gate: 'H', wire: 0 }],
  },
  {
    name: '1-gate X on q1',
    ops: [{ kind: 'local', gate: 'X', wire: 1 }],
  },
  {
    name: '1-gate CNOT (no-op on |00⟩)',
    ops: [{ kind: 'cnot', control: 0, target: 1 }],
  },
  // length 2
  {
    name: '2-gate Bell H·CNOT',
    ops: [
      { kind: 'local', gate: 'H', wire: 0 },
      { kind: 'cnot', control: 0, target: 1 },
    ],
  },
  {
    name: '2-gate independent X⊗X',
    ops: [
      { kind: 'local', gate: 'X', wire: 0 },
      { kind: 'local', gate: 'X', wire: 1 },
    ],
  },
  {
    name: '2-gate H on both wires',
    ops: [
      { kind: 'local', gate: 'H', wire: 0 },
      { kind: 'local', gate: 'H', wire: 1 },
    ],
  },
  // length 3
  {
    name: '3-gate H·CNOT·Z',
    ops: [
      { kind: 'local', gate: 'H', wire: 0 },
      { kind: 'cnot', control: 0, target: 1 },
      { kind: 'local', gate: 'Z', wire: 0 },
    ],
  },
  {
    name: '3-gate H·T·CNOT',
    ops: [
      { kind: 'local', gate: 'H', wire: 0 },
      { kind: 'local', gate: 'T', wire: 1 },
      { kind: 'cnot', control: 0, target: 1 },
    ],
  },
  {
    name: '3-gate X·H·CNOT(swapped)',
    ops: [
      { kind: 'local', gate: 'X', wire: 1 },
      { kind: 'local', gate: 'H', wire: 1 },
      { kind: 'cnot', control: 1, target: 0 },
    ],
  },
  // length 4
  {
    name: '4-gate Bell then local phase',
    ops: [
      { kind: 'local', gate: 'H', wire: 0 },
      { kind: 'cnot', control: 0, target: 1 },
      { kind: 'local', gate: 'S', wire: 0 },
      { kind: 'local', gate: 'S', wire: 1 },
    ],
  },
  {
    name: '4-gate product then entangle',
    ops: [
      { kind: 'local', gate: 'H', wire: 0 },
      { kind: 'local', gate: 'X', wire: 1 },
      { kind: 'local', gate: 'S', wire: 0 },
      { kind: 'cnot', control: 0, target: 1 },
    ],
  },
  // length 5
  {
    name: '5-gate mixed walk',
    ops: [
      { kind: 'local', gate: 'H', wire: 0 },
      { kind: 'local', gate: 'T', wire: 1 },
      { kind: 'cnot', control: 0, target: 1 },
      { kind: 'local', gate: 'S', wire: 0 },
      { kind: 'local', gate: 'X', wire: 1 },
    ],
  },
  {
    name: '5-gate entangle–local–revisit',
    ops: [
      { kind: 'local', gate: 'H', wire: 0 },
      { kind: 'cnot', control: 0, target: 1 },
      { kind: 'local', gate: 'Y', wire: 0 },
      { kind: 'local', gate: 'Z', wire: 1 },
      { kind: 'cnot', control: 1, target: 0 },
    ],
  },
  {
    name: '5-gate separable-only path',
    ops: [
      { kind: 'local', gate: 'H', wire: 0 },
      { kind: 'local', gate: 'X', wire: 1 },
      { kind: 'local', gate: 'S', wire: 0 },
      { kind: 'local', gate: 'Z', wire: 1 },
      { kind: 'local', gate: 'T', wire: 0 },
    ],
  },
]

describe('2-qubit circuit path trials (1–5 gates)', () => {
  it.each(TRIALS)('$name: step path stays sane and matches manual apply', ({ ops }) => {
    expect(ops.length).toBeGreaterThanOrEqual(1)
    expect(ops.length).toBeLessThanOrEqual(5)

    const path = walkCircuit(ops)
    expect(path).toHaveLength(ops.length + 1)
    expectManualMatch(ops, path)

    for (const snap of path) expectStepSane(snap)
  })

  it('records expected entanglement landmarks on the Bell path', () => {
    const path = walkCircuit([
      { kind: 'local', gate: 'H', wire: 0 },
      { kind: 'cnot', control: 0, target: 1 },
    ])

    // |00⟩ → product
    expect(path[0]!.e).toBeCloseTo(0, D)
    expect(path[0]!.r0).toBeCloseTo(1, D)
    expect(path[0]!.r1).toBeCloseTo(1, D)
    expect(path[0]!.probs.p00).toBeCloseTo(1, D)

    // after H⊗I → |+0⟩ still product; tip of q0 on +X
    expect(path[1]!.e).toBeCloseTo(0, D)
    expect(path[1]!.r0).toBeCloseTo(1, D)
    expect(path[1]!.r1).toBeCloseTo(1, D)
    expect(reducedQubit(evaluateTwoQubitCircuit(createTwoQubit(), [
      { kind: 'local', gate: 'H', wire: 0 },
    ]).final, 0).vector.qx).toBeCloseTo(1, D)
    expect(path[1]!.probs.p00).toBeCloseTo(0.5, D)
    expect(path[1]!.probs.p10).toBeCloseTo(0.5, D)

    // after CNOT → Bell; local tips shrink, E → 1
    expect(path[2]!.e).toBeCloseTo(1, D)
    expect(path[2]!.r0).toBeCloseTo(0, D)
    expect(path[2]!.r1).toBeCloseTo(0, D)
    expect(path[2]!.probs.p00).toBeCloseTo(0.5, D)
    expect(path[2]!.probs.p11).toBeCloseTo(0.5, D)
    expect(path[2]!.probs.p01).toBeCloseTo(0, D)
    expect(path[2]!.probs.p10).toBeCloseTo(0, D)
  })

  it('keeps E=0 and unit local tips on every step of a separable-only 5-gate path', () => {
    const path = walkCircuit([
      { kind: 'local', gate: 'H', wire: 0 },
      { kind: 'local', gate: 'X', wire: 1 },
      { kind: 'local', gate: 'S', wire: 0 },
      { kind: 'local', gate: 'Z', wire: 1 },
      { kind: 'local', gate: 'T', wire: 0 },
    ])

    for (const snap of path) {
      expect(snap.e).toBeCloseTo(0, D)
      expect(snap.r0).toBeCloseTo(1, D)
      expect(snap.r1).toBeCloseTo(1, D)
      expectStepSane(snap)
    }
  })

  it('shows local tip collapse only after the entangling CNOT in multi-gate trials', () => {
    const beforeCnot: TwoQubitOp[] = [
      { kind: 'local', gate: 'H', wire: 0 },
      { kind: 'local', gate: 'T', wire: 1 },
      { kind: 'local', gate: 'S', wire: 0 },
    ]
    const withCnot: TwoQubitOp[] = [
      ...beforeCnot,
      { kind: 'cnot', control: 0, target: 1 },
      { kind: 'local', gate: 'Z', wire: 0 },
    ]

    const path = walkCircuit(withCnot)
    expect(path).toHaveLength(6)

    for (let i = 0; i <= beforeCnot.length; i += 1) {
      expect(path[i]!.e).toBeCloseTo(0, D)
      expect(path[i]!.r0).toBeCloseTo(1, D)
      expect(path[i]!.r1).toBeCloseTo(1, D)
    }

    // step 4 = after CNOT → entangled; local radii drop
    expect(path[4]!.e).toBeGreaterThan(0.9)
    expect(path[4]!.r0).toBeLessThan(0.2)
    expect(path[4]!.r1).toBeLessThan(0.2)

    // local Z after Bell keeps maximal entanglement (phase on one wire)
    expect(path[5]!.e).toBeCloseTo(1, D)
    expect(path[5]!.r0).toBeCloseTo(0, D)
    expect(path[5]!.r1).toBeCloseTo(0, D)
  })

  it('runs length-parameterized trials for every size in 1..5', () => {
    const byLength = new Map<number, number>()
    for (const trial of TRIALS) {
      byLength.set(trial.ops.length, (byLength.get(trial.ops.length) ?? 0) + 1)
      const path = walkCircuit(trial.ops)
      expect(path).toHaveLength(trial.ops.length + 1)
      path.forEach(expectStepSane)
    }

    for (let n = 1; n <= 5; n += 1) {
      expect(byLength.get(n) ?? 0).toBeGreaterThanOrEqual(1)
    }
  })

  it('does not snap entanglement to only 0/1 across a 5-gate mixed path of snapshots', () => {
    // Build a path that includes product, Bell, and a non-extremal intermediate via
    // evaluating known landmarks; ensure the walker reports distinct E values.
    const bellPath = walkCircuit([
      { kind: 'local', gate: 'H', wire: 0 },
      { kind: 'cnot', control: 0, target: 1 },
    ])
    const productPath = walkCircuit([
      { kind: 'local', gate: 'X', wire: 0 },
      { kind: 'local', gate: 'H', wire: 1 },
    ])
    const fivePath = walkCircuit([
      { kind: 'local', gate: 'H', wire: 0 },
      { kind: 'local', gate: 'T', wire: 1 },
      { kind: 'cnot', control: 0, target: 1 },
      { kind: 'local', gate: 'S', wire: 0 },
      { kind: 'local', gate: 'X', wire: 1 },
    ])

    expect(productPath.every((s) => s.e < 0.05)).toBe(true)
    expect(bellPath[bellPath.length - 1]!.e).toBeGreaterThan(0.95)

    const entanglingStep = fivePath.find((s) => s.op?.kind === 'cnot')
    expect(entanglingStep).toBeTruthy()
    expect(entanglingStep!.e).toBeGreaterThan(0.9)
    expect(entanglingStep!.r0).toBeLessThan(0.2)

    // After CNOT, later local gates keep E high (still entangled), tips stay short.
    const after = fivePath.filter((s) => s.step >= entanglingStep!.step)
    for (const snap of after) {
      expect(snap.e).toBeGreaterThan(0.9)
      expect(snap.r0).toBeLessThan(0.2)
      expect(snap.r1).toBeLessThan(0.2)
      expectStepSane(snap)
    }
  })
})
