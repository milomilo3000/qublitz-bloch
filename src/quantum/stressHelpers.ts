/** Verification helpers for stress tests (single-qubit + 2-qubit Grover). */

import { interpolateBloch, quantumToThree, stateToThree } from '../components/blochSpace.ts'
import { evaluateCircuit } from './circuit.ts'
import { circuitTrail, sampleArc, type Point3 } from './playback.ts'
import {
  applyGate,
  blochVector,
  createQubit,
  densityMatrix,
  probabilities,
  type GateName,
  type Matrix2,
  type QubitState,
} from './qubit.ts'

export const STRESS_DIGITS = 6

export type FrameCheck = {
  state: QubitState
  three: Point3
  p0: number
  p1: number
}

export type ComplexAmp = { re: number; im: number }
export type Amplitude4 = [ComplexAmp, ComplexAmp, ComplexAmp, ComplexAmp]

export function ket0(p = 1): QubitState {
  return createQubit(0, 0, p)
}

export function ket1(p = 1): QubitState {
  return createQubit(Math.PI, 0, p)
}

export function ketPlus(p = 1): QubitState {
  return createQubit(Math.PI / 2, 0, p)
}

export function ketPlusI(p = 1): QubitState {
  return createQubit(Math.PI / 2, Math.PI / 2, p)
}

export function assertFiniteThree(point: Point3): void {
  for (const value of point) {
    if (!Number.isFinite(value) || Number.isNaN(value)) {
      throw new Error(`Non-finite Three.js coordinate: ${point.join(',')}`)
    }
  }
}

export function assertPurityBounds(p: number): void {
  if (!(p >= 0 && p <= 1) || !Number.isFinite(p)) {
    throw new Error(`p out of bounds: ${p}`)
  }
}

export function assertProbabilityBounds(p0: number, p1: number): void {
  if (!(p0 >= 0 && p0 <= 1) || !(p1 >= 0 && p1 <= 1)) {
    throw new Error(`probability out of bounds: ${p0}, ${p1}`)
  }
  if (!Number.isFinite(p0) || !Number.isFinite(p1)) {
    throw new Error(`non-finite probability: ${p0}, ${p1}`)
  }
}

export function frameFromState(state: QubitState): FrameCheck {
  const probs = probabilities(state)
  const three = stateToThree(state)
  assertPurityBounds(state.p)
  assertProbabilityBounds(probs.p0, probs.p1)
  assertFiniteThree(three)
  return { state, three, p0: probs.p0, p1: probs.p1 }
}

/** Snapshot of every Play-style frame along a multi-gate circuit. */
export function animationFrames(
  initial: QubitState,
  gates: readonly GateName[],
  samplesPerGate = 16,
): FrameCheck[] {
  const { steps } = evaluateCircuit(initial, gates)
  const frames: FrameCheck[] = [frameFromState(initial)]
  let previous = initial
  for (const step of steps) {
    for (let index = 1; index < samplesPerGate; index += 1) {
      const mid = interpolateBloch(previous, step.state, index / (samplesPerGate - 1))
      frames.push(frameFromState(mid))
    }
    frames.push(frameFromState(step.state))
    previous = step.state
  }
  return frames
}

export function gateObservation(state: QubitState, gate: GateName) {
  const next = applyGate(state, gate)
  const vector = blochVector(next)
  const three = quantumToThree(vector.qx, vector.qy, vector.qz)
  const probs = probabilities(next)
  const rho = densityMatrix(next)
  return { next, vector, three, probs, rho }
}

export function rhoClose(actual: Matrix2, expected: Matrix2, digits = STRESS_DIGITS): boolean {
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 2; col += 1) {
      const a = actual[row]![col]!
      const e = expected[row]![col]!
      if (Math.abs(a.re - e.re) > 10 ** -digits) return false
      if (Math.abs(a.im - e.im) > 10 ** -digits) return false
    }
  }
  return true
}

/** Cumulative trail lengths after 0, 1, …, N gates. */
export function growingTrailLengths(
  initial: QubitState,
  gates: readonly GateName[],
  samplesPerGate = 12,
): number[] {
  const lengths: number[] = [polylineLength(circuitTrail(initial, [], 2))]
  for (let count = 1; count <= gates.length; count += 1) {
    lengths.push(polylineLength(circuitTrail(initial, gates.slice(0, count), samplesPerGate)))
  }
  return lengths
}

