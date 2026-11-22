import { describe, expect, it } from 'vitest'
import { quantumToThree, stateToThree } from '../components/blochSpace.ts'
import { evaluateCircuit } from './circuit.ts'
import { circuitTrail } from './playback.ts'
import {
  applyGate,
  blochVector,
  createQubit,
  densityMatrix,
  probabilities,
  type GateName,
  type QubitState,
} from './qubit.ts'
import {
  STRESS_DIGITS,
  animationFrames,
  gateObservation,
  growingTrailLengths,
  groverSearchOnce,
  ket0,
  ket1,
  ketPlus,
  ketPlusI,
  rhoClose,
  sampleArcEndpoints,
} from './stressHelpers.ts'

const D = STRESS_DIGITS

function expectBloch(state: QubitState, qx: number, qy: number, qz: number): void {
  const vector = blochVector(state)
  expect(vector.qx).toBeCloseTo(qx, D)
  expect(vector.qy).toBeCloseTo(qy, D)
  expect(vector.qz).toBeCloseTo(qz, D)
}

function expectThreeMapsFromQuantum(state: QubitState): void {
  const { qx, qy, qz } = blochVector(state)
  expect(stateToThree(state)).toEqual(quantumToThree(qx, qy, qz))
  expect(stateToThree(state)).toEqual([qx, qz, -qy === 0 ? 0 : -qy])
}

function expectHermitianTraceOne(state: QubitState): void {
  const rho = densityMatrix(state)
  expect(rho[0][0].im).toBeCloseTo(0, D)
  expect(rho[1][1].im).toBeCloseTo(0, D)
  expect(rho[0][1].re).toBeCloseTo(rho[1][0].re, D)
  expect(rho[0][1].im).toBeCloseTo(-rho[1][0].im, D)
  expect(rho[0][0].re + rho[1][1].re).toBeCloseTo(1, D)
}

function expectProbsFromRho(state: QubitState): void {
  const rho = densityMatrix(state)
  const probs = probabilities(state)
  expect(probs.p0).toBeCloseTo(rho[0][0].re, D)
  expect(probs.p1).toBeCloseTo(rho[1][1].re, D)
  expect(probs.p0 + probs.p1).toBeCloseTo(1, D)
}

function expectPreservesP(before: QubitState, after: QubitState): void {
  expect(after.p).toBeCloseTo(before.p, D)
}

// ---------------------------------------------------------------------------
// 1. Gate transformation tests
// ---------------------------------------------------------------------------

describe('gate I transformations', () => {
  it('leaves |0>, |1>, |+>, and |+i> unchanged for p = 1', () => {
    for (const state of [ket0(), ket1(), ketPlus(), ketPlusI()]) {
      const { next, vector, three, probs, rho } = gateObservation(state, 'I')
      expectPreservesP(state, next)
      expectBloch(next, vector.qx, vector.qy, vector.qz)
      expect(three).toEqual(quantumToThree(vector.qx, vector.qy, vector.qz))
      expectProbsFromRho(next)
      expect(rhoClose(rho, densityMatrix(state))).toBe(true)
      expect(probs.p0 + probs.p1).toBeCloseTo(1, D)
    }
  })

  it('preserves a mixed Bloch vector and probabilities for 0 < p < 1', () => {
    const state = createQubit(1.1, 0.7, 0.45)
    const { next, probs } = gateObservation(state, 'I')
    expectPreservesP(state, next)
    expectBloch(next, blochVector(state).qx, blochVector(state).qy, blochVector(state).qz)
    expect(probs.p0).toBeCloseTo(probabilities(state).p0, D)
    expectThreeMapsFromQuantum(next)
  })

  it('keeps the p = 0 center state at 50/50 with zero Bloch radius', () => {
    const state = ketPlus(0)
    const { next, vector, probs } = gateObservation(state, 'I')
    expect(next.p).toBe(0)
    expect(vector).toEqual({ qx: 0, qy: 0, qz: 0 })
    expect(probs).toEqual({ p0: 0.5, p1: 0.5 })
    expectThreeMapsFromQuantum(next)
  })
})

