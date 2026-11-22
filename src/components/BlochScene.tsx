import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import type { QubitState } from '../quantum/qubit.ts'
import {
  SPHERE_RADIUS,
  gateRotationAxis,
  interpolateBloch,
  pointOnBlochShell,
  quantumToThree,
  stateFromSpherePoint,
  stateToThree,
} from './blochSpace.ts'

const ORIGIN: [number, number, number] = [0, 0, 0]
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const AXIS_REACH = 1.28
const LABEL_REACH = 1.24

const MOVE_MS = 520
const FADE_MS = 380

export type Point3 = [number, number, number]

export type BlochSceneProps = {
  state: QubitState
  onChange: (state: QubitState) => void
  /** Increments when a gate should sweep the vector from the pose on screen. */
  motion: number
  /** Persistent circuit path in Three.js space. */
  path?: Point3[]
  /** Live pose while a sweep is in flight. */
  onPoseChange?: (pose: QubitState) => void
  /** When false, the tip cannot be dragged (used for reduced 2-qubit views). */
  interactive?: boolean
}

type MotionFrame = {
  pose: QubitState
  trail: [number, number, number][]
  opacity: number
  axis: [number, number, number] | null
}

type GateSweep = {
  from: QubitState
  to: QubitState
  started: number
}

type RotateControl = {
  enableRotate: boolean
}

function ignoreRaycast() {}

export function BlochScene({
  state,
  onChange,
  motion,
  path = [],
  onPoseChange,
  interactive = true,
}: BlochSceneProps) {
  const [dragging, setDragging] = useState(false)
  const controlsRef = useRef<RotateControl | null>(null)

  return (
    <Canvas
      className="h-full w-full touch-none"
      camera={{ position: [2.55, 1.45, 2.55], fov: 40, near: 0.1, far: 40 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
      onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
    >
      <color attach="background" args={['#070b14']} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[4, 6, 3]} intensity={1.5} />
      <directionalLight position={[-3, -2, -2]} intensity={0.35} />
      <ReferenceSphere />
      <QuantumAxes />
      <BasisLabels />
      {path.length >= 2 ? <PathTrail points={path} /> : null}
      <MotionRig
        state={state}
        motion={motion}
        onChange={onChange}
        onPoseChange={onPoseChange}
        controlsRef={controlsRef}
        onDraggingChange={setDragging}
        interactive={interactive}
      />
      <OrbitControls
        ref={(instance) => {
          controlsRef.current = instance
        }}
        makeDefault
        enablePan={false}
        enableRotate={!dragging}
        target={ORIGIN}
        minDistance={1.8}
        maxDistance={8}
      />
    </Canvas>
  )
}

function ReferenceSphere() {
  return (
    <group raycast={ignoreRaycast} renderOrder={-1}>
      <mesh raycast={ignoreRaycast} renderOrder={-1}>
        <sphereGeometry args={[SPHERE_RADIUS, 64, 48]} />
        <meshPhysicalMaterial
          color="#b7c9e6"
          transparent
          opacity={0.16}
          roughness={0.08}
          metalness={0}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <Ring rotation={[Math.PI / 2, 0, 0]} />
      <Ring rotation={[0, 0, 0]} />
      <Ring rotation={[0, Math.PI / 2, 0]} />
    </group>
  )
}

function Ring({ rotation }: { rotation: [number, number, number] }) {
  return (
    <mesh rotation={rotation} raycast={ignoreRaycast}>
      <torusGeometry args={[SPHERE_RADIUS, 0.0045, 8, 128]} />
      <meshBasicMaterial color="#93a6c4" transparent opacity={0.85} />
    </mesh>
  )
}

function QuantumAxes() {
  return (
    <group raycast={ignoreRaycast}>
      <Axis
        a={quantumToThree(-AXIS_REACH, 0, 0)}
        b={quantumToThree(AXIS_REACH, 0, 0)}
        color="#ff8d8d"
      />
      <Axis
        a={quantumToThree(0, -AXIS_REACH, 0)}
        b={quantumToThree(0, AXIS_REACH, 0)}
        color="#5ee0a0"
      />
      <Axis
        a={quantumToThree(0, 0, -AXIS_REACH)}
        b={quantumToThree(0, 0, AXIS_REACH)}
        color="#8ec5ff"
      />
    </group>
  )
}

function Axis({
  a,
  b,
  color,
  opacity = 1,
}: {
  a: [number, number, number]
  b: [number, number, number]
  color: string
  opacity?: number
}) {
  const start = new THREE.Vector3(...a)
  const end = new THREE.Vector3(...b)
  const length = start.distanceTo(end)
  const direction = end.clone().sub(start).normalize()
  const quaternion = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, direction)
  const midpoint = start.clone().add(end).multiplyScalar(0.5)

  return (
    <mesh position={midpoint} quaternion={quaternion} raycast={ignoreRaycast}>
      <cylinderGeometry args={[0.004, 0.004, length, 8]} />
      <meshBasicMaterial color={color} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  )
}

