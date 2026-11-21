import { describe, expect, it } from 'vitest'
import {
  GATE_NAMES,
  applyGate,
  blochVector,
  createQubit,
  densityMatrix,
  measure,
  probabilities,
} from './qubit.ts'

const DIGITS = 8
const TAU_TWICE = 2 * Math.PI + 0.4

function expectBloch(
  state: ReturnType<typeof createQubit>,
  qx: number,
  qy: number,
  qz: number,
): void {
  const vector = blochVector(state)
  expect(vector.qx).toBeCloseTo(qx, DIGITS)
  expect(vector.qy).toBeCloseTo(qy, DIGITS)
  expect(vector.qz).toBeCloseTo(qz, DIGITS)
}

function expectSamePhysics(
  actual: ReturnType<typeof createQubit>,
  expected: ReturnType<typeof createQubit>,
): void {
  const left = blochVector(actual)
  const right = blochVector(expected)
  expect(left.qx).toBeCloseTo(right.qx, DIGITS)
  expect(left.qy).toBeCloseTo(right.qy, DIGITS)
  expect(left.qz).toBeCloseTo(right.qz, DIGITS)
  expect(actual.p).toBeCloseTo(expected.p, DIGITS)
}

describe('pure states (p = 1)', () => {
  it('represents |0>, |1>, |+>, and |+i> by their projectors', () => {
    const ket0 = createQubit(0, 0, 1)
    const ket1 = createQubit(Math.PI, 0, 1)
    const plus = createQubit(Math.PI / 2, 0, 1)
    const plusI = createQubit(Math.PI / 2, Math.PI / 2, 1)

    expect(ket0).toEqual({ theta: 0, phi: 0, p: 1 })
    expect(blochVector(ket0)).toEqual({ qx: 0, qy: 0, qz: 1 })
    expect(densityMatrix(ket0)).toEqual([
      [
        { re: 1, im: 0 },
        { re: 0, im: 0 },
      ],
      [
        { re: 0, im: 0 },
        { re: 0, im: 0 },
      ],
    ])
    expect(probabilities(ket0)).toEqual({ p0: 1, p1: 0 })

    expect(blochVector(ket1)).toEqual({ qx: 0, qy: 0, qz: -1 })
    expect(densityMatrix(ket1)).toEqual([
      [
        { re: 0, im: 0 },
        { re: 0, im: 0 },
      ],
      [
        { re: 0, im: 0 },
        { re: 1, im: 0 },
      ],
    ])
    expect(probabilities(ket1)).toEqual({ p0: 0, p1: 1 })

    expect(blochVector(plus)).toEqual({ qx: 1, qy: 0, qz: 0 })
    expect(densityMatrix(plus)).toEqual([
      [
        { re: 0.5, im: 0 },
        { re: 0.5, im: 0 },
      ],
      [
        { re: 0.5, im: 0 },
        { re: 0.5, im: 0 },
      ],
    ])
    expect(probabilities(plus)).toEqual({ p0: 0.5, p1: 0.5 })

    expect(blochVector(plusI)).toEqual({ qx: 0, qy: 1, qz: 0 })
    expect(densityMatrix(plusI)).toEqual([
      [
        { re: 0.5, im: 0 },
        { re: 0, im: -0.5 },
      ],
      [
        { re: 0, im: 0.5 },
        { re: 0.5, im: 0 },
      ],
    ])
    expect(probabilities(plusI)).toEqual({ p0: 0.5, p1: 0.5 })
  })

  it('keeps a generic pure state on the unit sphere and reads probabilities from rho', () => {
    const theta = 0.8
    const phi = 1.2
    const state = createQubit(theta, phi, 1)
    const vector = blochVector(state)
    const rho = densityMatrix(state)
    const probs = probabilities(state)

    expect(Math.hypot(vector.qx, vector.qy, vector.qz)).toBeCloseTo(1, DIGITS)
    expect(vector.qx).toBeCloseTo(Math.sin(theta) * Math.cos(phi), DIGITS)
    expect(vector.qy).toBeCloseTo(Math.sin(theta) * Math.sin(phi), DIGITS)
    expect(vector.qz).toBeCloseTo(Math.cos(theta), DIGITS)
    expect(probs.p0).toBe(rho[0][0].re)
    expect(probs.p1).toBe(rho[1][1].re)
    expect(probs.p0).toBeCloseTo((1 + vector.qz) / 2, DIGITS)
    expect(probs.p1).toBeCloseTo((1 - vector.qz) / 2, DIGITS)
    expect(probs.p0 + probs.p1).toBeCloseTo(1, DIGITS)
    expect(rho[1][0].re).toBeCloseTo(rho[0][1].re, DIGITS)
    expect(rho[1][0].im).toBeCloseTo(-rho[0][1].im, DIGITS)
  })

  it('clamps purity onto [0, 1] and wraps the angles', () => {
    expect(createQubit(0.4, 0.2, 1.7).p).toBe(1)
    expect(createQubit(0.4, 0.2, -0.4).p).toBe(0)
    expect(createQubit(-1, 0, 1).theta).toBe(0)
    expect(createQubit(9, 0, 1).theta).toBe(Math.PI)
    expect(createQubit(1, -Math.PI / 2, 1).phi).toBeCloseTo((3 * Math.PI) / 2, DIGITS)
    expect(createQubit(1, TAU_TWICE, 1).phi).toBeCloseTo(0.4, DIGITS)
    expect(createQubit(1, 2 * Math.PI, 1).phi).toBe(0)

    const unphysical = densityMatrix({ theta: 0, phi: 0, p: 5 })
    expect(unphysical[0][0]).toEqual({ re: 1, im: 0 })
    expect(unphysical[1][1]).toEqual({ re: 0, im: 0 })
  })
})

