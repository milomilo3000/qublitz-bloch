import { useEffect, useMemo, useRef, useState } from 'react'
import { BlochScene } from './components/BlochScene.tsx'
import {
  CircuitModal,
  type MeasurementLogEntry,
} from './components/CircuitModal.tsx'
import { TwoQubitWorkbench } from './components/TwoQubitWorkbench.tsx'
import { evaluateCircuit, revertCircuit } from './quantum/circuit.ts'
import {
  describeGate,
  describePurity,
  describeState,
  describeStatus,
} from './quantum/explain.ts'
import { GATE_GAP_MS, GATE_MOVE_MS, type Point3 } from './quantum/playback.ts'
import {
  GATE_NAMES,
  blochVector,
  createQubit,
  densityMatrix,
  measure,
  probabilities,
  type Complex,
  type GateName,
  type QubitState,
} from './quantum/qubit.ts'
import { stateToThree } from './components/blochSpace.ts'

type WorkbenchMode = '1q' | '2q'

type Preset = {
  id: string
  label: string
  origin: QubitState
  gates: GateName[]
}

const PRESETS: Preset[] = [
  {
    id: 'h-split',
    label: '50/50 Split (H)',
    origin: createQubit(0, 0, 1),
    gates: ['H'],
  },
  {
    id: 'x-flip',
    label: 'Flip 0 → 1 (X)',
    origin: createQubit(0, 0, 1),
    gates: ['X'],
  },
  {
    id: 'sweep',
    label: 'Sweep Path (H → S → T)',
    origin: createQubit(0, 0, 1),
    gates: ['H', 'S', 'T'],
  },
  {
    id: 'center',
    label: 'Center / Uncertain (p = 0)',
    origin: createQubit(0, 0, 0),
    gates: [],
  },
]