describe('gate X transformations', () => {
  it('swaps |0> and |1> and maps their Three.js tips across ±Y', () => {
    const from0 = gateObservation(ket0(), 'X')
    expectBloch(from0.next, 0, 0, -1)
    expect(from0.probs).toEqual({ p0: 0, p1: 1 })
    expect(from0.three).toEqual([0, -1, 0])
    expectHermitianTraceOne(from0.next)

    const from1 = gateObservation(ket1(), 'X')
    expectBloch(from1.next, 0, 0, 1)
    expect(from1.probs).toEqual({ p0: 1, p1: 0 })
    expect(from1.three).toEqual([0, 1, 0])
  })

  it('fixes |+> and sends |+i> to |-i> while preserving purity', () => {
    const plus = gateObservation(ketPlus(), 'X')
    expectPreservesP(ketPlus(), plus.next)
    expectBloch(plus.next, 1, 0, 0)
    expect(plus.three).toEqual([1, 0, 0])

    const plusI = gateObservation(ketPlusI(), 'X')
    expectPreservesP(ketPlusI(), plusI.next)
    expectBloch(plusI.next, 0, -1, 0)
    expect(plusI.three).toEqual([0, 0, 1])
    expectProbsFromRho(plusI.next)
  })

  it('flips qz on a mixed Z-biased state and swaps populations', () => {
    const state = createQubit(0, 0, 0.4)
    const { next, vector, probs } = gateObservation(state, 'X')
    expectPreservesP(state, next)
    expect(vector.qz).toBeCloseTo(-0.4, D)
    expect(probs.p0).toBeCloseTo(0.3, D)
    expect(probs.p1).toBeCloseTo(0.7, D)
    expectThreeMapsFromQuantum(next)
  })

  it('leaves the p = 0 center state mixed', () => {
    const { next, probs } = gateObservation(ket0(0), 'X')
    expect(next.p).toBe(0)
    expect(probs).toEqual({ p0: 0.5, p1: 0.5 })
  })
})

describe('gate Y transformations', () => {
  it('sends |0> to |1> and |1> to |0> on the Bloch sphere', () => {
    expectBloch(gateObservation(ket0(), 'Y').next, 0, 0, -1)
    expectBloch(gateObservation(ket1(), 'Y').next, 0, 0, 1)
    expectThreeMapsFromQuantum(gateObservation(ket0(), 'Y').next)
  })

  it('maps |+> to |-> and leaves |+i> on +Y with p preserved', () => {
    const plus = gateObservation(ketPlus(), 'Y')
    expectPreservesP(ketPlus(), plus.next)
    expectBloch(plus.next, -1, 0, 0)
    expect(plus.three).toEqual([-1, 0, 0])

    const plusI = gateObservation(ketPlusI(), 'Y')
    expectPreservesP(ketPlusI(), plusI.next)
    expectBloch(plusI.next, 0, 1, 0)
    expect(plusI.three).toEqual([0, 0, -1])
    expectProbsFromRho(plusI.next)
  })

  it('preserves mixed and center purity', () => {
    const mixed = createQubit(0.9, 2.2, 0.55)
    expectPreservesP(mixed, applyGate(mixed, 'Y'))
    expect(applyGate(ketPlus(0), 'Y').p).toBe(0)
    expect(probabilities(applyGate(ketPlus(0), 'Y'))).toEqual({ p0: 0.5, p1: 0.5 })
  })
})