const BASIS_LABELS: { text: string; at: [number, number, number]; color: string }[] = [
  { text: '|0>', at: quantumToThree(0, 0, LABEL_REACH), color: '#c5e0ff' },
  { text: '|1>', at: quantumToThree(0, 0, -LABEL_REACH), color: '#c5e0ff' },
  { text: '|+>', at: quantumToThree(LABEL_REACH, 0, 0), color: '#ffc7c7' },
  { text: '|->', at: quantumToThree(-LABEL_REACH, 0, 0), color: '#ffc7c7' },
  { text: '|+i>', at: quantumToThree(0, LABEL_REACH, 0), color: '#c8f8dc' },
  { text: '|-i>', at: quantumToThree(0, -LABEL_REACH, 0), color: '#c8f8dc' },
]

function BasisLabels() {
  return (
    <group raycast={ignoreRaycast}>
      {BASIS_LABELS.map((label) => (
        <BasisLabel key={label.text} label={label} />
      ))}
    </group>
  )
}

function BasisLabel({
  label,
}: {
  label: { text: string; at: [number, number, number]; color: string }
}) {
  const ref = useRef<THREE.Sprite>(null)

  useEffect(() => {
    const sprite = ref.current
    if (!sprite) return
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 128
    const context = canvas.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.font = '600 56px ui-sans-serif, system-ui, sans-serif'
    context.fillStyle = label.color
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(label.text, canvas.width / 2, canvas.height / 2)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true
    sprite.material.map = texture
    sprite.material.transparent = true
    sprite.material.depthWrite = false
    sprite.material.needsUpdate = true
    return () => {
      texture.dispose()
      sprite.material.map = null
    }
  }, [label.color, label.text])

  return (
    <sprite ref={ref} position={label.at} scale={[0.46, 0.23, 1]} raycast={ignoreRaycast} />
  )
}

function PathTrail({ points }: { points: Point3[] }) {
  const glow = useMemo(() => {
    const material = new THREE.MeshBasicMaterial({
      color: '#ffb020',
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    })
    return new THREE.Mesh(new THREE.BufferGeometry(), material)
  }, [])
  const core = useMemo(() => {
    const material = new THREE.MeshBasicMaterial({
      color: '#ffe566',
      transparent: true,
      opacity: 1,
      depthWrite: false,
    })
    return new THREE.Mesh(new THREE.BufferGeometry(), material)
  }, [])
  const outline = useMemo(() => {
    const material = new THREE.LineBasicMaterial({
      color: '#fff1a8',
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    })
    return new THREE.Line(new THREE.BufferGeometry(), material)
  }, [])

  useLayoutEffect(() => {
    const cleaned = thinPathPoints(points)
    if (cleaned.length < 2) return

    const vectors = cleaned.map((point) => new THREE.Vector3(...point))
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(vectors)
    const oldLine = outline.geometry
    outline.geometry = lineGeometry
    oldLine.dispose()

    const span = pathLength(cleaned)
    if (span < 0.02) return

    const curve = new THREE.CatmullRomCurve3(vectors, false, 'centripetal')
    const segments = Math.min(360, Math.max(24, cleaned.length * 3))
    try {
      const nextGlow = new THREE.TubeGeometry(curve, segments, 0.04, 10, false)
      const nextCore = new THREE.TubeGeometry(curve, segments, 0.018, 8, false)
      const oldGlow = glow.geometry
      const oldCore = core.geometry
      glow.geometry = nextGlow
      core.geometry = nextCore
      oldGlow.dispose()
      oldCore.dispose()
    } catch {
      // Degenerate arcs still keep the bright polyline.
    }
  }, [core, glow, outline, points])

  useEffect(() => {
    return () => {
      glow.geometry.dispose()
      core.geometry.dispose()
      outline.geometry.dispose()
      ;(glow.material as THREE.Material).dispose()
      ;(core.material as THREE.Material).dispose()
      ;(outline.material as THREE.Material).dispose()
    }
  }, [core, glow, outline])

  return (
    <group raycast={ignoreRaycast} renderOrder={3}>
      <primitive object={glow} raycast={ignoreRaycast} renderOrder={3} />
      <primitive object={core} raycast={ignoreRaycast} renderOrder={4} />
      <primitive object={outline} raycast={ignoreRaycast} renderOrder={5} />
    </group>
  )
}

