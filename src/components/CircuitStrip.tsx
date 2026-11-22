import { useRef, useState } from 'react'
import { insertGate, moveGate, removeGate } from '../quantum/circuit.ts'
import { GATE_NAMES, type GateName } from '../quantum/qubit.ts'

const TONE: Record<GateName, string> = {
  I: 'border-slate-400/40 text-slate-200',
  X: 'border-rose-300/50 text-rose-100',
  Y: 'border-emerald-300/50 text-emerald-100',
  Z: 'border-sky-300/50 text-sky-100',
  H: 'border-amber-300/60 text-amber-100',
  S: 'border-violet-300/50 text-violet-100',
  T: 'border-cyan-300/50 text-cyan-100',
}

type DragPayload = { kind: 'palette'; gate: GateName } | { kind: 'circuit'; index: number }

export function CircuitStrip({
  gates,
  onChange,
  activeStep = null,
  disabled = false,
}: {
  gates: GateName[]
  onChange: (gates: GateName[]) => void
  activeStep?: number | null
  disabled?: boolean
}) {
  const dragRef = useRef<DragPayload | null>(null)
  const suppressClick = useRef(false)
  const [hover, setHover] = useState<number | null>(null)

  const commit = (next: GateName[]) => {
    if (disabled || sameGates(gates, next)) return
    onChange(next)
  }

  const dropAt = (index: number) => {
    const drag = dragRef.current
    dragRef.current = null
    setHover(null)
    if (disabled || !drag) return
    if (drag.kind === 'palette') {
      commit(insertGate(gates, drag.gate, index))
      return
    }
    commit(moveGate(gates, drag.index, index))
  }

  return (
    <div data-circuit={gates.join(',')} data-active-step={activeStep ?? ''}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] tracking-wide text-slate-500 uppercase">Wire</p>
        <button
          type="button"
          aria-label="Clear circuit"
          className="rounded-md border border-white/15 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-white/5 disabled:cursor-default disabled:border-white/5 disabled:text-slate-600"
          disabled={disabled || gates.length === 0}
          onClick={() => onChange([])}
        >
          Clear
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1" aria-label="Gate palette">
        {GATE_NAMES.map((gate) => (
          <button
            key={gate}
            type="button"
            draggable={!disabled}
            disabled={disabled}
            aria-label={`Add gate ${gate}`}
            className={`w-9 rounded-md border bg-[#0b1120] py-1.5 text-xs font-medium disabled:opacity-40 ${TONE[gate]}`}
            onDragStart={(event) => {
              if (disabled) return
              suppressClick.current = true
              dragRef.current = { kind: 'palette', gate }
              event.dataTransfer.setData('text/plain', `palette:${gate}`)
              event.dataTransfer.effectAllowed = 'copy'
            }}
            onDragEnd={() => {
              dragRef.current = null
              setHover(null)
              window.setTimeout(() => {
                suppressClick.current = false
              }, 0)
            }}
            onClick={() => {
              if (suppressClick.current) {
                suppressClick.current = false
                return
              }
              commit(insertGate(gates, gate, gates.length))
            }}
          >
            {gate}
          </button>
        ))}
      </div>

      <div
        role="list"
        aria-label="Circuit sequence"
        className="relative mt-3 flex min-h-14 min-w-0 items-center overflow-x-auto rounded-lg border border-white/10 bg-black/25 px-2"
        onDragOver={(event) => {
          if (disabled) return
          event.preventDefault()
          if (hover === null) setHover(gates.length)
        }}
        onDrop={(event) => {
          event.preventDefault()
          dropAt(hover ?? gates.length)
        }}
      >
        <div className="pointer-events-none absolute inset-x-3 top-1/2 h-px -translate-y-1/2 bg-white/20" />
        <span className="relative z-10 mr-1 shrink-0 font-mono text-[10px] text-slate-500">|ψ⟩</span>
        {gates.length === 0 ? (
          <span className="relative z-10 px-2 text-[11px] text-slate-500">
            Click or drop gates. They run left to right.
          </span>
        ) : (
          gates.map((gate, index) => (
            <div key={`${gate}-${index}`} className="relative z-10 flex items-center">
              <DropSlot index={index} active={hover === index} onHover={setHover} onDrop={dropAt} />
              <div
                role="listitem"
                draggable={!disabled}
                aria-current={activeStep === index ? 'step' : undefined}
                aria-label={`Circuit gate ${gate}, position ${index + 1}`}
                className={`flex items-center gap-0.5 rounded-md border bg-[#10182a] pr-0.5 pl-2 shadow-sm ${TONE[gate]} ${
                  activeStep === index ? 'ring-2 ring-sky-300/80' : ''
                }`}
                onDragStart={(event) => {
                  if (disabled) return
                  dragRef.current = { kind: 'circuit', index }
                  event.dataTransfer.setData('text/plain', `circuit:${index}`)
                  event.dataTransfer.effectAllowed = 'move'
                  event.stopPropagation()
                }}
                onDragEnd={() => {
                  dragRef.current = null
                  setHover(null)
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setHover(index)
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  dropAt(index)
                }}
              >
                <span className="py-1.5 font-mono text-xs">{gate}</span>
                <button
                  type="button"
                  aria-label={`Remove ${gate} at position ${index + 1}`}
                  disabled={disabled}
                  className="px-1 text-[11px] text-slate-500 hover:text-slate-200 disabled:opacity-40"
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={() => commit(removeGate(gates, index))}
                >
                  ×
                </button>
              </div>
            </div>
          ))
        )}
        {gates.length > 0 ? (
          <DropSlot
            index={gates.length}
            active={hover === gates.length}
            onHover={setHover}
            onDrop={dropAt}
          />
        ) : null}
      </div>
    </div>
  )
}

function DropSlot({
  index,
  active,
  onHover,
  onDrop,
}: {
  index: number
  active: boolean
  onHover: (index: number) => void
  onDrop: (index: number) => void
}) {
  return (
    <div
      aria-hidden
      className={`relative z-10 h-8 shrink-0 rounded ${active ? 'mx-0.5 w-3 bg-sky-300/50' : 'w-2'}`}
      onDragOver={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onHover(index)
      }}
      onDrop={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onDrop(index)
      }}
    />
  )
}

function sameGates(left: readonly GateName[], right: readonly GateName[]): boolean {
  return left.length === right.length && left.every((gate, index) => gate === right[index])
}