describe('gate Z transformations', () => {
  it('leaves |0> and |1> projectors unchanged', () => {
    for (const state of [ket0(), ket1()]) {
      const { next, rho, probs } = gateObservation(state, 'Z')
      expect(rhoClose(rho, densityMatrix(state))).toBe(true)
      expect(probs).toEqual(probabilities(state))
      expectPreservesP(state, next)
    }
  })

  it('sends |+> to |-> and |+i> to |-i>', () => {
    expectBloch(gateObservation(ketPlus(), 'Z').next, -1, 0, 0)
    expect(gateObservation(ketPlus(), 'Z').three).toEqual([-1, 0, 0])
    expectBloch(gateObservation(ketPlusI(), 'Z').next, 0, -1, 0)
    expect(gateObservation(ketPlusI(), 'Z').three).toEqual([0, 0, 1])
  })

  it('preserves p on mixed and center states', () => {
    const mixed = createQubit(Math.PI / 3, 1.2, 0.3)
    expectPreservesP(mixed, applyGate(mixed, 'Z'))
    expect(applyGate(ket1(0), 'Z').p).toBe(0)
  })
})

describe('gate H transformations', () => {
  it('swaps |0> with |+> including Three.js mapping and equal probabilities', () => {
    const from0 = gateObservation(ket0(), 'H')
    expectBloch(from0.next, 1, 0, 0)
    expect(from0.three).toEqual([1, 0, 0])
    expect(from0.probs.p0).toBeCloseTo(0.5, D)
    expect(from0.probs.p1).toBeCloseTo(0.5, D)
    expectHermitianTraceOne(from0.next)

    const fromPlus = gateObservation(ketPlus(), 'H')
    expectBloch(fromPlus.next, 0, 0, 1)
    expect(fromPlus.three).toEqual([0, 1, 0])
    expect(fromPlus.probs).toEqual({ p0: 1, p1: 0 })
  })

  it('maps |1> to |-> and |+i> with a Y sign flip', () => {
    expectBloch(gateObservation(ket1(), 'H').next, -1, 0, 0)
    expect(gateObservation(ket1(), 'H').three).toEqual([-1, 0, 0])
    const plusI = gateObservation(ketPlusI(), 'H')
    expectBloch(plusI.next, 0, -1, 0)
    expect(plusI.three).toEqual([0, 0, 1])
    expectProbsFromRho(plusI.next)
  })

  it('preserves mixed p and leaves the center state at 50/50', () => {
    const mixed = createQubit(0.4, 0.2, 0.4)
    const after = applyGate(mixed, 'H')
    expectPreservesP(mixed, after)
    expect(blochVector(after).qx).toBeCloseTo(blochVector(mixed).qz, D)
    expect(applyGate(ket0(0), 'H').p).toBe(0)
    expect(probabilities(applyGate(ket0(0), 'H'))).toEqual({ p0: 0.5, p1: 0.5 })
  })
})

describe('gate S transformations', () => {
  it('is identity on |0> and |1> density matrices', () => {
    for (const state of [ket0(), ket1()]) {
      expect(rhoClose(densityMatrix(applyGate(state, 'S')), densityMatrix(state))).toBe(true)
      expectPreservesP(state, applyGate(state, 'S'))
    }
  })

  it('sends |+> to |+i> and advances φ by π/2', () => {
    const after = gateObservation(ketPlus(), 'S')
    expectBloch(after.next, 0, 1, 0)
    expect(after.three).toEqual([0, 0, -1])
    expect(after.probs.p0).toBeCloseTo(0.5, D)
    expectThreeMapsFromQuantum(after.next)
  })

  it('preserves mixed and center purity', () => {
    const mixed = createQubit(Math.PI / 2, 0.1, 0.6)
    expectPreservesP(mixed, applyGate(mixed, 'S'))
    expect(applyGate(ketPlus(0), 'S').p).toBe(0)
  })
})