function thinPathPoints(points: Point3[]): Point3[] {
  if (points.length === 0) return []
  const cleaned: Point3[] = [points[0]!]
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]!
    const last = cleaned[cleaned.length - 1]!
    if (distance(last, point) >= 0.008) cleaned.push(point)
  }
  const finalPoint = points[points.length - 1]!
  const last = cleaned[cleaned.length - 1]!
  if (distance(last, finalPoint) > 1e-6) cleaned.push(finalPoint)
  return cleaned
}

function pathLength(points: Point3[]): number {
  let total = 0
  for (let index = 1; index < points.length; index += 1) {
    total += distance(points[index - 1]!, points[index]!)
  }
  return total
}

function MotionRig({
  state,
  motion,
  onChange,
  onPoseChange,
  controlsRef,
  onDraggingChange,
  interactive,
}: {
  state: QubitState
  motion: number
  onChange: (state: QubitState) => void
  onPoseChange?: (pose: QubitState) => void
  controlsRef: RefObject<RotateControl | null>
  onDraggingChange: (dragging: boolean) => void
  interactive: boolean
}) {
  const [frame, setFrame] = useState<MotionFrame>(() => emptyFrame(state))
  const poseRef = useRef(state)
  const sweepRef = useRef<GateSweep | null>(null)
  const motionRef = useRef(motion)
  const onPoseChangeRef = useRef(onPoseChange)
  onPoseChangeRef.current = onPoseChange

  if (motion === motionRef.current && poseRef.current !== state) {
    const sweepingTo = sweepRef.current?.to
    if (sweepingTo !== state) {
      sweepRef.current = null
      poseRef.current = state
      setFrame(emptyFrame(state))
      onPoseChangeRef.current?.(state)
    }
  }

  useEffect(() => {
    if (motion === motionRef.current) return
    motionRef.current = motion
    sweepRef.current = { from: poseRef.current, to: state, started: performance.now() }
  }, [motion, state])

  useFrame(() => {
    const sweep = sweepRef.current
    if (!sweep) return
    const elapsed = performance.now() - sweep.started
    const moveT = Math.min(1, elapsed / MOVE_MS)
    const pose = interpolateBloch(sweep.from, sweep.to, ease(moveT))
    poseRef.current = pose
    onPoseChangeRef.current?.(pose)
    const opacity = elapsed <= MOVE_MS ? 1 : Math.max(0, 1 - (elapsed - MOVE_MS) / FADE_MS)
    const span = distance(stateToThree(sweep.from), stateToThree(sweep.to))
    const trail = span < 0.02 ? [] : arcPoints(sweep.from, sweep.to, moveT)
    const axis = span < 0.02 ? null : gateRotationAxis(sweep.from, sweep.to)
    setFrame({ pose, trail, opacity, axis })
    if (elapsed >= MOVE_MS + FADE_MS) {
      sweepRef.current = null
      poseRef.current = sweep.to
      onPoseChangeRef.current?.(sweep.to)
      setFrame(emptyFrame(sweep.to))
    }
  })

  return (
    <group>
      <StateArrow state={frame.pose} />
      {frame.trail.length >= 2 && frame.opacity > 0.02 ? (
        <MotionTrail points={frame.trail} opacity={frame.opacity} color="#ffe566" />
      ) : null}
      {frame.axis && frame.opacity > 0.02 ? (
        <Axis
          a={scaleTuple(frame.axis, -1.12)}
          b={scaleTuple(frame.axis, 1.12)}
          color="#f0b429"
          opacity={0.85 * frame.opacity}
        />
      ) : null}
      <TipHandle
        state={frame.pose}
        onChange={onChange}
        controlsRef={controlsRef}
        onDraggingChange={onDraggingChange}
        interactive={interactive}
      />
    </group>
  )
}

function emptyFrame(pose: QubitState): MotionFrame {
  return { pose, trail: [], opacity: 0, axis: null }
}

function ease(t: number): number {
  return t * t * (3 - 2 * t)
}

function distance(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

function arcPoints(
  from: QubitState,
  to: QubitState,
  tEnd: number,
): [number, number, number][] {
  const steps = 32
  const points: [number, number, number][] = []
  for (let index = 0; index <= steps; index += 1) {
    points.push(stateToThree(interpolateBloch(from, to, (index / steps) * tEnd)))
  }
  return points
}

function scaleTuple(point: [number, number, number], scale: number): [number, number, number] {
  return [point[0] * scale, point[1] * scale, point[2] * scale]
}

function MotionTrail({
  points,
  opacity,
  color = '#ffd27a',
}: {
  points: Point3[]
  opacity: number
  color?: string
}) {
  const material = useMemo(
    () => new THREE.LineBasicMaterial({ color, transparent: true, depthWrite: false }),
    [color],
  )
  const line = useMemo(() => new THREE.Line(new THREE.BufferGeometry(), material), [material])

  useLayoutEffect(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(
      points.map((point) => new THREE.Vector3(...point)),
    )
    const previous = line.geometry
    line.geometry = geometry
    previous.dispose()
    material.opacity = opacity
  }, [line, material, opacity, points])

  useEffect(() => {
    return () => {
      line.geometry.dispose()
      material.dispose()
    }
  }, [line, material])

  return <primitive object={line} raycast={ignoreRaycast} renderOrder={2} />
}