describe('center state (p = 0)', () => {
  it('is the completely mixed state with 50/50 probabilities for every angle', () => {
    const samples = [
      createQubit(0, 0, 0),
      createQubit(Math.PI, 1.7, 0),
      createQubit(0.4, 2.2, 0),
    ]

    for (const state of samples) {
      expect(state.p).toBe(0)
      expect(blochVector(state)).toEqual({ qx: 0, qy: 0, qz: 0 })
      expect(densityMatrix(state)).toEqual([
        [
          { re: 0.5, im: 0 },
          { re: 0, im: 0 },
        ],
        [
          { re: 0, im: 0 },
          { re: 0.5, im: 0 },
        ],
      ])
      expect(probabilities(state)).toEqual({ p0: 0.5, p1: 0.5 })
    }
  })
})

describe('mixed states (0 < p < 1)', () => {
  it('builds a partially polarized rho whose probabilities come from the diagonal', () => {
    const theta = Math.PI / 3
    const phi = Math.PI / 2
    const p = 0.5
    const state = createQubit(theta, phi, p)
    const vector = blochVector(state)
    const rho = densityMatrix(state)
    const probs = probabilities(state)

    expect(state.p).toBeGreaterThan(0)
    expect(state.p).toBeLessThan(1)
    expect(vector.qx).toBe(0)
    expect(vector.qy).toBeCloseTo((Math.sqrt(3) / 4), DIGITS)
    expect(vector.qz).toBeCloseTo(0.25, DIGITS)
    expect(Math.hypot(vector.qx, vector.qy, vector.qz)).toBeCloseTo(p, DIGITS)

    expect(rho[0][0].re).toBeCloseTo((1 + vector.qz) / 2, DIGITS)
    expect(rho[1][1].re).toBeCloseTo((1 - vector.qz) / 2, DIGITS)
    expect(rho[0][1].re).toBeCloseTo(vector.qx / 2, DIGITS)
    expect(rho[0][1].im).toBeCloseTo(-vector.qy / 2, DIGITS)
    expect(rho[1][0].re).toBeCloseTo(vector.qx / 2, DIGITS)
    expect(rho[1][0].im).toBeCloseTo(vector.qy / 2, DIGITS)
    expect(probs.p0).toBeCloseTo(rho[0][0].re, DIGITS)
    expect(probs.p1).toBeCloseTo(rho[1][1].re, DIGITS)
    expect(probs).toEqual({ p0: 0.625, p1: 0.375 })
    expect(probs.p0).not.toBe(probs.p1)
  })

  it('scales coherence with p while keeping the same Bloch direction', () => {
    const theta = Math.PI / 3
    const phi = Math.PI / 2
    const pureState = createQubit(theta, phi, 1)
    const mixedState = createQubit(theta, phi, 0.5)
    const pure = densityMatrix(pureState)
    const mixed = densityMatrix(mixedState)
    const probs = probabilities(mixedState)

    expect(mixed[0][1].re).toBeCloseTo(pure[0][1].re * 0.5, DIGITS)
    expect(mixed[0][1].im).toBeCloseTo(pure[0][1].im * 0.5, DIGITS)
    expect(probs.p0).toBeGreaterThan(0)
    expect(probs.p0).toBeLessThan(1)
    expect(probs.p1).toBeGreaterThan(0)
    expect(probs.p1).toBeLessThan(1)
    expect(probs.p0).toBeCloseTo((1 + blochVector(mixedState).qz) / 2, DIGITS)
    expect(probs.p1).toBeCloseTo((1 - blochVector(mixedState).qz) / 2, DIGITS)
  })
})

