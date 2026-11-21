/** Single-qubit state on the Bloch ball: purity p is the vector length. */

const PI = Math.PI
const TAU = 2 * PI
const HALF_PI = PI / 2
const THREE_HALF_PI = (3 * PI) / 2
const ORIGIN_EPS = 1e-12

export const GATE_NAMES = ['I', 'X', 'Y', 'Z', 'H', 'S', 'T'] as const

export type GateName = (typeof GATE_NAMES)[number]

export type Complex = {
  re: number
  im: number
}

export type Matrix2 = [
  [Complex, Complex],
  [Complex, Complex],
]

export type QubitState = {
  theta: number
  phi: number
  p: number
}

export type BlochVector = {
  qx: number
  qy: number
  qz: number
}

export type BornProbabilities = {
  /** P(|0>) = rho_00 */
  p0: number
  /** P(|1>) = rho_11 */
  p1: number
}

export type Measurement = {
  outcome: 0 | 1
  state: QubitState
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min === 0 ? 0 : min
  const next = Math.min(max, Math.max(min, value))
  return next === 0 ? 0 : next
}

function normalizePhi(phi: number): number {
  if (!Number.isFinite(phi)) return 0
  let wrapped = phi % TAU
  if (wrapped < 0) wrapped += TAU
  if (wrapped === 0 || wrapped === TAU) return 0
  return wrapped
}

/** Exact values at the cardinal angles. libm sin/cos miss these by an ulp. */
function sin(angle: number): number {
  if (angle === 0 || angle === PI) return 0
  if (angle === HALF_PI) return 1
  if (angle === THREE_HALF_PI) return -1
  return Math.sin(angle)
}

function cos(angle: number): number {
  if (angle === 0) return 1
  if (angle === HALF_PI || angle === THREE_HALF_PI) return 0
  if (angle === PI) return -1
  return Math.cos(angle)
}

function complex(re: number, im = 0): Complex {
  return {
    re: re === 0 ? 0 : re,
    im: im === 0 ? 0 : im,
  }
}

function add(a: Complex, b: Complex): Complex {
  return complex(a.re + b.re, a.im + b.im)
}

function mul(a: Complex, b: Complex): Complex {
  return complex(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re)
}

function conj(value: Complex): Complex {
  return complex(value.re, -value.im)
}

function multiply(a: Matrix2, b: Matrix2): Matrix2 {
  const entry = (row: 0 | 1, col: 0 | 1): Complex =>
    add(mul(a[row][0], b[0][col]), mul(a[row][1], b[1][col]))

  return [
    [entry(0, 0), entry(0, 1)],
    [entry(1, 0), entry(1, 1)],
  ]
}

function dagger(u: Matrix2): Matrix2 {
  return [
    [conj(u[0][0]), conj(u[1][0])],
    [conj(u[0][1]), conj(u[1][1])],
  ]
}

const INV_SQRT2 = Math.SQRT1_2

const UNITARIES: Record<GateName, Matrix2> = {
  I: [
    [complex(1), complex(0)],
    [complex(0), complex(1)],
  ],
  X: [
    [complex(0), complex(1)],
    [complex(1), complex(0)],
  ],
  Y: [
    [complex(0), complex(0, -1)],
    [complex(0, 1), complex(0)],
  ],
  Z: [
    [complex(1), complex(0)],
    [complex(0), complex(-1)],
  ],
  H: [
    [complex(INV_SQRT2), complex(INV_SQRT2)],
    [complex(INV_SQRT2), complex(-INV_SQRT2)],
  ],
  S: [
    [complex(1), complex(0)],
    [complex(0), complex(0, 1)],
  ],
  T: [
    [complex(1), complex(0)],
    [complex(0), complex(INV_SQRT2, INV_SQRT2)],
  ],
}

export function createQubit(theta: number, phi: number, p: number): QubitState {
  return {
    theta: clamp(theta, 0, PI),
    phi: normalizePhi(phi),
    p: clamp(p, 0, 1),
  }
}

export function blochVector(state: QubitState): BlochVector {
  const { theta, phi, p } = createQubit(state.theta, state.phi, state.p)
  const sinTheta = sin(theta)
  return {
    qx: real(p * sinTheta * cos(phi)),
    qy: real(p * sinTheta * sin(phi)),
    qz: real(p * cos(theta)),
  }
}

function real(value: number): number {
  if (!Number.isFinite(value) || value === 0) return 0
  return value
}

/** rho = (I + qx X + qy Y + qz Z) / 2. */
export function densityMatrix(state: QubitState): Matrix2 {
  const { qx, qy, qz } = blochVector(state)
  return [
    [complex((1 + qz) / 2, 0), complex(qx / 2, -qy / 2)],
    [complex(qx / 2, qy / 2), complex((1 - qz) / 2, 0)],
  ]
}

function stateFromDensityMatrix(rho: Matrix2): QubitState {
  const qx = rho[0][1].re + rho[1][0].re
  const qy = rho[1][0].im - rho[0][1].im
  const qz = rho[0][0].re - rho[1][1].re
  const radius = Math.hypot(qx, qy, qz)

  if (!(radius > ORIGIN_EPS)) {
    return { theta: 0, phi: 0, p: 0 }
  }

  const theta = Math.acos(clamp(qz / radius, -1, 1))
  const transverse = Math.hypot(qx, qy)
  const phi = transverse > ORIGIN_EPS ? normalizePhi(Math.atan2(qy, qx)) : 0

  return {
    theta,
    phi,
    p: clamp(radius, 0, 1),
  }
}

/** P(|0>) and P(|1>) are the diagonal entries of rho. */
export function probabilities(state: QubitState): BornProbabilities {
  const rho = densityMatrix(state)
  return {
    p0: clamp(rho[0][0].re, 0, 1),
    p1: clamp(rho[1][1].re, 0, 1),
  }
}

/** rho -> U rho U†, then (theta, phi, p) is read back from the new Bloch vector. */
export function applyGate(state: QubitState, gate: GateName): QubitState {
  const rho = densityMatrix(state)
  const u = UNITARIES[gate]
  return stateFromDensityMatrix(multiply(multiply(u, rho), dagger(u)))
}

/**
 * Computational-basis measurement.
 * A sample in [0, 1) collapses to |0> (p = 1) when sample < P(|0>), and to |1> (p = 1) otherwise.
 */
export function measure(
  state: QubitState,
  random: () => number = Math.random,
): Measurement {
  const outcome: 0 | 1 = random() < probabilities(state).p0 ? 0 : 1
  const collapsed =
    outcome === 0 ? createQubit(0, 0, 1) : createQubit(PI, 0, 1)
  return { outcome, state: collapsed }
}
