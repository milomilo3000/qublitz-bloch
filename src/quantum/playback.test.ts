import { describe, expect, it } from 'vitest'
import { createQubit } from './qubit.ts'
import { circuitTrail, sampleArc } from './playback.ts'

describe('playback path', () => {
  it('samples an H arc from |0> to |+> and keeps purity 1', () => {
    const from = createQubit(0, 0, 1)
    const to = createQubit(Math.PI / 2, 0, 1)
    const points = sampleArc(from, to, 17)
    expect(points[0]).toEqual([0, 1, 0])
    expect(points.at(-1)?.[0]).toBeCloseTo(1, 5)
    expect(points.at(-1)?.[1]).toBeCloseTo(0, 5)
    for (const point of points) {
      expect(Math.hypot(...point)).toBeCloseTo(1, 5)
    }
  })

  it('builds a continuous circuit trail that ends on the final tip', () => {
    const initial = createQubit(0, 0, 0.4)
    const trail = circuitTrail(initial, ['H', 'S'], 12)
    expect(trail.length).toBeGreaterThan(12)
    expect(trail[0]).toEqual([0, 0.4, 0])
    const tip = trail.at(-1)!
    expect(tip[0]).toBeCloseTo(0, 5)
    expect(tip[1]).toBeCloseTo(0, 5)
    expect(tip[2]).toBeCloseTo(-0.4, 5)
    for (const point of trail) {
      expect(Math.hypot(...point)).toBeCloseTo(0.4, 5)
    }
  })

  it('returns only the start tip for an empty circuit', () => {
    const initial = createQubit(1, 2, 0.5)
    expect(circuitTrail(initial, [])).toHaveLength(1)
  })
})
