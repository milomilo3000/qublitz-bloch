import { describe, expect, it } from 'vitest'
import { createQubit } from './qubit.ts'
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
} from './twoQubit.ts'

const D = 6

function expectProbSum(state: ReturnType<typeof createTwoQubit>): void {
  const p = jointProbabilities(state)
  expect(p.p00 + p.p01 + p.p10 + p.p11).toBeCloseTo(1, D)
}

describe('2-qubit |00> ground state', () => {
  it('starts pure at |00> with unit purity and no entanglement', () => {
    const state = createTwoQubit()
    expect(twoQubitPurity(state)).toBeCloseTo(1, D)
    expect(jointProbabilities(state)).toEqual({ p00: 1, p01: 0, p10: 0, p11: 0 })
    expect(entanglement(state)).toBeCloseTo(0, D)
    expect(reducedQubit(state, 0).state.p).toBeCloseTo(1, D)
    expect(reducedQubit(state, 1).vector.qz).toBeCloseTo(1, D)
  })
})

describe('2-qubit product states', () => {
  it('builds |+0> with local |+> and |0> and zero entanglement', () => {
    const state = productState(createQubit(Math.PI / 2, 0, 1), createQubit(0, 0, 1))
    expect(twoQubitPurity(state)).toBeCloseTo(1, D)
    expect(entanglement(state)).toBeCloseTo(0, D)
    expectProbSum(state)

    const q0 = reducedQubit(state, 0)
    const q1 = reducedQubit(state, 1)
    expect(q0.vector.qx).toBeCloseTo(1, D)
    expect(q0.state.p).toBeCloseTo(1, D)
    expect(q1.vector.qz).toBeCloseTo(1, D)
    expect(q1.state.p).toBeCloseTo(1, D)

    const probs = jointProbabilities(state)
    expect(probs.p00).toBeCloseTo(0.5, D)
    expect(probs.p10).toBeCloseTo(0.5, D)
    expect(probs.p01).toBeCloseTo(0, D)
    expect(probs.p11).toBeCloseTo(0, D)
  })

  it('keeps product structure after independent local X on q1', () => {
    const start = productState(createQubit(0, 0, 1), createQubit(0, 0, 1))
    const flipped = applyLocalGate(start, 'X', 1)
    expect(entanglement(flipped)).toBeCloseTo(0, D)
    expect(jointProbabilities(flipped).p01).toBeCloseTo(1, D)
    expect(reducedQubit(flipped, 1).vector.qz).toBeCloseTo(-1, D)
  })
})

describe('2-qubit Bell entanglement', () => {
  it('makes local tips shrink while the joint state stays pure', () => {
    const bell = bellPhiPlus()
    expect(twoQubitPurity(bell)).toBeCloseTo(1, D)
    expect(entanglement(bell)).toBeCloseTo(1, D)
    expect(reducedQubit(bell, 0).state.p).toBeCloseTo(0, D)
    expect(reducedQubit(bell, 1).state.p).toBeCloseTo(0, D)
    expect(reducedQubit(bell, 0).purity).toBeCloseTo(0.5, D)

    const probs = jointProbabilities(bell)
    expect(probs.p00).toBeCloseTo(0.5, D)
    expect(probs.p11).toBeCloseTo(0.5, D)
    expect(probs.p01).toBeCloseTo(0, D)
    expect(probs.p10).toBeCloseTo(0, D)
    expectProbSum(bell)
  })

  it('builds the same Bell pair from |00> via H then CNOT', () => {
    const prepared = prepareBellFromZero()
    expect(entanglement(prepared)).toBeCloseTo(1, D)
    expect(twoQubitPurity(prepared)).toBeCloseTo(1, D)
    const probs = jointProbabilities(prepared)
    expect(probs.p00).toBeCloseTo(0.5, D)
    expect(probs.p11).toBeCloseTo(0.5, D)
  })
})

describe('2-qubit CNOT behavior', () => {
  it('copies the control bit onto the target for |10>', () => {
    const oneZero = applyLocalGate(createTwoQubit(), 'X', 0)
    expect(jointProbabilities(oneZero).p10).toBeCloseTo(1, D)
    const after = applyCnot(oneZero, 0, 1)
    expect(jointProbabilities(after).p11).toBeCloseTo(1, D)
  })

  it('leaves |00> and |01> unchanged for control=0 target=1', () => {
    expect(jointProbabilities(applyCnot(createTwoQubit(), 0, 1)).p00).toBe(1)
    const onlyTarget = applyLocalGate(createTwoQubit(), 'X', 1)
    expect(jointProbabilities(applyCnot(onlyTarget, 0, 1)).p01).toBeCloseTo(1, D)
  })

  it('supports swapped control/target wiring', () => {
    const state = applyLocalGate(createTwoQubit(), 'X', 1)
    const after = applyCnot(state, 1, 0)
    expect(jointProbabilities(after).p11).toBeCloseTo(1, D)
  })
})

describe('2-qubit probability normalization', () => {
  it('keeps joint probabilities summing to 1 across a mixed circuit', () => {
    const result = evaluateTwoQubitCircuit(createTwoQubit(), [
      { kind: 'local', gate: 'H', wire: 0 },
      { kind: 'local', gate: 'T', wire: 1 },
      { kind: 'cnot', control: 0, target: 1 },
      { kind: 'local', gate: 'S', wire: 0 },
      { kind: 'local', gate: 'X', wire: 1 },
    ])
    expectProbSum(result.final)
    for (const step of result.steps) expectProbSum(step.state)
  })
})
