import { useEffect, useState } from 'react'
import { GATE_NAMES, type GateName } from '../quantum/qubit.ts'
import { type TwoQubitOp, type Wire } from '../quantum/twoQubit.ts'

const TONE: Record<GateName, string> = {
  I: 'border-slate-400/40 text-slate-200',
  X: 'border-rose-300/50 text-rose-100',
  Y: 'border-emerald-300/50 text-emerald-100',
  Z: 'border-sky-300/50 text-sky-100',
  H: 'border-amber-300/60 text-amber-100',
  S: 'border-violet-300/50 text-violet-100',
  T: 'border-cyan-300/50 text-cyan-100',
}

function labelOp(op: TwoQubitOp): string {
  if (op.kind === 'local') return `${op.gate} @ q${op.wire}`
  return `CNOT q${op.control}→q${op.target}`
}

function WireToggle({
  value,
  selected,
  onSelect,
  label,
}: {
  value: Wire
  selected: boolean
  onSelect: (wire: Wire) => void
  label: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      className={`min-w-12 rounded-md border px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors ${
        selected
          ? 'border-sky-200 bg-sky-300 text-slate-950 shadow-[0_0_0_1px_rgba(125,211,252,0.55)]'
          : 'border-white/20 bg-transparent text-slate-400 hover:border-white/35 hover:bg-white/5 hover:text-slate-200'
      }`}
      onClick={() => onSelect(value)}
    >
      q{value}
    </button>
  )
}

export function TwoQubitCircuitModal({
  open,
  onClose,
  ops,
  onRun,
}: {
  open: boolean
  onClose: () => void
  ops: TwoQubitOp[]
  onRun: (ops: TwoQubitOp[]) => void
}) {
  const [draft, setDraft] = useState<TwoQubitOp[]>(ops)
  const [wire, setWire] = useState<Wire>(0)
  const [control, setControl] = useState<Wire>(0)

  useEffect(() => {
    if (!open) return
    setDraft(ops)
  }, [open, ops])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const target = (control === 0 ? 1 : 0) as Wire

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        aria-label="Close circuit overlay"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Two-qubit circuit"
        className="relative z-10 flex max-h-[min(90vh,40rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c1220] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <p className="text-[11px] tracking-[0.2em] text-slate-500 uppercase">Circuit</p>
            <h2 className="text-base font-medium text-slate-100">Two-qubit wires (q0, q1)</h2>
          </div>
          <button
            type="button"
            aria-label="Close circuit"
            className="rounded-md border border-white/15 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/5"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] tracking-wide text-slate-500 uppercase">Single-qubit wire</p>
            <div
              role="group"
              aria-label="Select wire for single-qubit gates"
              className="inline-flex gap-1 rounded-lg border border-white/10 bg-black/25 p-1"
            >
              {([0, 1] as const).map((w) => (
                <WireToggle
                  key={w}
                  value={w}
                  selected={wire === w}
                  onSelect={setWire}
                  label={`Select wire q${w}`}
                />
              ))}
            </div>
            <span className="text-[11px] text-slate-400">
              Active: <span className="font-semibold text-sky-200">q{wire}</span>
            </span>
            <button
              type="button"
              aria-label="Clear circuit"
              className="ml-auto rounded-md border border-white/15 px-2 py-1 text-[11px] text-slate-300 hover:bg-white/5 disabled:opacity-40"
              disabled={draft.length === 0}
              onClick={() => setDraft([])}
            >
              Clear
            </button>
          </div>

          <div className="flex flex-wrap gap-1" aria-label="Gate palette">
            {GATE_NAMES.map((gate) => (
              <button
                key={gate}
                type="button"
                aria-label={`Add gate ${gate} on q${wire}`}
                className={`w-9 rounded-md border bg-[#0b1120] py-1.5 text-xs font-medium ${TONE[gate]}`}
                onClick={() => setDraft((prev) => [...prev, { kind: 'local', gate, wire }])}
              >
                {gate}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] tracking-wide text-slate-500 uppercase">CNOT control</p>
            <div
              role="group"
              aria-label="Select CNOT control wire"
              className="inline-flex gap-1 rounded-lg border border-white/10 bg-black/25 p-1"
            >
              {([0, 1] as const).map((w) => (
                <WireToggle
                  key={w}
                  value={w}
                  selected={control === w}
                  onSelect={setControl}
                  label={`CNOT control q${w}`}
                />
              ))}
            </div>
            <span className="text-[11px] text-slate-500">→ target q{target}</span>
            <button
              type="button"
              aria-label="Add CNOT"
              className="rounded-md border border-amber-300/50 bg-amber-300/10 px-2.5 py-1 text-xs text-amber-100 hover:bg-amber-300/20"
              onClick={() => setDraft((prev) => [...prev, { kind: 'cnot', control, target }])}
            >
              Add CNOT
            </button>
          </div>

          <div>
            <p className="text-[11px] tracking-wide text-slate-500 uppercase">Sequence</p>
            <div
              role="list"
              aria-label="Two-qubit circuit sequence"
              className="mt-1.5 flex min-h-11 flex-wrap items-center gap-1 rounded-md border border-dashed border-white/15 bg-black/20 px-2 py-2"
              data-circuit={draft.map(labelOp).join(',')}
            >
              {draft.length === 0 ? (
                <span className="text-[11px] text-slate-500">
                  Build a sequence, then press Run to apply it from |00⟩.
                </span>
              ) : (
                draft.map((op, index) => (
                  <div
                    key={`${labelOp(op)}-${index}`}
                    role="listitem"
                    className={`inline-flex items-center gap-0.5 rounded-md border bg-[#10182a] pr-0.5 pl-2 ${
                      op.kind === 'local' ? TONE[op.gate] : 'border-amber-300/40 text-amber-100'
                    }`}
                  >
                    <span className="py-1 font-mono text-[11px]">{labelOp(op)}</span>
                    <button
                      type="button"
                      aria-label={`Remove step ${index + 1}`}
                      className="px-1 text-[11px] text-slate-500 hover:text-slate-200"
                      onClick={() => setDraft((prev) => prev.filter((_, i) => i !== index))}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-4 py-3">
          <button
            type="button"
            aria-label="Run circuit"
            className="rounded-md border border-sky-300/40 bg-sky-300/10 px-3 py-1.5 text-xs font-medium text-sky-100 hover:bg-sky-300/20 disabled:cursor-default disabled:opacity-40"
            disabled={draft.length === 0}
            onClick={() => {
              onRun(draft)
              onClose()
            }}
          >
            Run
          </button>
          <p className="text-[11px] text-slate-500">
            Applies left → right from |00⟩ onto the Bloch spheres and readouts.
          </p>
        </div>
      </div>
    </div>
  )
}
