import { describe, expect, it } from 'vitest'
import { createQubit } from './qubit.ts'
import { describeGate, describePurity, describeState, describeStatus } from './explain.ts'

describe('plain-language gate copy', () => {
  it('mentions bit flip for X and superposition for H', () => {
    expect(describeGate('X').toLowerCase()).toContain('bit flip')
    expect(describeGate('H').toLowerCase()).toContain('50/50')
    expect(describeGate('Z').toLowerCase()).toContain('phase')
  })
})

describe('plain-language purity copy', () => {
  it('labels the surface and the center intuitively', () => {
    expect(describePurity(1).toLowerCase()).toContain('surface')
    expect(describePurity(0).toLowerCase()).toContain('center')
    expect(describePurity(0.4).toLowerCase()).toContain('coherence')
  })
})

describe('plain-language state copy', () => {
  it('recognizes |0>, |+>, and the mixed center', () => {
    expect(describeState(createQubit(0, 0, 1), { p0: 1, p1: 0 }).toLowerCase()).toContain('|0')
    expect(describeState(createQubit(Math.PI / 2, 0, 1), { p0: 0.5, p1: 0.5 }).toLowerCase()).toContain(
      '50/50',
    )
    expect(describeState(createQubit(0, 0, 0), { p0: 0.5, p1: 0.5 }).toLowerCase()).toContain('center')
  })

  it('keeps status text tied to the last gate', () => {
    expect(describeStatus(null, 1).toLowerCase()).toContain('starter')
    expect(describeStatus('X', 1)).toContain('Applied X')
    expect(describeStatus('X', 1).toLowerCase()).toContain('bit flip')
  })
})