function StateArrow({ state }: { state: QubitState }) {
  const [x, y, z] = stateToThree(state)
  const length = Math.hypot(x, y, z)
  if (length < 1e-4) return null

  const direction = new THREE.Vector3(x, y, z).multiplyScalar(1 / length)
  const quaternion = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, direction)
  const head = Math.min(0.16, length * 0.34)
  const shaft = Math.max(length - head, 0)

  return (
    <group quaternion={quaternion} renderOrder={1} raycast={ignoreRaycast}>
      {shaft > 1e-4 ? (
        <mesh position={[0, shaft / 2, 0]} raycast={ignoreRaycast} renderOrder={1}>
          <cylinderGeometry args={[0.014, 0.014, shaft, 16]} />
          <meshBasicMaterial color="#dff6ff" />
        </mesh>
      ) : null}
      <mesh position={[0, shaft + head / 2, 0]} raycast={ignoreRaycast} renderOrder={1}>
        <coneGeometry args={[0.05, head, 18]} />
        <meshBasicMaterial color="#f7fdff" />
      </mesh>
    </group>
  )
}

function TipHandle({
  state,
  onChange,
  controlsRef,
  onDraggingChange,
  interactive,
}: {
  state: QubitState
  onChange: (state: QubitState) => void
  controlsRef: RefObject<RotateControl | null>
  onDraggingChange: (dragging: boolean) => void
  interactive: boolean
}) {
  const { camera, gl } = useThree()
  const draggingRef = useRef(false)
  const purityRef = useRef(state.p)
  const tipRef = useRef(new THREE.Vector3())
  const onChangeRef = useRef(onChange)
  const [x, y, z] = stateToThree(state)

  purityRef.current = state.p
  tipRef.current.set(x, y, z)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!interactive) return
    const dom = gl.domElement
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()

    const setRotate = (enabled: boolean) => {
      const controls = controlsRef.current
      if (controls) controls.enableRotate = enabled
    }

    const endDrag = () => {
      if (!draggingRef.current) return
      draggingRef.current = false
      setRotate(true)
      onDraggingChange(false)
      dom.style.cursor = 'auto'
    }

    const onMove = (event: PointerEvent) => {
      if (!draggingRef.current) return
      const rect = dom.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const hit = pointOnBlochShell(raycaster.ray, purityRef.current, tipRef.current)
      if (!hit) return
      onChangeRef.current(stateFromSpherePoint(hit.x, hit.y, hit.z, purityRef.current))
    }

    dom.ownerDocument.addEventListener('pointermove', onMove)
    dom.ownerDocument.addEventListener('pointerup', endDrag)
    dom.ownerDocument.addEventListener('pointercancel', endDrag)
    return () => {
      dom.ownerDocument.removeEventListener('pointermove', onMove)
      dom.ownerDocument.removeEventListener('pointerup', endDrag)
      dom.ownerDocument.removeEventListener('pointercancel', endDrag)
      setRotate(true)
    }
  }, [camera, controlsRef, gl, interactive, onDraggingChange])

  const onPointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (!interactive) return
    event.stopPropagation()
    event.nativeEvent.stopImmediatePropagation()
    draggingRef.current = true
    const controls = controlsRef.current
    if (controls) controls.enableRotate = false
    onDraggingChange(true)
    gl.domElement.style.cursor = 'grabbing'
  }

  return (
    <mesh
      name="bloch-tip"
      position={[x, y, z]}
      renderOrder={2}
      onPointerDown={interactive ? onPointerDown : undefined}
      onPointerOver={
        interactive
          ? () => {
              if (!draggingRef.current) gl.domElement.style.cursor = 'grab'
            }
          : undefined
      }
      onPointerOut={
        interactive
          ? () => {
              if (!draggingRef.current) gl.domElement.style.cursor = 'auto'
            }
          : undefined
      }
      {...(interactive ? {} : { raycast: ignoreRaycast })}
    >
      <sphereGeometry args={[0.085, 24, 24]} />
      <meshStandardMaterial color="#ffffff" emissive="#9be7ff" emissiveIntensity={0.85} />
    </mesh>
  )
}
