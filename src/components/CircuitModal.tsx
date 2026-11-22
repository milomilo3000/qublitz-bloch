import { useEffect } from 'react'
import type { Complex, GateName, QubitState } from '../quantum/qubit.ts'
import { CircuitStrip } from './CircuitStrip.tsx'

export type MeasurementLogEntry = {
  id: number
  outcome: 0 | 1
  p0: number
  p1: number
}

export type CircuitReadout = {
  state: QubitState
  vector: { qx: number; qy: number; qz: number }
  rho: [[Complex, Complex], [Complex, Complex]]
  probs: { p0: number; p1: number }
}

export function CircuitModal({
  open,
  onClose,
  gates,
  onChange,
  activeStep,
  playing,
  onPlay,
  onReset,
  onMeasure,
  readout,
  log,
}: {
  open: boolean
  onClose: () => void
  gates: GateName[]
  onChange: (gates: GateName[]) => void
  activeStep: number | null
  playing: boolean
  onPlay: () => void
  onReset: () => void
  onMeasure: () => void
  readout: CircuitReadout
  log: MeasurementLogEntry[]
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !playing) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, playing])

  if (!open) return null

  const { state, vector, rho, probs } = readout

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close circuit overlay"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        onClick={() => {
          if (!playing) onClose()
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quantum circuit"
        className="relative z-10 flex max-h-[min(90vh,40rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c1220] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <p className="text-[11px] tracking-[0.2em] text-slate-500 uppercase">Circuit</p>
            <h2 className="text-base font-medium text-slate-100">Single-qubit wire</h2>
          </div>
          <button
            type="button"
            aria-label="Close circuit"
            className="rounded-md border border-white/15 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-40"
            disabled={playing}
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-4">
          <CircuitStrip
            gates={gates}
            onChange={onChange}
            activeStep={activeStep}
            disabled={playing}
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-label="Play circuit"
              className="rounded-md border border-sky-300/40 bg-sky-300/10 px-3 py-1.5 text-xs font-medium text-sky-100 hover:bg-sky-300/20 disabled:cursor-default disabled:opacity-40"
              disabled={playing || gates.length === 0}
              onClick={onPlay}
            >
              Play
            </button>
            <button
              type="button"
              aria-label="Reset circuit playback"
              className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/5 disabled:opacity-40"
              disabled={playing}
              onClick={onReset}
            >
              Reset path
            </button>
            <button
              type="button"
              aria-label="Measure circuit"
              className="ml-auto rounded-md border border-amber-300/40 bg-amber-300/10 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-300/20 disabled:opacity-40"
              disabled={playing}
              onClick={onMeasure}
            >
              Measure
            </button>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] tracking-wide text-slate-500 uppercase">Live state</p>
              <output
                className="mt-1 block font-mono text-[11px] leading-5 text-slate-300"
                data-theta={state.theta}
                data-phi={state.phi}
                data-p={state.p}
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
                θ {state.theta.toFixed(3)} · φ {state.phi.toFixed(3)} · p {formatPurity(state.p)}
                <br />
                qx {vector.qx.toFixed(3)} · qy {vector.qy.toFixed(3)} · qz {vector.qz.toFixed(3)}
              </output>
              <p className="mt-3 text-[11px] tracking-wide text-slate-500 uppercase">Density matrix ρ</p>
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
            <div>
              <p className="text-[11px] tracking-wide text-slate-500 uppercase">Readout</p>
              <div className="mt-2 space-y-2 font-mono text-xs">
                <Probability label="P(|0>)" value={probs.p0} />
                <Probability label="P(|1>)" value={probs.p1} />
              </div>
              <p className="mt-4 text-[11px] tracking-wide text-slate-500 uppercase">
                Measurement log
              </p>
              <ul
                aria-label="Measurement log"
                className="mt-1 max-h-28 space-y-1 overflow-y-auto font-mono text-[11px] text-slate-400"
              >
                {log.length === 0 ? (
                  <li>No measurements yet.</li>
                ) : (
                  log.map((entry) => (
                    <li key={entry.id}>
                      → |{entry.outcome}⟩ · P0 {entry.p0.toFixed(3)} · P1 {entry.p1.toFixed(3)}
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Probability({ label, value }: { label: string; value: number }) {
  const width = `${Math.min(100, Math.max(0, value * 100))}%`
  return (
    <div>
      <div className="flex justify-between text-slate-300">
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