describe('gate T transformations', () => {
  it('leaves |0> and |1> projectors unchanged', () => {
    for (const state of [ket0(), ket1()]) {
      expect(rhoClose(densityMatrix(applyGate(state, 'T')), densityMatrix(state))).toBe(true)
    }
  })

  it('rotates |+> by π/4 in φ and maps Three.js tip onto the equator', () => {
    const after = gateObservation(ketPlus(), 'T')
    expect(after.next.p).toBeCloseTo(1, D)
    expectBloch(after.next, Math.SQRT1_2, Math.SQRT1_2, 0)
    expect(after.three[0]).toBeCloseTo(Math.SQRT1_2, D)
    expect(after.three[1]).toBeCloseTo(0, D)
    expect(after.three[2]).toBeCloseTo(-Math.SQRT1_2, D)
    expectProbsFromRho(after.next)
  })

  it('preserves mixed p and the p = 0 center', () => {
    const mixed = createQubit(1.0, 0.4, 0.25)
    expectPreservesP(mixed, applyGate(mixed, 'T'))
    expect(applyGate(ket1(0), 'T').p).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 2. Multi-gate circuits & mismatch detection
// ---------------------------------------------------------------------------

describe('multi-gate circuit sequences', () => {
  it('returns to the start for H -> H', () => {
    const initial = ket0()
    const result = evaluateCircuit(initial, ['H', 'H'])
    expectBloch(result.final, 0, 0, 1)
    expect(result.steps).toHaveLength(2)
    expectBloch(result.steps[0]!.state, 1, 0, 0)
  })

  it('returns to the start for X -> X', () => {
    const initial = ket0(0.7)
    const result = evaluateCircuit(initial, ['X', 'X'])
    expectBloch(result.final, 0, 0, 0.7)
    expect(result.final.p).toBeCloseTo(0.7, D)
  })

  it('returns to the start for Y -> Y', () => {
    const initial = ketPlus()
    expectBloch(evaluateCircuit(initial, ['Y', 'Y']).final, 1, 0, 0)
  })

  it('returns to the start for Z -> Z', () => {
    const initial = ketPlusI()
    expectBloch(evaluateCircuit(initial, ['Z', 'Z']).final, 0, 1, 0)
  })

  it('implements H -> Z -> H as X on |0>', () => {
    const result = evaluateCircuit(ket0(), ['H', 'Z', 'H'])
    expectBloch(result.final, 0, 0, -1)
    expect(probabilities(result.final)).toEqual({ p0: 0, p1: 1 })
    expect(stateToThree(result.final)).toEqual([0, -1, 0])
    expect(result.steps.map((step) => step.gate)).toEqual(['H', 'Z', 'H'])
  })

  it('runs H -> S -> T from |0> onto the equatorial arc', () => {
    const result = evaluateCircuit(ket0(), ['H', 'S', 'T'])
    expect(result.final.p).toBeCloseTo(1, D)
    expect(result.steps).toHaveLength(3)
    expectBloch(result.steps[0]!.state, 1, 0, 0)
    expectBloch(result.steps[1]!.state, 0, 1, 0)
    const final = blochVector(result.final)
    expect(final.qz).toBeCloseTo(0, D)
    expect(Math.hypot(final.qx, final.qy)).toBeCloseTo(1, D)
    expectThreeMapsFromQuantum(result.final)
  })

  it('preserves purity through a mixed-state multi-gate circuit', () => {
    const initial = createQubit(0.8, 1.4, 0.35)
    const gates: GateName[] = ['H', 'S', 'X', 'T', 'Y', 'Z']
    const result = evaluateCircuit(initial, gates)
    expect(result.steps).toHaveLength(gates.length)
    for (const step of result.steps) {
      expect(step.state.p).toBeCloseTo(0.35, D)
      expectProbsFromRho(step.state)
      expectThreeMapsFromQuantum(step.state)
    }
    expect(result.final.p).toBeCloseTo(0.35, D)
  })
})

describe('mismatch detection (negative assertions)', () => {
  it('rejects claiming H|0> is still |0>', () => {
    const after = applyGate(ket0(), 'H')
    expect(blochVector(after).qz).not.toBeCloseTo(1, D)
    expect(probabilities(after).p0).not.toBeCloseTo(1, D)
    expect(rhoClose(densityMatrix(after), densityMatrix(ket0()))).toBe(false)
  })

  it('rejects a swapped probability pair for X|0>', () => {
    const probs = probabilities(applyGate(ket0(), 'X'))
    expect(probs).toEqual({ p0: 0, p1: 1 })
    expect(probs.p0).not.toBeCloseTo(1, D)
    expect(probs.p1).not.toBeCloseTo(0, D)
  })

  it('rejects a broken Three.js mapping that forgets the -qy rule', () => {
    const state = ketPlusI()
    const { qx, qy, qz } = blochVector(state)
    const correct = quantumToThree(qx, qy, qz)
    const broken = [qx, qz, qy] as const
    expect(correct).toEqual([0, 0, -1])
    expect(broken).not.toEqual(correct)
    expect(stateToThree(state)).not.toEqual(broken)
  })

  it('rejects treating H -> S as H -> T', () => {
    const hs = evaluateCircuit(ket0(), ['H', 'S']).final
    const ht = evaluateCircuit(ket0(), ['H', 'T']).final
    expect(blochVector(hs).qy).toBeCloseTo(1, D)
    expect(blochVector(ht).qy).not.toBeCloseTo(1, D)
    expect(rhoClose(densityMatrix(hs), densityMatrix(ht))).toBe(false)
  })

  it('rejects claiming X -> X moves a pure |0> off the north pole', () => {
    const final = evaluateCircuit(ket0(), ['X', 'X']).final
    expectBloch(final, 0, 0, 1)
    expect(blochVector(final).qz).not.toBeCloseTo(-1, D)
  })
})

// ---------------------------------------------------------------------------
// 3. Play animation & trajectory frames
// ---------------------------------------------------------------------------

describe('Play animation frames for H then S', () => {
  it('starts at |0>, ends at |+i>, and stays finite at every frame', () => {
    const frames = animationFrames(ket0(), ['H', 'S'], 12)
    expectBloch(frames[0]!.state, 0, 0, 1)
    expectBloch(frames[frames.length - 1]!.state, 0, 1, 0)
    for (const frame of frames) {
      expect(frame.state.p).toBeGreaterThanOrEqual(0)
      expect(frame.state.p).toBeLessThanOrEqual(1)
      expect(frame.p0).toBeGreaterThanOrEqual(0)
      expect(frame.p1).toBeLessThanOrEqual(1)
      expect(frame.three.every((value) => Number.isFinite(value))).toBe(true)
    }
  })

  it('keeps the trail length growing as gates accumulate', () => {
    const lengths = growingTrailLengths(ket0(), ['H', 'S'], 16)
    expect(lengths[0]).toBeCloseTo(0, D)
    expect(lengths[1]!).toBeGreaterThan(0.5)
    expect(lengths[2]!).toBeGreaterThan(lengths[1]!)
  })
})

describe('Play animation frames for X then H', () => {
  it('visits |1> after X and lands on |-> after H', () => {
    const frames = animationFrames(ket0(), ['X', 'H'], 10)
    expectBloch(frames[0]!.state, 0, 0, 1)
    const afterX = evaluateCircuit(ket0(), ['X']).final
    expectBloch(afterX, 0, 0, -1)
    expectBloch(frames[frames.length - 1]!.state, -1, 0, 0)
    expect(frames[frames.length - 1]!.three).toEqual([-1, 0, 0])
  })

  it('keeps p and probabilities inside [0, 1] on a mixed input', () => {
    const frames = animationFrames(createQubit(0.5, 0.1, 0.4), ['X', 'H'], 14)
    for (const frame of frames) {
      expect(frame.state.p).toBeGreaterThanOrEqual(0)
      expect(frame.state.p).toBeLessThanOrEqual(1)
      expect(frame.p0 + frame.p1).toBeCloseTo(1, 5)
      expect(frame.three.every((value) => !Number.isNaN(value))).toBe(true)
    }
  })
})

describe('Play animation frames for H -> Z -> H', () => {
  it('records intermediate |+> and |-> tips before finishing at |1>', () => {
    const result = evaluateCircuit(ket0(), ['H', 'Z', 'H'])
    expectBloch(result.steps[0]!.state, 1, 0, 0)
    expectBloch(result.steps[1]!.state, -1, 0, 0)
    expectBloch(result.final, 0, 0, -1)

    const { start, mid, end } = sampleArcEndpoints(result.steps[0]!.state, result.steps[1]!.state)
    expect(start[0]).toBeCloseTo(1, D)
    expect(end[0]).toBeCloseTo(-1, D)
    expect(mid.every((value) => Number.isFinite(value))).toBe(true)

    const frames = animationFrames(ket0(), ['H', 'Z', 'H'], 8)
    expect(frames.length).toBeGreaterThan(8)
    expect(frames.every((frame) => frame.state.p >= 0 && frame.state.p <= 1)).toBe(true)
  })
})

describe('Play animation frames for a longer mixed circuit', () => {
  it('never emits NaN coordinates along T -> S -> H -> X', () => {
    const initial = createQubit(0.7, 2.0, 0.5)
    const gates: GateName[] = ['T', 'S', 'H', 'X']
    const frames = animationFrames(initial, gates, 10)
    const trail = circuitTrail(initial, gates, 10)
    expect(trail.length).toBeGreaterThan(gates.length)
    for (const frame of frames) {
      expect(frame.three.every((value) => Number.isFinite(value) && !Number.isNaN(value))).toBe(true)
      expect(frame.p0).toBeGreaterThanOrEqual(0)
      expect(frame.p1).toBeLessThanOrEqual(1)
      expect(frame.state.p).toBeCloseTo(0.5, D)
    }
    const final = evaluateCircuit(initial, gates).final
    const tip = blochVector(final)
    expectBloch(frames[frames.length - 1]!.state, tip.qx, tip.qy, tip.qz)
  })
})

// ---------------------------------------------------------------------------
// 4. Grover / interference verification
// ---------------------------------------------------------------------------

describe('2-qubit Grover search over 4 basis states', () => {
  it('amplifies the marked target above the uniform 1/4 baseline', () => {
    for (const target of [0, 1, 2, 3] as const) {
      const { before, after, totalProb } = groverSearchOnce(target)
      expect(before).toBeCloseTo(0.25, D)
      expect(after).toBeGreaterThan(before)
      expect(after).toBeCloseTo(1, 5)
      expect(totalProb).toBeCloseTo(1, D)
    }
  })

  it('boosts |11> specifically after one oracle + diffusion step', () => {
    const marked = 3 as const
    const { before, after, state } = groverSearchOnce(marked)
    expect(before).toBeCloseTo(0.25, D)
    expect(after).toBeGreaterThan(0.9)
    const others =
      state[0].re ** 2 +
      state[0].im ** 2 +
      state[1].re ** 2 +
      state[1].im ** 2 +
      state[2].re ** 2 +
      state[2].im ** 2
    expect(others).toBeLessThan(0.1)
  })
})

describe('single-qubit phase amplification / interference', () => {
  it('implements H -> Z -> H as bit-flip interference from |0> to |1>', () => {
    const result = evaluateCircuit(ket0(), ['H', 'Z', 'H'])
    expectBloch(result.final, 0, 0, -1)
    expect(probabilities(result.final)).toEqual({ p0: 0, p1: 1 })
    expect(stateToThree(result.final)).toEqual([0, -1, 0])
    expect(result.final.p).toBeCloseTo(1, D)
  })

  it('updates mixed-state probabilities under the same interference circuit', () => {
    const initial = createQubit(0, 0, 0.4)
    const before = probabilities(initial)
    const final = evaluateCircuit(initial, ['H', 'Z', 'H']).final
    const after = probabilities(final)
    expect(before.p0).toBeCloseTo(0.7, D)
    expect(after.p0).toBeCloseTo(0.3, D)
    expect(after.p1).toBeCloseTo(0.7, D)
    expect(final.p).toBeCloseTo(0.4, D)
    expectThreeMapsFromQuantum(final)
  })

  it('rejects a false claim that H -> Z -> H leaves |0> unchanged', () => {
    const final = evaluateCircuit(ket0(), ['H', 'Z', 'H']).final
    expect(probabilities(final).p0).not.toBeCloseTo(1, D)
    expect(blochVector(final).qz).not.toBeCloseTo(1, D)
  })
})
