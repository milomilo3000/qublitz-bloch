/** Sample the Bloch-sphere path a circuit takes, for trails and tests. */

import { evaluateCircuit } from './circuit.ts'
import type { GateName, QubitState } from './qubit.ts'
import { interpolateBloch, stateToThree } from '../components/blochSpace.ts'

export type Point3 = [number, number, number]

export const GATE_MOVE_MS = 520
export const GATE_GAP_MS = 90

/** Discrete points along one gate arc in Three.js space. */
export function sampleArc(
  from: QubitState,
  to: QubitState,
  samples = 24,
): Point3[] {
  const count = Math.max(2, samples)
  const points: Point3[] = []
  for (let index = 0; index < count; index += 1) {
    points.push(stateToThree(interpolateBloch(from, to, index / (count - 1))))
  }
  return points
}

/**
 * Full trail for an ordered circuit: start at the initial tip, then one arc per gate.
 * Degenerate hops still contribute their endpoint so the tip stays continuous.
 */
export function circuitTrail(
  initial: QubitState,
  gates: readonly GateName[],
  samplesPerGate = 24,
): Point3[] {
  const { steps } = evaluateCircuit(initial, gates)
  const points: Point3[] = [stateToThree(initial)]
  let previous = initial
  for (const step of steps) {
    const arc = sampleArc(previous, step.state, samplesPerGate)
    points.push(...arc.slice(1))
    previous = step.state
  }
  return points
}
