import { describe, expect, it } from 'vitest'
import { applyGate, blochVector, createQubit, type GateName, type QubitState } from './qubit.ts'
import { evaluateCircuit, insertGate, moveGate, removeGate, revertCircuit } from './circuit.ts'

const DIGITS = 6

function expectSamePhysics(actual: QubitState, expected: QubitState): void {
  const left = blochVector(actual)
  const right = blochVector(expected)
  expect(left.qx).toBeCloseTo(right.qx, DIGITS)
  expect(left.qy).toBeCloseTo(right.qy, DIGITS)
  expect(left.qz).toBeCloseTo(right.qz, DIGITS)
  expect(actual.p).toBeCloseTo(expected.p, DIGITS)
}

describe('evaluateCircuit', () => {
  it('returns the initial state and no steps for an empty sequence', () => {
    const initial = createQubit(0.4, 1.2, 0.5)
    const result = evaluateCircuit(initial, [])
    expect(result.steps).toEqual([])
    expect(result.final).toBe(initial)
  })

  it('applies gates left to right and keeps each intermediate state', () => {
    const initial = createQubit(0, 0, 1)
    const result = evaluateCircuit(initial, ['H', 'S'])
    const afterH = applyGate(initial, 'H')
    const afterS = applyGate(afterH, 'S')

    expect(result.steps.map((step) => step.gate)).toEqual(['H', 'S'])
    expectSamePhysics(result.steps[0]!.state, afterH)
    expectSamePhysics(result.steps[1]!.state, afterS)
    expect(result.final).toBe(result.steps[1]!.state)
    expect(blochVector(result.final).qy).toBeCloseTo(1, DIGITS)
  })

  it('treats order as significant', () => {
    const initial = createQubit(0, 0, 1)
    const xThenH = blochVector(evaluateCircuit(initial, ['X', 'H']).final)
    const hThenX = blochVector(evaluateCircuit(initial, ['H', 'X']).final)
    expect(xThenH.qx).toBeCloseTo(-1, DIGITS)
    expect(hThenX.qx).toBeCloseTo(1, DIGITS)
  })

  it('matches a chain of applyGate calls, including H twice returning to the start', () => {
    const initial = createQubit(Math.PI / 5, 0.3, 0.4)
    const gates: GateName[] = ['T', 'S', 'H', 'X', 'H']
    const result = evaluateCircuit(initial, gates)
    let state = initial
    gates.forEach((gate, index) => {
      state = applyGate(state, gate)
      expectSamePhysics(result.steps[index]!.state, state)
    })
    expectSamePhysics(evaluateCircuit(initial, ['H', 'H']).final, initial)
  })

  it('preserves purity on a mixed state for every step', () => {
    const initial = createQubit(1, 2, 0.35)
    const result = evaluateCircuit(initial, ['X', 'Y', 'Z', 'H', 'S', 'T', 'I'])
    expect(result.steps).toHaveLength(7)
    for (const step of result.steps) {
      expect(step.state.p).toBeCloseTo(0.35, DIGITS)
    }
    expect(result.final.p).toBeCloseTo(initial.p, DIGITS)
  })

  it('keeps the fully mixed state at the origin', () => {
    const initial = createQubit(0.7, 1.4, 0)
    const result = evaluateCircuit(initial, ['H', 'X', 'T'])
    expect(blochVector(result.final)).toEqual({ qx: 0, qy: 0, qz: 0 })
    expect(result.final.p).toBe(0)
  })
})

describe('revertCircuit', () => {
  it('returns the same state when there are no gates', () => {
    const initial = createQubit(0, 0, 1)
    expect(revertCircuit(initial, [])).toBe(initial)
  })

  it('undoes a sequence back to the initial Bloch vector', () => {
    const initial = createQubit(0.8, 1.1, 0.6)
    const gates: GateName[] = ['H', 'S', 'T', 'X', 'Y', 'Z']
    const final = evaluateCircuit(initial, gates).final
    expectSamePhysics(revertCircuit(final, gates), initial)
    expectSamePhysics(evaluateCircuit(revertCircuit(final, gates), gates).final, final)
  })
})

describe('circuit editing', () => {
  const gates: GateName[] = ['H', 'X', 'S']

  it('inserts, moves, and removes without changing the other gates', () => {
    expect(insertGate(gates, 'T', 1)).toEqual(['H', 'T', 'X', 'S'])
    expect(insertGate(gates, 'Y', 99)).toEqual(['H', 'X', 'S', 'Y'])
    expect(moveGate(gates, 0, 2)).toEqual(['X', 'H', 'S'])
    expect(moveGate(gates, 2, 0)).toEqual(['S', 'H', 'X'])
    expect(moveGate(gates, 1, 1)).toEqual(['H', 'X', 'S'])
    expect(removeGate(gates, 1)).toEqual(['H', 'S'])
  })
})
