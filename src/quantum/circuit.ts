/** Ordered single-qubit circuit. Gates run left to right through applyGate. */

import { applyGate, type GateName, type QubitState } from './qubit.ts'

export type CircuitStep = {
  gate: GateName
  state: QubitState
}

export type CircuitResult = {
  steps: CircuitStep[]
  final: QubitState
}

/** How many applyGate calls undo one gate. I, X, Y, Z, and H are their own inverses. */
const INVERSE_REPEATS: Record<GateName, number> = {
  I: 1,
  X: 1,
  Y: 1,
  Z: 1,
  H: 1,
  S: 3,
  T: 7,
}

/**
 * Apply `gates` from left to right, starting at `initial`.
 * `steps[i]` is the state after gate i. An empty circuit leaves `final` as `initial`.
 */
export function evaluateCircuit(initial: QubitState, gates: readonly GateName[]): CircuitResult {
  const steps: CircuitStep[] = []
  let state = initial
  for (const gate of gates) {
    state = applyGate(state, gate)
    steps.push({ gate, state })
  }
  return { steps, final: state }
}

/** Recover the state that entered the circuit, by undoing gates from right to left. */
export function revertCircuit(final: QubitState, gates: readonly GateName[]): QubitState {
  if (gates.length === 0) return final
  let state = final
  for (let index = gates.length - 1; index >= 0; index -= 1) {
    const gate = gates[index]!
    const repeats = INVERSE_REPEATS[gate]
    for (let count = 0; count < repeats; count += 1) {
      state = applyGate(state, gate)
    }
  }
  return state
}

export function insertGate(gates: readonly GateName[], gate: GateName, index: number): GateName[] {
  const next = gates.slice()
  const at = Math.min(next.length, Math.max(0, index))
  next.splice(at, 0, gate)
  return next
}

export function moveGate(gates: readonly GateName[], from: number, to: number): GateName[] {
  if (from < 0 || from >= gates.length || from === to) return gates.slice()
  const next = gates.slice()
  const [gate] = next.splice(from, 1)
  if (!gate) return gates.slice()
  const at = Math.min(next.length, Math.max(0, to > from ? to - 1 : to))
  next.splice(at, 0, gate)
  return next
}

export function removeGate(gates: readonly GateName[], index: number): GateName[] {
  return gates.filter((_, gateIndex) => gateIndex !== index)
}