export function polylineLength(points: Point3[]): number {
  let total = 0
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1]!
    const b = points[index]!
    total += Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
  }
  return total
}

export function sampleArcEndpoints(from: QubitState, to: QubitState): {
  start: Point3
  end: Point3
  mid: Point3
} {
  const points = sampleArc(from, to, 17)
  return {
    start: points[0]!,
    mid: points[8]!,
    end: points[points.length - 1]!,
  }
}

// --- 2-qubit Grover (test-only) -------------------------------------------------

function amp(re: number, im = 0): ComplexAmp {
  return { re, im }
}

function add(a: ComplexAmp, b: ComplexAmp): ComplexAmp {
  return { re: a.re + b.re, im: a.im + b.im }
}

function scale(a: ComplexAmp, s: number): ComplexAmp {
  return { re: a.re * s, im: a.im * s }
}

function norm2(state: Amplitude4): number {
  return state.reduce((sum, value) => sum + value.re * value.re + value.im * value.im, 0)
}

function probability(state: Amplitude4, index: 0 | 1 | 2 | 3): number {
  const value = state[index]
  return value.re * value.re + value.im * value.im
}

/** |00> computational basis. */
export function twoQubitZero(): Amplitude4 {
  return [amp(1), amp(0), amp(0), amp(0)]
}

/** Apply H⊗H. <b0 b1|H⊗H|q0 q1> = (1/2) (-1)^{b0 q0 + b1 q1}. */
export function applyHH(state: Amplitude4): Amplitude4 {
  const out: Amplitude4 = [amp(0), amp(0), amp(0), amp(0)]
  const half = 0.5
  for (let basis = 0; basis < 4; basis += 1) {
    const a = state[basis as 0 | 1 | 2 | 3]
    if (a.re === 0 && a.im === 0) continue
    const q0 = (basis >> 1) & 1
    const q1 = basis & 1
    for (let b0 = 0; b0 < 2; b0 += 1) {
      for (let b1 = 0; b1 < 2; b1 += 1) {
        const phase = (b0 * q0 + b1 * q1) % 2 === 0 ? 1 : -1
        const index = ((b0 << 1) | b1) as 0 | 1 | 2 | 3
        out[index] = add(out[index], scale(a, half * phase))
      }
    }
  }
  return out
}

/** Phase oracle: flip the sign of the marked basis state. */
export function applyOracle(state: Amplitude4, target: 0 | 1 | 2 | 3): Amplitude4 {
  return [
    target === 0 ? scale(state[0], -1) : amp(state[0].re, state[0].im),
    target === 1 ? scale(state[1], -1) : amp(state[1].re, state[1].im),
    target === 2 ? scale(state[2], -1) : amp(state[2].re, state[2].im),
    target === 3 ? scale(state[3], -1) : amp(state[3].re, state[3].im),
  ]
}

/** Diffusion D = 2|s><s| − I as reflection about the mean amplitude. */
export function applyDiffusion(state: Amplitude4): Amplitude4 {
  const mean = scale(add(add(state[0], state[1]), add(state[2], state[3])), 0.25)
  return [
    add(scale(mean, 2), scale(state[0], -1)),
    add(scale(mean, 2), scale(state[1], -1)),
    add(scale(mean, 2), scale(state[2], -1)),
    add(scale(mean, 2), scale(state[3], -1)),
  ]
}

export function groverIterate(state: Amplitude4, target: 0 | 1 | 2 | 3): Amplitude4 {
  return applyDiffusion(applyOracle(state, target))
}

export function groverSearchOnce(target: 0 | 1 | 2 | 3): {
  before: number
  after: number
  state: Amplitude4
  totalProb: number
} {
  const uniform = applyHH(twoQubitZero())
  const before = probability(uniform, target)
  const afterState = groverIterate(uniform, target)
  return {
    before,
    after: probability(afterState, target),
    state: afterState,
    totalProb: norm2(afterState),
  }
}
