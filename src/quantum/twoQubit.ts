/**
 * Two-qubit density-matrix engine.
 * Basis order: |00>, |01>, |10>, |11> (qubit 0 is the high bit).
 */

import {
  createQubit,
  type BlochVector,
  type Complex,
  type GateName,
  type Matrix2,
  type QubitState,
} from './qubit.ts'

export type Matrix4 = [
  [Complex, Complex, Complex, Complex],
  [Complex, Complex, Complex, Complex],
  [Complex, Complex, Complex, Complex],
  [Complex, Complex, Complex, Complex],
]

export type TwoQubitState = {
  rho: Matrix4
}

export type Wire = 0 | 1

export type JointProbabilities = {
  p00: number
  p01: number
  p10: number
  p11: number
}

export type ReducedQubit = {
  state: QubitState
  vector: BlochVector
  purity: number
}

const ORIGIN_EPS = 1e-12
const INV_SQRT2 = Math.SQRT1_2

function c(re: number, im = 0): Complex {
  return { re: re === 0 ? 0 : re, im: im === 0 ? 0 : im }
}

function add(a: Complex, b: Complex): Complex {
  return c(a.re + b.re, a.im + b.im)
}

function mul(a: Complex, b: Complex): Complex {
  return c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re)
}

function conj(value: Complex): Complex {
  return c(value.re, -value.im)
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  const next = Math.min(1, Math.max(0, value))
  return next === 0 ? 0 : next
}

function zero4(): Matrix4 {
  const z = c(0)
  return [
    [z, z, z, z],
    [z, z, z, z],
    [z, z, z, z],
    [z, z, z, z],
  ]
}

function identity4(): Matrix4 {
  const m = zero4()
  m[0][0] = c(1)
  m[1][1] = c(1)
  m[2][2] = c(1)
  m[3][3] = c(1)
  return m
}

function multiply4(a: Matrix4, b: Matrix4): Matrix4 {
  const out = zero4()
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      let sum = c(0)
      for (let k = 0; k < 4; k += 1) {
        sum = add(sum, mul(a[row]![k]!, b[k]![col]!))
      }
      out[row]![col] = sum
    }
  }
  return out
}

function dagger4(u: Matrix4): Matrix4 {
  const out = zero4()
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      out[row]![col] = conj(u[col]![row]!)
    }
  }
  return out
}

function applyUnitary(rho: Matrix4, u: Matrix4): Matrix4 {
  return multiply4(multiply4(u, rho), dagger4(u))
}

const SINGLE: Record<GateName, Matrix2> = {
  I: [
    [c(1), c(0)],
    [c(0), c(1)],
  ],
  X: [
    [c(0), c(1)],
    [c(1), c(0)],
  ],
  Y: [
    [c(0), c(0, -1)],
    [c(0, 1), c(0)],
  ],
  Z: [
    [c(1), c(0)],
    [c(0), c(-1)],
  ],
  H: [
    [c(INV_SQRT2), c(INV_SQRT2)],
    [c(INV_SQRT2), c(-INV_SQRT2)],
  ],
  S: [
    [c(1), c(0)],
    [c(0), c(0, 1)],
  ],
  T: [
    [c(1), c(0)],
    [c(0), c(INV_SQRT2, INV_SQRT2)],
  ],
}

/** Kronecker product A ⊗ B for 2×2 matrices → 4×4. */
export function kronecker(a: Matrix2, b: Matrix2): Matrix4 {
  const out = zero4()
  for (let i = 0; i < 2; i += 1) {
    for (let j = 0; j < 2; j += 1) {
      for (let k = 0; k < 2; k += 1) {
        for (let l = 0; l < 2; l += 1) {
          out[2 * i + k]![2 * j + l] = mul(a[i]![j]!, b[k]![l]!)
        }
      }
    }
  }
  return out
}

function projectorKet(index: 0 | 1 | 2 | 3): Matrix4 {
  const rho = zero4()
  rho[index]![index] = c(1)
  return rho
}

/** |00><00| — pure product ground state. */
export function createTwoQubit(): TwoQubitState {
  return { rho: projectorKet(0) }
}