export default function App() {
  const [mode, setMode] = useState<WorkbenchMode>('1q')
  const [origin, setOrigin] = useState<QubitState>(() => createQubit(0, 0, 1))
  const [gates, setGates] = useState<GateName[]>([])
  const [motion, setMotion] = useState(0)
  const [lastGate, setLastGate] = useState<GateName | null>(null)
  const [circuitOpen, setCircuitOpen] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [activeStep, setActiveStep] = useState<number | null>(null)
  const [path, setPath] = useState<Point3[]>([])
  const [viewState, setViewState] = useState<QubitState>(() => createQubit(0, 0, 1))
  const [readout, setReadout] = useState<QubitState>(() => createQubit(0, 0, 1))
  const [log, setLog] = useState<MeasurementLogEntry[]>([])
  const [showMath, setShowMath] = useState(false)
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const playToken = useRef(0)
  const logId = useRef(0)
  const playingRef = useRef(false)

  const evaluated = useMemo(() => evaluateCircuit(origin, gates), [origin, gates])
  const committed = evaluated.final

  useEffect(() => {
    playingRef.current = playing
  }, [playing])

  useEffect(() => {
    if (playing) return
    setViewState(committed)
    setReadout(committed)
    setActiveStep(null)
  }, [committed, playing])

  const vector = blochVector(readout)
  const rho = densityMatrix(readout)
  const probs = probabilities(readout)
  const stateCopy = describeState(readout, probs)
  const purityCopy = describePurity(readout.p)
  const statusCopy = describeStatus(lastGate, readout.p)
  const gateCopy = lastGate ? describeGate(lastGate) : null

  const bumpMotion = () => setMotion((count) => count + 1)

  const appendPathPoint = (point: Point3) => {
    setPath((current) => {
      const last = current[current.length - 1]
      if (last && pointDistance(last, point) < 0.012) return current
      return [...current, point]
    })
  }

  const updateCircuit = (next: GateName[]) => {
    if (playing) return
    setActivePreset(null)
    setGates(next)
    bumpMotion()
    setLastGate(next.length > 0 ? next[next.length - 1]! : null)
  }

  const setPurity = (p: number) => {
    if (playing) return
    setActivePreset(null)
    setOrigin(revertCircuit(createQubit(committed.theta, committed.phi, p), gates))
  }

  const onSphereChange = (next: QubitState) => {
    if (playing) return
    setActivePreset(null)
    setOrigin(revertCircuit(next, gates))
  }

  const onPoseChange = (pose: QubitState) => {
    setReadout(pose)
    if (playingRef.current) appendPathPoint(stateToThree(pose))
  }

  const runGate = (gate: GateName) => {
    updateCircuit([...gates, gate])
  }

  const applyPreset = (preset: Preset) => {
    if (playing) return
    playToken.current += 1
    setPlaying(false)
    playingRef.current = false
    setActivePreset(preset.id)
    setOrigin(preset.origin)
    setGates(preset.gates)
    setLastGate(preset.gates.length > 0 ? preset.gates[preset.gates.length - 1]! : null)
    setPath([])
    setActiveStep(null)
    setCircuitOpen(false)
    bumpMotion()
  }

  const resetPlayback = () => {
    playToken.current += 1
    setPlaying(false)
    setActiveStep(null)
    setViewState(origin)
    setReadout(origin)
    setPath([])
  }

  const playCircuit = async () => {
    if (playing || gates.length === 0) return
    const token = ++playToken.current
    const steps = evaluateCircuit(origin, gates).steps
    setPlaying(true)
    playingRef.current = true
    setCircuitOpen(false)
    setActiveStep(null)
    setViewState(origin)
    setReadout(origin)
    setPath([stateToThree(origin)])

    let previous = origin
    for (let index = 0; index < steps.length; index += 1) {
      if (playToken.current !== token) return
      await wait(GATE_GAP_MS)
      if (playToken.current !== token) return
      const next = steps[index]!.state
      setActiveStep(index)
      setViewState(next)
      setLastGate(steps[index]!.gate)
      bumpMotion()
      await wait(GATE_MOVE_MS)
      appendPathPoint(stateToThree(next))
      previous = next
    }

    if (playToken.current !== token) return
    setPlaying(false)
    playingRef.current = false
    setActiveStep(null)
    setViewState(previous)
    setReadout(previous)
    appendPathPoint(stateToThree(previous))
  }

  const activeGate =
    playing && activeStep !== null && gates[activeStep] ? gates[activeStep] : null

  const runMeasure = () => {
    if (playing) return
    const before = probabilities(committed)
    const result = measure(committed)
    logId.current += 1
    setLog((entries) =>
      [
        {
          id: logId.current,
          outcome: result.outcome,
          p0: before.p0,
          p1: before.p1,
        },
        ...entries,
      ].slice(0, 12),
    )
    setActivePreset(null)
    setGates([])
    setOrigin(result.state)
    setActiveStep(null)
    setLastGate(null)
    bumpMotion()
    setCircuitOpen(true)
  }

  return (
    <main className="relative flex h-dvh w-screen flex-col overflow-hidden bg-[#070b14] text-slate-100 lg:flex-row">
      <div className="absolute top-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/15 bg-[#0c1220]/95 p-1 shadow-lg backdrop-blur">
        <button
          type="button"
          aria-label="1 qubit mode"
          aria-pressed={mode === '1q'}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            mode === '1q'
              ? 'bg-sky-300/20 text-sky-100'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          onClick={() => setMode('1q')}
        >
          1 qubit
        </button>
        <button
          type="button"
          aria-label="2 qubit mode"
          aria-pressed={mode === '2q'}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            mode === '2q'
              ? 'bg-sky-300/20 text-sky-100'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          onClick={() => {
            playToken.current += 1
            setPlaying(false)
            setCircuitOpen(false)
            setMode('2q')
          }}
        >
          2 qubit
        </button>
      </div>

      {mode === '2q' ? (
        <TwoQubitWorkbench />
      ) : (
        <>
      <aside
        aria-label="Story dashboard"
        className="order-2 flex h-[min(34vh,15rem)] min-h-0 w-full shrink-0 flex-col overflow-hidden border-t border-white/10 bg-[#0b1120] lg:order-1 lg:h-auto lg:w-[22rem] lg:border-t-0 lg:border-r"
      >
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4">
          <div>
            <p className="text-[11px] tracking-wide text-slate-500 uppercase">Starters</p>
            <div className="mt-2 flex flex-col gap-1.5">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  aria-label={`Preset ${preset.label}`}
                  aria-pressed={activePreset === preset.id}
                  disabled={playing}
                  className={`rounded-md border px-2.5 py-1.5 text-left text-[11px] disabled:opacity-40 ${
                    activePreset === preset.id
                      ? 'border-sky-300/70 bg-sky-300/15 text-sky-100'
                      : 'border-white/15 text-slate-200 hover:bg-white/5'
                  }`}
                  onClick={() => applyPreset(preset)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] tracking-wide text-slate-500 uppercase">
                What you are seeing
              </p>
              <button
                type="button"
                aria-pressed={showMath}
                aria-label="Toggle advanced math"
                className={`rounded-md border px-2 py-0.5 text-[11px] ${
                  showMath
                    ? 'border-sky-300/70 bg-sky-300/15 text-sky-100'
                    : 'border-white/15 text-slate-300 hover:bg-white/5'
                }`}
                onClick={() => setShowMath((value) => !value)}
              >
                {showMath ? 'Hide math' : 'Show math'}
              </button>
            </div>
            <p className="text-sm leading-relaxed text-slate-200">{stateCopy}</p>
            <p className="text-xs leading-relaxed text-slate-400">{purityCopy}</p>
            <p className="text-xs leading-relaxed text-slate-500">{statusCopy}</p>
            {gateCopy && lastGate ? (
              <p className="text-[11px] leading-relaxed text-slate-500">
                <span className="font-mono text-slate-300">{lastGate}</span> — {gateCopy}
              </p>
            ) : null}

            <output
              className="sr-only"
              data-theta={readout.theta}
              data-phi={readout.phi}
              data-p={readout.p}
              data-p0={probs.p0}
              data-p1={probs.p1}
              data-rho00-re={rho[0][0].re}
              data-rho00-im={rho[0][0].im}
              data-rho01-re={rho[0][1].re}
              data-rho01-im={rho[0][1].im}
              data-rho10-re={rho[1][0].re}
              data-rho10-im={rho[1][0].im}
              data-rho11-re={rho[1][1].re}
              data-rho11-im={rho[1][1].im}
            >
              θ {readout.theta.toFixed(3)} · φ {readout.phi.toFixed(3)} · p {formatPurity(readout.p)}
            </output>

            {showMath ? (
              <div className="rounded-lg border border-white/10 bg-black/20 p-2.5">
                <p className="font-mono text-[11px] leading-5 text-slate-300">
                  θ {readout.theta.toFixed(3)} · φ {readout.phi.toFixed(3)} · p{' '}
                  {formatPurity(readout.p)}
                  <br />
                  qx {vector.qx.toFixed(3)} · qy {vector.qy.toFixed(3)} · qz{' '}
                  {vector.qz.toFixed(3)}
                </p>
                <p className="mt-2 text-[11px] tracking-wide text-slate-500 uppercase">
                  Density matrix ρ
                </p>
                <div className="mt-1 grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-1 font-mono text-[11px] text-slate-200">
                  <span />
                  <span className="text-slate-500">|0&gt;</span>
                  <span className="text-slate-500">|1&gt;</span>
                  <span className="text-slate-500">&lt;0|</span>
                  <span>{formatComplex(rho[0][0])}</span>
                  <span>{formatComplex(rho[0][1])}</span>
                  <span className="text-slate-500">&lt;1|</span>
                  <span>{formatComplex(rho[1][0])}</span>
                  <span>{formatComplex(rho[1][1])}</span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </aside>

      <div className="relative order-1 min-h-0 min-w-0 flex-1 lg:order-2">
        <BlochScene
          state={viewState}
          onChange={onSphereChange}
          motion={motion}
          path={path}
          onPoseChange={onPoseChange}
        />
        <header className="pointer-events-none absolute top-0 left-0 z-10 p-4 sm:p-5">
          <p className="text-[11px] tracking-[0.22em] text-slate-400 uppercase">Qublitz</p>
          <h1 className="text-lg font-medium tracking-tight text-slate-100">Bloch sphere</h1>
        </header>
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2 sm:top-5 sm:right-5">
          {playing ? (
            <div
              aria-live="polite"
              className="max-w-[14rem] rounded-md border border-sky-300/40 bg-[#0c1220]/90 px-3 py-1.5 text-xs text-sky-100 shadow backdrop-blur"
            >
              {activeGate ? (
                <>
                  <span className="font-mono font-semibold">{activeGate}</span>
                  <span className="text-slate-400">
                    {' '}
                    · {(activeStep ?? 0) + 1}/{gates.length}
                  </span>
                  <p className="mt-0.5 text-[10px] leading-snug text-slate-300">
                    {describeGate(activeGate)}
                  </p>
                </>
              ) : (
                <span className="text-slate-300">Starting path…</span>
              )}
            </div>
          ) : null}
          <button
            type="button"
            aria-label={circuitOpen ? 'Close circuit' : 'Open circuit'}
            aria-expanded={circuitOpen}
            disabled={playing}
            className="rounded-md border border-white/15 bg-[#0c1220]/90 px-3 py-1.5 text-xs text-slate-100 shadow backdrop-blur hover:bg-white/5 disabled:cursor-default disabled:opacity-50"
            onClick={() => {
              if (!playing) setCircuitOpen((open) => !open)
            }}
          >
            {circuitOpen ? 'Hide circuit' : 'Circuit'}
          </button>
        </div>
      </div>

      <aside
        aria-label="Controls dashboard"
        className="order-3 flex h-[min(34vh,15rem)] min-h-0 w-full shrink-0 flex-col overflow-hidden border-t border-white/10 bg-[#0b1120] lg:h-auto lg:w-[22rem] lg:border-t-0 lg:border-l"
      >
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
          <div className="space-y-2 font-mono text-xs">
            <p className="text-[11px] tracking-wide text-slate-500 uppercase">Measurement odds</p>
            <Probability label="P(|0>) · chance of 0" value={probs.p0} />
            <Probability label="P(|1>) · chance of 1" value={probs.p1} />
          </div>

          <div>
            <p className="text-[11px] tracking-wide text-slate-500 uppercase">Gates</p>
            <div className="mt-1.5 grid grid-cols-7 gap-1">
              {GATE_NAMES.map((gate) => (
                <button
                  key={gate}
                  type="button"
                  aria-label={`Apply gate ${gate}`}
                  aria-pressed={lastGate === gate}
                  disabled={playing}
                  title={describeGate(gate)}
                  className={`rounded-md border px-0 py-1.5 text-xs font-medium disabled:opacity-40 ${
                    lastGate === gate
                      ? 'border-sky-300/70 bg-sky-300/15 text-sky-100'
                      : 'border-white/15 text-slate-200 hover:bg-white/5'
                  }`}
                  onClick={() => runGate(gate)}
                >
                  {gate}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] tracking-wide text-slate-500 uppercase">
              <span className="flex items-baseline justify-between gap-2">
                <span>Certainty / coherence (p)</span>
                <span className="font-mono text-xs tracking-normal text-slate-200 normal-case">
                  {formatPurity(readout.p)}
                </span>
              </span>
              <input
                className="mt-2 w-full accent-sky-300"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={readout.p}
                aria-label="Purity p"
                disabled={playing}
                onChange={(event) => setPurity(Number(event.target.value))}
              />
            </label>
            <p className="mt-1 text-[11px] leading-snug text-slate-500">
              p = 1 on the surface · p = 0 at the center
            </p>
            <div className="mt-2 flex items-center gap-2">
              <input
                className="w-24 rounded-md border border-white/15 bg-white/5 px-2 py-1 font-mono text-xs text-slate-100 disabled:opacity-40"
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={formatPurity(readout.p)}
                aria-label="Purity p value"
                disabled={playing}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  if (Number.isFinite(next)) setPurity(next)
                }}
              />
              <button
                type="button"
                className="rounded-md border border-white/15 px-2 py-1 text-xs text-slate-200 hover:bg-white/5 disabled:opacity-40"
                disabled={playing}
                onClick={() => setPurity(1)}
              >
                Snap to surface
              </button>
            </div>
          </div>
        </div>
      </aside>

      <CircuitModal
        open={circuitOpen}
        onClose={() => {
          if (!playing) setCircuitOpen(false)
        }}
        gates={gates}
        onChange={updateCircuit}
        activeStep={activeStep}
        playing={playing}
        onPlay={() => {
          void playCircuit()
        }}
        onReset={resetPlayback}
        onMeasure={runMeasure}
        readout={{ state: readout, vector, rho, probs }}
        log={log}
      />
        </>
      )}
    </main>
  )
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function pointDistance(a: Point3, b: Point3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

function Probability({ label, value }: { label: string; value: number }) {
  const width = `${Math.min(100, Math.max(0, value * 100))}%`
  return (
    <div>
      <div className="flex justify-between gap-2 text-slate-300">
        <span>{label}</span>
        <span>{value.toFixed(3)}</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded bg-white/10">
        <div className="h-full bg-sky-300" style={{ width }} />
      </div>
    </div>
  )
}

function formatPurity(p: number): string {
  return (Math.round(p * 1000) / 1000).toFixed(3)
}

function formatComplex(value: Complex): string {
  const re = Math.abs(value.re) < 5e-4 ? 0 : value.re
  const im = Math.abs(value.im) < 5e-4 ? 0 : value.im
  if (im === 0) return re.toFixed(2)
  const imaginary = `${Math.abs(im).toFixed(2)}i`
  if (re === 0) return im < 0 ? `-${imaginary}` : imaginary
  return `${re.toFixed(2)} ${im < 0 ? '−' : '+'} ${imaginary}`
}
