import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { blochVector, createQubit } from '../quantum/qubit.ts'
import {
  gateRotationAxis,
  interpolateBloch,
  pointOnBlochShell,
  quantumToThree,
  stateFromSpherePoint,
  stateToThree,
  threeToQuantum,
} from './blochSpace.ts'

describe('quantum to Three.js mapping', () => {
  it('places |0>, |1>, |+>, and |+i> on the specified axes', () => {
    expect(quantumToThree(0, 0, 1)).toEqual([0, 1, 0])
    expect(quantumToThree(0, 0, -1)).toEqual([0, -1, 0])
    expect(quantumToThree(1, 0, 0)).toEqual([1, 0, 0])
    expect(quantumToThree(0, 1, 0)).toEqual([0, 0, -1])
  })

  it('maps qubit states onto those axes', () => {
    expect(stateToThree(createQubit(0, 0, 1))).toEqual([0, 1, 0])
    expect(stateToThree(createQubit(Math.PI, 0, 1))).toEqual([0, -1, 0])
    expect(stateToThree(createQubit(Math.PI / 2, 0, 1))).toEqual([1, 0, 0])
    expect(stateToThree(createQubit(Math.PI / 2, Math.PI / 2, 1))).toEqual([0, 0, -1])
    expect(stateToThree(createQubit(0, 0, 0.4))).toEqual([0, 0.4, 0])
  })

  it('round-trips a general Bloch vector', () => {
    const quantum = threeToQuantum(0.2, -0.4, 0.6)
    expect(quantum).toEqual({ qx: 0.2, qy: -0.6, qz: -0.4 })
    expect(quantumToThree(quantum.qx, quantum.qy, quantum.qz)).toEqual([0.2, -0.4, 0.6])
  })
})

describe('drag direction preserves purity', () => {
  it('reads |0>, |1>, |+>, and |+i> without changing p', () => {
    expect(stateFromSpherePoint(0, 1, 0, 0.35)).toEqual({ theta: 0, phi: 0, p: 0.35 })
    expect(stateFromSpherePoint(0, -1, 0, 0.35).theta).toBeCloseTo(Math.PI)
    expect(stateFromSpherePoint(0, -1, 0, 0.35).p).toBe(0.35)

    const plus = stateFromSpherePoint(1, 0, 0, 0.5)
    expect(plus.theta).toBeCloseTo(Math.PI / 2)
    expect(plus.phi).toBe(0)
    expect(plus.p).toBe(0.5)

    const plusI = stateFromSpherePoint(0, 0, -1, 0.8)
    expect(plusI.theta).toBeCloseTo(Math.PI / 2)
    expect(plusI.phi).toBeCloseTo(Math.PI / 2)
    expect(plusI.p).toBe(0.8)
  })

  it('uses the point as a direction, not as a new radius', () => {
    const state = stateFromSpherePoint(2, 0, 0, 0.2)
    expect(state.p).toBe(0.2)
    expect(state.theta).toBeCloseTo(Math.PI / 2)
    expect(state.phi).toBe(0)
  })
})

describe('pointOnBlochShell', () => {
  const downZ = new THREE.Ray(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1))

  it('hits the front of the unit sphere', () => {
    const hit = pointOnBlochShell(downZ, 1, null)
    expect(hit).not.toBeNull()
    expect(hit!.x).toBeCloseTo(0)
    expect(hit!.y).toBeCloseTo(0)
    expect(hit!.z).toBeCloseTo(1)
  })

  it('keeps a tip on the back of the shell', () => {
    const back = new THREE.Vector3(0, 0, -1)
    const hit = pointOnBlochShell(downZ, 1, back)
    expect(hit!.z).toBeCloseTo(-1)
  })

  it('uses the purity radius and falls back to the silhouette', () => {
    const fromAbove = new THREE.Ray(new THREE.Vector3(0, 4, 0), new THREE.Vector3(0, -1, 0))
    const hit = pointOnBlochShell(fromAbove, 0.5, null)
    expect(hit!.y).toBeCloseTo(0.5)

    const miss = new THREE.Ray(new THREE.Vector3(0, 3, 0), new THREE.Vector3(1, 0, 0))
    const limb = pointOnBlochShell(miss, 0.5, null)
    expect(limb!.x).toBeCloseTo(0)
    expect(limb!.y).toBeCloseTo(1)
    expect(limb!.z).toBeCloseTo(0)
  })
})

describe('gate arc', () => {
  const north = createQubit(0, 0, 1)
  const plus = createQubit(Math.PI / 2, 0, 1)
  const mixedNorth = createQubit(0, 0, 0.4)
  const mixedPlus = createQubit(Math.PI / 2, 0, 0.4)

  it('starts and ends on the Bloch vectors and keeps p fixed', () => {
    const start = blochVector(interpolateBloch(mixedNorth, mixedPlus, 0))
    const end = blochVector(interpolateBloch(mixedNorth, mixedPlus, 1))
    expect(start.qz).toBeCloseTo(0.4)
    expect(start.qx).toBeCloseTo(0)
    expect(end.qx).toBeCloseTo(0.4)
    expect(end.qz).toBeCloseTo(0)
    expect(interpolateBloch(mixedNorth, mixedPlus, 0.3).p).toBeCloseTo(0.4)
    expect(interpolateBloch(mixedNorth, mixedPlus, 0.8).p).toBeCloseTo(0.4)
  })

  it('puts the midpoint of |0> and |+> on the quarter-circle', () => {
    const mid = blochVector(interpolateBloch(north, plus, 0.5))
    const half = Math.SQRT1_2
    expect(mid.qx).toBeCloseTo(half)
    expect(mid.qy).toBeCloseTo(0)
    expect(mid.qz).toBeCloseTo(half)
    expect(Math.hypot(mid.qx, mid.qy, mid.qz)).toBeCloseTo(1)
  })

  it('exposes the rotation axis of that quarter-turn', () => {
    const axis = gateRotationAxis(north, plus)
    expect(axis).not.toBeNull()
    expect(axis![0]).toBeCloseTo(0)
    expect(axis![1]).toBeCloseTo(0)
    expect(Math.abs(axis![2])).toBeCloseTo(1)
    expect(gateRotationAxis(north, north)).toBeNull()
  })
})