/** Pure product |ψ⟩⊗|φ⟩ from two Bloch states. */
export function productState(q0: QubitState, q1: QubitState): TwoQubitState {
  const a = amplitudesFromQubit(q0)
  const b = amplitudesFromQubit(q1)
  const amps: Complex[] = [
    mul(a[0], b[0]),
    mul(a[0], b[1]),
    mul(a[1], b[0]),
    mul(a[1], b[1]),
  ]
  return { rho: projectorFromAmplitudes(amps) }
}

function amplitudesFromQubit(state: QubitState): [Complex, Complex] {
  const theta = state.theta
  const phi = state.phi
  const p = clamp01(state.p)
  // For product construction we use the pure direction on the sphere when p>0,
  // and fall back to |0> when p=0 (maximally mixed is not a pure ket).
  if (p <= ORIGIN_EPS) return [c(1), c(0)]
  const half = theta / 2
  return [
    c(Math.cos(half)),
    c(Math.sin(half) * Math.cos(phi), Math.sin(half) * Math.sin(phi)),
  ]
}

function projectorFromAmplitudes(amps: Complex[]): Matrix4 {
  const rho = zero4()
  for (let i = 0; i < 4; i += 1) {
    for (let j = 0; j < 4; j += 1) {
      rho[i]![j] = mul(amps[i]!, conj(amps[j]!))
    }
  }
  return rho
}

/** Bell |Φ+⟩ = (|00⟩+|11⟩)/√2. */
export function bellPhiPlus(): TwoQubitState {
  return { rho: projectorFromAmplitudes([c(INV_SQRT2), c(0), c(0), c(INV_SQRT2)]) }
}

export function applyLocalGate(
  state: TwoQubitState,
  gate: GateName,
  wire: Wire,
): TwoQubitState {
  const u = SINGLE[gate]
  const eye: Matrix2 = [
    [c(1), c(0)],
    [c(0), c(1)],
  ]
  const full = wire === 0 ? kronecker(u, eye) : kronecker(eye, u)
  return { rho: applyUnitary(state.rho, full) }
}

/**
 * CNOT on the computational basis.
 * control=0,target=1 is the textbook CNOT; the swapped case uses the other wiring.
 */
export function applyCnot(
  state: TwoQubitState,
  control: Wire = 0,
  target: Wire = 1,
): TwoQubitState {
  if (control === target) return state
  const u = identity4()
  if (control === 0 && target === 1) {
    // Swap |10> ↔ |11>
    u[2][2] = c(0)
    u[3][3] = c(0)
    u[2][3] = c(1)
    u[3][2] = c(1)
  } else {
    // control=1, target=0: swap |01> ↔ |11>
    u[1][1] = c(0)
    u[3][3] = c(0)
    u[1][3] = c(1)
    u[3][1] = c(1)
  }
  return { rho: applyUnitary(state.rho, u) }
}

export function jointProbabilities(state: TwoQubitState): JointProbabilities {
  const rho = state.rho
  return {
    p00: clamp01(rho[0][0].re),
    p01: clamp01(rho[1][1].re),
    p10: clamp01(rho[2][2].re),
    p11: clamp01(rho[3][3].re),
  }
}

/** Tr(ρ²) for the joint state. */
export function twoQubitPurity(state: TwoQubitState): number {
  return clamp01(traceSquare4(state.rho))
}

function traceSquare4(rho: Matrix4): number {
  let sum = 0
  for (let i = 0; i < 4; i += 1) {
    for (let j = 0; j < 4; j += 1) {
      const a = rho[i]![j]!
      const b = rho[j]![i]!
      // (ρ²)_ii contribution uses Σ_j ρ_ij ρ_ji
      sum += a.re * b.re - a.im * b.im
    }
  }
  return sum
}

/**
 * Partial trace over the other qubit.
 * keep=0 → ρ_A = Tr_B(ρ), keep=1 → ρ_B = Tr_A(ρ).
 */
export function partialTrace(state: TwoQubitState, keep: Wire): Matrix2 {
  const rho = state.rho
  if (keep === 0) {
    // Trace out qubit 1: blocks for |0>_B and |1>_B
    return [
      [add(rho[0][0], rho[1][1]), add(rho[0][2], rho[1][3])],
      [add(rho[2][0], rho[3][1]), add(rho[2][2], rho[3][3])],
    ]
  }
  // Trace out qubit 0
  return [
    [add(rho[0][0], rho[2][2]), add(rho[0][1], rho[2][3])],
    [add(rho[1][0], rho[3][2]), add(rho[1][1], rho[3][3])],
  ]
}

