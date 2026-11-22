import { useMemo, useState } from 'react'
import { type GateName } from '../quantum/qubit.ts'
import {
  createTwoQubit,
  describeTwoQubit,
  entanglement,
  evaluateTwoQubitCircuit,
  jointProbabilities,
  reducedQubit,
  twoQubitPurity,
  type TwoQubitOp,
  type TwoQubitState,
} from '../quantum/twoQubit.ts'
import { BlochScene } from './BlochScene.tsx'
import { TwoQubitCircuitModal } from './TwoQubitCircuitModal.tsx'

type TwoPreset = {
  id: string
  label: string
  ops: TwoQubitOp[]
}

const TWO_PRESETS: TwoPreset[] = [
  {
    id: 'bell',
    label: 'Bell Pair (Entangled)',
    ops: [
      { kind: 'local', gate: 'H', wire: 0 },
      { kind: 'cnot', control: 0, target: 1 },
    ],
  },
  {
    id: 'independent',
    label: 'Two Independent Flips',
    ops: [
      { kind: 'local', gate: 'X', wire: 0 },
      { kind: 'local', gate: 'X', wire: 1 },
    ],
  },
  {
    id: 'product-plus0',
    label: 'Product |+0⟩',
    ops: [{ kind: 'local', gate: 'H', wire: 0 }],
  },
  {
    id: 'zero',
    label: 'Reset |00⟩',
    ops: [],
  },
]