describe('gate identities', () => {
  const tilted = createQubit(0.9, 1.3, 0.55)

  it('H^2 = I on a tilted mixed state, and H swaps |0> with |+>', () => {
    expectSamePhysics(applyGate(applyGate(tilted, 'H'), 'H'), tilted)
    expect(applyGate(createQubit(0, 0, 1), 'H')).toEqual(createQubit(Math.PI / 2, 0, 1))
    expect(applyGate(createQubit(Math.PI / 2, 0, 1), 'H')).toEqual(createQubit(0, 0, 1))
  })

  it('X^2 = I on a tilted mixed state, and X swaps |0> with |1>', () => {
    expectSamePhysics(applyGate(applyGate(tilted, 'X'), 'X'), tilted)
    expect(applyGate(createQubit(0, 0, 1), 'X')).toEqual(createQubit(Math.PI, 0, 1))
    expect(applyGate(createQubit(Math.PI, 0, 1), 'X')).toEqual(createQubit(0, 0, 1))
  })

  it('applies Y, Z, S, and T through U rho U†', () => {
    const north = createQubit(0, 0, 1)
    const plus = createQubit(Math.PI / 2, 0, 1)
    const minus = createQubit(Math.PI / 2, Math.PI, 1)
    const plusI = createQubit(Math.PI / 2, Math.PI / 2, 1)

    expect(applyGate(north, 'I')).toEqual(north)
    expect(applyGate(north, 'Y')).toEqual(createQubit(Math.PI, 0, 1))
    expect(applyGate(plus, 'Y')).toEqual(minus)
    expect(applyGate(north, 'Z')).toEqual(north)
    expect(applyGate(plus, 'Z')).toEqual(minus)
    expect(applyGate(plus, 'S')).toEqual(plusI)
    expectSamePhysics(applyGate(plus, 'T'), createQubit(Math.PI / 2, Math.PI / 4, 1))

    const phase = createQubit(Math.PI / 2, 0.3, 0.8)
    expect(applyGate(phase, 'S').phi).toBeCloseTo(0.3 + Math.PI / 2, DIGITS)
    expect(applyGate(phase, 'T').phi).toBeCloseTo(0.3 + Math.PI / 4, DIGITS)
    expectBloch(
      applyGate(plus, 'T'),
      Math.SQRT1_2,
      Math.SQRT1_2,
      0,
    )
  })

  it('does not mutate the input state', () => {
    const state = createQubit(0.4, 0.5, 0.6)
    const snapshot = { ...state }
    applyGate(state, 'H')
    expect(state).toEqual(snapshot)
  })
})

describe('gates preserve p', () => {
  const samples = [
    createQubit(0, 0, 0),
    createQubit(Math.PI, 1.2, 0),
    createQubit(0, 0, 0.4),
    createQubit(Math.PI / 2, Math.PI / 7, 0.5),
    createQubit(0.9, 1.3, 0.55),
    createQubit(2.2, 5.5, 1),
    createQubit(0, 0, 1),
    createQubit(Math.PI, 0, 1),
  ]

  it.each(GATE_NAMES)('%s keeps p inside [0, 1] and unchanged', (gate) => {
    for (const state of samples) {
      const next = applyGate(state, gate)
      expect(next.p).toBeGreaterThanOrEqual(0)
      expect(next.p).toBeLessThanOrEqual(1)
      expect(next.p).toBeCloseTo(state.p, DIGITS)
    }
  })

  it('moves a Z-biased mixed state onto X under H without changing p', () => {
    const state = createQubit(0, 0, 0.4)
    const next = applyGate(state, 'H')
    expect(next.p).toBeCloseTo(0.4, DIGITS)
    expectBloch(next, 0.4, 0, 0)
    expect(probabilities(state)).toEqual({ p0: 0.7, p1: 0.3 })
  })

  it('flips a Z-biased mixed state under X without changing p', () => {
    const state = createQubit(0, 0, 0.4)
    const next = applyGate(state, 'X')
    expect(next.p).toBeCloseTo(0.4, DIGITS)
    expectBloch(next, 0, 0, -0.4)
    expect(probabilities(next).p0).toBeCloseTo(0.3, DIGITS)
    expect(probabilities(next).p1).toBeCloseTo(0.7, DIGITS)
  })
})

describe('measurement', () => {
  it('collapses to |0> or |1> with p = 1', () => {
    const state = createQubit(Math.PI / 3, 0.4, 0.5)
    const snapshot = { ...state }

    const asZero = measure(state, () => 0)
    const asOne = measure(state, () => 0.999)

    expect(state).toEqual(snapshot)
    expect(asZero.outcome).toBe(0)
    expect(asZero.state).toEqual(createQubit(0, 0, 1))
    expect(probabilities(asZero.state)).toEqual({ p0: 1, p1: 0 })
    expect(asOne.outcome).toBe(1)
    expect(asOne.state).toEqual(createQubit(Math.PI, 0, 1))
    expect(probabilities(asOne.state)).toEqual({ p0: 0, p1: 1 })
  })

  it('uses P(|0>) as the threshold, including the 50/50 center', () => {
    const center = createQubit(1.2, 2.4, 0)
    expect(measure(center, () => 0.49).outcome).toBe(0)
    expect(measure(center, () => 0.5).outcome).toBe(1)
    expect(measure(center, () => 0).state.p).toBe(1)
    expect(measure(center, () => 0.5).state.p).toBe(1)

    const biased = createQubit(0, 0, 0.5)
    expect(probabilities(biased)).toEqual({ p0: 0.75, p1: 0.25 })
    expect(measure(biased, () => 0.749999).outcome).toBe(0)
    expect(measure(biased, () => 0.75).outcome).toBe(1)

    expect(measure(createQubit(0, 0, 1), () => 0.999).outcome).toBe(0)
    expect(measure(createQubit(Math.PI, 0, 1), () => 0).outcome).toBe(1)
  })
})
