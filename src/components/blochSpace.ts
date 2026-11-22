import * as THREE from 'three'
import { blochVector, createQubit, type BlochVector, type QubitState } from '../quantum/qubit.ts'

/** Outer Bloch sphere radius. The state vector length is purity p, inside this shell. */
export const SPHERE_RADIUS = 1

const SHELL_EPS = 1e-4

function coordinate(value: number): number {
  if (!Number.isFinite(value) || value === 0) return 0
  return value
}

/** Quantum (qx, qy, qz) → Three.js (qx, qz, -qy). Three.js Y is up, so quantum +Z is up. */
export function quantumToThree(qx: number, qy: number, qz: number): [number, number, number] {
  return [coordinate(qx), coordinate(qz), coordinate(-qy)]
}

/** Inverse of quantumToThree. */
export function threeToQuantum(x: number, y: number, z: number): BlochVector {
  return { qx: x, qy: -z, qz: y }
}

export function stateToThree(state: QubitState): [number, number, number] {
  const { qx, qy, qz } = blochVector(state)
  return quantumToThree(qx, qy, qz)
}

/**
 * Read (theta, phi) from a Three.js point and keep the supplied purity.
 * The point's length is only a direction; p is not taken from it.
 */
export function stateFromSpherePoint(x: number, y: number, z: number, p: number): QubitState {
  const { qx, qy, qz } = threeToQuantum(x, y, z)
  const radius = Math.hypot(qx, qy, qz)
  if (!(radius > SHELL_EPS)) return createQubit(0, 0, p)
  const theta = Math.acos(Math.min(1, Math.max(-1, qz / radius)))
  const phi = Math.atan2(qy, qx)
  return createQubit(theta, phi, p)
}

/**
 * Point on the purity shell under a camera ray.
 * When both the near and far intersections exist, the one closest to `near`
 * wins so a tip on the back of the ball does not jump to the front.
 * A miss uses the ray's closest approach to the origin, which is the silhouette.
 */
export function pointOnBlochShell(
  ray: THREE.Ray,
  p: number,
  near: THREE.Vector3 | null,
): THREE.Vector3 | null {
  const radius = p > SHELL_EPS ? Math.min(p, SPHERE_RADIUS) : SPHERE_RADIUS
  const direction = ray.direction.clone()
  if (direction.lengthSq() < SHELL_EPS) return null
  direction.normalize()

  const halfB = ray.origin.dot(direction)
  const discriminant = halfB * halfB - (ray.origin.lengthSq() - radius * radius)
  const hits: THREE.Vector3[] = []
  if (discriminant >= 0) {
    const root = Math.sqrt(discriminant)
    for (const t of [-halfB - root, -halfB + root]) {
      if (t > SHELL_EPS) hits.push(ray.origin.clone().addScaledVector(direction, t))
    }
  }

  if (hits.length > 0) {
    if (near && near.lengthSq() > SHELL_EPS) {
      let best = hits[0]
      let bestDistance = best.distanceToSquared(near)
      for (const hit of hits) {
        const distance = hit.distanceToSquared(near)
        if (distance < bestDistance) {
          best = hit
          bestDistance = distance
        }
      }
      return best
    }
    return hits[0]
  }

  const closest = ray.origin
    .clone()
    .addScaledVector(direction, -halfB)
  if (closest.lengthSq() < SHELL_EPS) return null
  return closest.normalize()
}

const UP = new THREE.Vector3(0, 1, 0)

/**
 * Shortest arc between two Bloch vectors. t is linear in [0, 1].
 * Radius is lerped, so a gate (constant p) stays on one shell.
 */
export function interpolateBloch(from: QubitState, to: QubitState, t: number): QubitState {
  const clamped = Math.min(1, Math.max(0, t))
  const start = blochVector(from)
  const end = blochVector(to)
  const p = from.p + (to.p - from.p) * clamped
  const startLength = Math.hypot(start.qx, start.qy, start.qz)
  const endLength = Math.hypot(end.qx, end.qy, end.qz)
  if (startLength < SHELL_EPS && endLength < SHELL_EPS) return createQubit(to.theta, to.phi, p)

  const startDir = unitBloch(start, end, startLength)
  const endDir = unitBloch(end, start, endLength)
  const dir = slerpQuantum(startDir, endDir, clamped)
  const [x, y, z] = quantumToThree(dir.qx * p, dir.qy * p, dir.qz * p)
  return stateFromSpherePoint(x, y, z, p)
}

/** Unit rotation axis in Three.js space, or null when the arc is degenerate. */
export function gateRotationAxis(
  from: QubitState,
  to: QubitState,
): [number, number, number] | null {
  const start = blochVector(from)
  const end = blochVector(to)
  const startLength = Math.hypot(start.qx, start.qy, start.qz)
  const endLength = Math.hypot(end.qx, end.qy, end.qz)
  if (startLength < SHELL_EPS || endLength < SHELL_EPS) return null
  const cx = (start.qy / startLength) * (end.qz / endLength) - (start.qz / startLength) * (end.qy / endLength)
  const cy = (start.qz / startLength) * (end.qx / endLength) - (start.qx / startLength) * (end.qz / endLength)
  const cz = (start.qx / startLength) * (end.qy / endLength) - (start.qy / startLength) * (end.qx / endLength)
  const length = Math.hypot(cx, cy, cz)
  if (length < 1e-3) return null
  return quantumToThree(cx / length, cy / length, cz / length)
}

function unitBloch(vector: BlochVector, fallback: BlochVector, length: number): BlochVector {
  if (length < SHELL_EPS) {
    const fallbackLength = Math.hypot(fallback.qx, fallback.qy, fallback.qz)
    return {
      qx: fallback.qx / fallbackLength,
      qy: fallback.qy / fallbackLength,
      qz: fallback.qz / fallbackLength,
    }
  }
  return { qx: vector.qx / length, qy: vector.qy / length, qz: vector.qz / length }
}

function slerpQuantum(start: BlochVector, end: BlochVector, t: number): BlochVector {
  const from = new THREE.Vector3(...quantumToThree(start.qx, start.qy, start.qz))
  const to = new THREE.Vector3(...quantumToThree(end.qx, end.qy, end.qz))
  const fromQuat = new THREE.Quaternion().setFromUnitVectors(UP, from)
  const toQuat = new THREE.Quaternion().setFromUnitVectors(UP, to)
  const dir = UP.clone().applyQuaternion(fromQuat.slerp(toQuat, t))
  return threeToQuantum(dir.x, dir.y, dir.z)
}