export function TwoQubitWorkbench() {
  const [ops, setOps] = useState<TwoQubitOp[]>([])
  const [base, setBase] = useState<TwoQubitState>(() => createTwoQubit())
  const [circuitOpen, setCircuitOpen] = useState(false)
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const [motion0, setMotion0] = useState(0)
  const [motion1, setMotion1] = useState(0)
  const [lastLabel, setLastLabel] = useState<string | null>(null)

  const evaluated = useMemo(() => evaluateTwoQubitCircuit(base, ops), [base, ops])
  const state = evaluated.final
  const probs = jointProbabilities(state)
  const e = entanglement(state)
  const purity = twoQubitPurity(state)
  const q0 = reducedQubit(state, 0)
  const q1 = reducedQubit(state, 1)
  const copy = describeTwoQubit(state)

  const latestGateByWire = useMemo(() => {
    let last0: GateName | null = null
    let last1: GateName | null = null
    for (const op of ops) {
      if (op.kind !== 'local') continue
      if (op.wire === 0) last0 = op.gate
      else last1 = op.gate
    }
    return { last0, last1 }
  }, [ops])

  const commitOps = (next: TwoQubitOp[], fromPreset: string | null = null) => {
    setActivePreset(fromPreset)
    setBase(createTwoQubit())
    setOps(next)
    setLastLabel(next.length > 0 ? labelOp(next[next.length - 1]!) : null)
    setMotion0((n) => n + 1)
    setMotion1((n) => n + 1)
  }

  const applyPreset = (preset: TwoPreset) => {
    commitOps(preset.ops, preset.id)
  }

  const addLocal = (gate: GateName, wire: 0 | 1) => {
    commitOps([...ops, { kind: 'local', gate, wire }])
  }

  const runCircuit = (next: TwoQubitOp[]) => {
    commitOps(next)
  }

  return (
    <>
      <aside
        aria-label="Two-qubit story"
        className="order-2 flex h-[min(34vh,15rem)] min-h-0 w-full shrink-0 flex-col overflow-hidden border-t border-white/10 bg-[#0b1120] lg:order-1 lg:h-auto lg:w-[22rem] lg:border-t-0 lg:border-r"
      >
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4">
          <div>
            <p className="text-[11px] tracking-wide text-slate-500 uppercase">2Q starters</p>
            <div className="mt-2 flex flex-col gap-1.5">
              {TWO_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  aria-label={`Preset ${preset.label}`}
                  aria-pressed={activePreset === preset.id}
                  className={`rounded-md border px-2.5 py-1.5 text-left text-[11px] ${
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
            <p className="text-[11px] tracking-wide text-slate-500 uppercase">What you are seeing</p>
            <p className="text-sm leading-relaxed text-slate-200">{copy}</p>
            <p className="text-xs leading-relaxed text-slate-400">
              Entanglement E = {e.toFixed(3)} · joint purity Tr(ρ²) = {purity.toFixed(3)}. When E is
              high, each local tip shrinks toward the center even though the pair as a whole can stay
              pure.
            </p>
            {lastLabel ? (
              <p className="text-[11px] text-slate-500">Last step: {lastLabel}</p>
            ) : null}
          </div>
        </div>
      </aside>

      <div className="relative order-1 flex min-h-0 min-w-0 flex-1 flex-col lg:order-2">
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-px bg-white/5 sm:grid-cols-2">
          <div className="relative min-h-[12rem] bg-[#070b14]">
            <p className="pointer-events-none absolute top-3 left-3 z-10 text-[11px] tracking-wide text-slate-400 uppercase">
              Qubit 0 · p={q0.state.p.toFixed(3)}
            </p>
            <BlochScene
              state={q0.state}
              onChange={() => {}}
              motion={motion0}
              interactive={false}
            />
          </div>
          <div className="relative min-h-[12rem] bg-[#070b14]">
            <p className="pointer-events-none absolute top-3 left-3 z-10 text-[11px] tracking-wide text-slate-400 uppercase">
              Qubit 1 · p={q1.state.p.toFixed(3)}
            </p>
            <BlochScene
              state={q1.state}
              onChange={() => {}}
              motion={motion1}
              interactive={false}
            />
          </div>
        </div>
        <div className="absolute top-4 right-4 z-10">
          <button
            type="button"
            aria-label={circuitOpen ? 'Close circuit' : 'Open circuit'}
            aria-expanded={circuitOpen}
            className="rounded-md border border-white/15 bg-[#0c1220]/90 px-3 py-1.5 text-xs text-slate-100 shadow backdrop-blur hover:bg-white/5"
            onClick={() => setCircuitOpen((open) => !open)}
          >
            {circuitOpen ? 'Hide circuit' : 'Circuit'}
          </button>
        </div>
      </div>

      <aside
        aria-label="Two-qubit controls"
        className="order-3 flex h-[min(34vh,15rem)] min-h-0 w-full shrink-0 flex-col overflow-hidden border-t border-white/10 bg-[#0b1120] lg:h-auto lg:w-[22rem] lg:border-t-0 lg:border-l"
      >
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
          <div>
            <p className="text-[11px] tracking-wide text-slate-500 uppercase">Entanglement</p>
            <div className="mt-1.5 h-2 overflow-hidden rounded bg-white/10">
              <div
                className="h-full bg-amber-300"
                style={{ width: `${Math.min(100, Math.max(0, e * 100))}%` }}
              />
            </div>
            <p className="mt-1 font-mono text-xs text-slate-300">{e.toFixed(3)}</p>
          </div>

          <div className="space-y-2 font-mono text-xs">
            <p className="text-[11px] tracking-wide text-slate-500 uppercase">Joint odds</p>
            <Probability label="P(|00>)" value={probs.p00} />
            <Probability label="P(|01>)" value={probs.p01} />
            <Probability label="P(|10>)" value={probs.p10} />
            <Probability label="P(|11>)" value={probs.p11} />
          </div>

          <div>
            <p className="text-[11px] tracking-wide text-slate-500 uppercase">Quick gates</p>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <QuickWire
                label="q0"
                wire={0}
                lastGate={latestGateByWire.last0}
                onGate={(gate) => addLocal(gate, 0)}
              />
              <QuickWire
                label="q1"
                wire={1}
                lastGate={latestGateByWire.last1}
                onGate={(gate) => addLocal(gate, 1)}
              />
            </div>
            <button
              type="button"
              aria-label="Add CNOT q0 to q1"
              className="mt-2 w-full rounded-md border border-amber-300/40 bg-amber-300/10 px-2 py-1.5 text-xs text-amber-100 hover:bg-amber-300/20"
              onClick={() =>
                commitOps([...ops, { kind: 'cnot', control: 0, target: 1 }])
              }
            >
              CNOT q0 → q1
            </button>
          </div>
        </div>
      </aside>

      <TwoQubitCircuitModal
        open={circuitOpen}
        onClose={() => setCircuitOpen(false)}
        ops={ops}
        onRun={runCircuit}
      />
    </>
  )
}

function QuickWire({
  label,
  wire,
  lastGate,
  onGate,
}: {
  label: string
  wire: 0 | 1
  lastGate: GateName | null
  onGate: (gate: GateName) => void
}) {
  return (
    <div
      role="group"
      aria-label={`${label} quick gates`}
      className="rounded-md border border-white/10 bg-transparent p-2"
    >
      <p className="mb-1 font-mono text-[11px] text-slate-400">{label}</p>
      <div className="grid grid-cols-4 gap-1">
        {(['H', 'X', 'Z', 'S'] as GateName[]).map((gate) => {
          const active = lastGate === gate
          return (
            <button
              key={gate}
              type="button"
              aria-label={`Apply ${gate} on ${label}`}
              aria-pressed={active}
              className={`rounded border py-1 text-[11px] ${
                active
                  ? 'border-sky-100 bg-sky-300 font-semibold text-slate-950'
                  : 'border-white/15 bg-transparent text-slate-200'
              }`}
              onClick={() => onGate(gate)}
            >
              {gate}
            </button>
          )
        })}
      </div>
      <span className="sr-only">wire {wire}</span>
    </div>
  )
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

function labelOp(op: TwoQubitOp): string {
  if (op.kind === 'local') return `${op.gate}@q${op.wire}`
  return `CNOT q${op.control}→q${op.target}`
}