function qubitFromRho(rho: Matrix2): ReducedQubit {
  const qx = rho[0][1].re + rho[1][0].re
  const qy = rho[1][0].im - rho[0][1].im
  const qz = rho[0][0].re - rho[1][1].re
  const radius = Math.hypot(qx, qy, qz)
  const purity = clamp01(0.5 * (1 + radius * radius))
  // Tr(ρ²) = (1 + |r|²) / 2 for a qubit Bloch ball
  const state =
    radius <= ORIGIN_EPS
      ? createQubit(0, 0, 0)
      : createQubit(
          Math.acos(clamp01Range(qz / radius, -1, 1)),
          Math.atan2(qy, qx),
          clamp01(radius),
        )
  return {
    state,
    vector: {
      qx: radius <= ORIGIN_EPS ? 0 : qx,
      qy: radius <= ORIGIN_EPS ? 0 : qy,
      qz: radius <= ORIGIN_EPS ? 0 : qz,
    },
    purity: Number.isFinite(purity) ? (purity === 0 ? 0 : purity) : 0,
  }
}

function clamp01Range(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

export function reducedQubit(state: TwoQubitState, wire: Wire): ReducedQubit {
  return qubitFromRho(partialTrace(state, wire))
}

/**
 * Normalized entanglement proxy from the reduced purity:
 * 0 for product states, 1 for maximally entangled (local Bloch radius → 0).
 * E = 2 (1 − Tr(ρ_A²)) ∈ [0, 1].
 */
export function entanglement(state: TwoQubitState): number {
  const reduced = reducedQubit(state, 0)
  return clamp01(2 * (1 - reduced.purity))
}

export type TwoQubitOp =
  | { kind: 'local'; gate: GateName; wire: Wire }
  | { kind: 'cnot'; control: Wire; target: Wire }

export function applyTwoQubitOp(state: TwoQubitState, op: TwoQubitOp): TwoQubitState {
  if (op.kind === 'local') return applyLocalGate(state, op.gate, op.wire)
  return applyCnot(state, op.control, op.target)
}

export function evaluateTwoQubitCircuit(
  initial: TwoQubitState,
  ops: readonly TwoQubitOp[],
): { steps: { op: TwoQubitOp; state: TwoQubitState }[]; final: TwoQubitState } {
  const steps: { op: TwoQubitOp; state: TwoQubitState }[] = []
  let state = initial
  for (const op of ops) {
    state = applyTwoQubitOp(state, op)
    steps.push({ op, state })
  }
  return { steps, final: state }
}

/** Convenience: H on q0 then CNOT(0→1) builds |Φ+⟩ from |00⟩. */
export function prepareBellFromZero(): TwoQubitState {
  return evaluateTwoQubitCircuit(createTwoQubit(), [
    { kind: 'local', gate: 'H', wire: 0 },
    { kind: 'cnot', control: 0, target: 1 },
  ]).final
}

export function describeTwoQubit(state: TwoQubitState): string {
  const e = entanglement(state)
  const probs = jointProbabilities(state)
  const r0 = reducedQubit(state, 0)
  const r1 = reducedQubit(state, 1)
  if (e > 0.85) {
    return `Strongly entangled (E ≈ ${e.toFixed(2)}). Each qubit alone looks mixed — local tips shrink toward the center — while the joint state stays correlated.`
  }
  if (e < 0.08) {
    return `Little to no entanglement (E ≈ ${e.toFixed(2)}). The qubits behave like two separate systems; joint odds factor into local ones.`
  }
  return `Partially entangled (E ≈ ${e.toFixed(2)}). Local purities are p₀ ≈ ${r0.state.p.toFixed(2)} and p₁ ≈ ${r1.state.p.toFixed(2)}. Joint odds: |00⟩ ${pct(probs.p00)}, |01⟩ ${pct(probs.p01)}, |10⟩ ${pct(probs.p10)}, |11⟩ ${pct(probs.p11)}.`
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`
}
