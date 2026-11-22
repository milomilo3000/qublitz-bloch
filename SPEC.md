# Technical Specification

## Visual & UI Direction
- Inspired by an interactive hardware visual workbench:
  - Top bar with title, subtitle, and current lesson/module indicator
  - Right inspector panel with state math, purity/radius `p` control (`0 <= p <= 1`), gate buttons, and a live measurement/event log
  - Bottom lesson strip covering core concepts (Bloch Sphere & Purity `p`, Gates & Interference, Measurement & Collapse)
- Center stage has a reference unit sphere (`R = 1`) locked to the center of the viewport:
  - Panning is disabled (`enablePan={false}`), orbit target is `[0, 0, 0]`.
  - User can rotate 360 degrees around the centered sphere by dragging empty space/shell.

## Quantum, Purity (`p`), & Geometry Rules
- Quantum basis: `|0>` at North Pole (`+Z` in quantum coords), `|1>` at South Pole (`-Z` in quantum coords), `|+>` along `+X`, `|+i>` along `+Y`.
- Three.js uses `+Y` as up by default: map quantum `(qx, qy, qz)` to Three.js `(qx, qz, -qy)` consistently everywhere.
- Purity / vector magnitude `p` must ALWAYS stay clamped to `[0, 1]`:
  - `theta` in `[0, PI]`, `phi` in `[0, 2*PI)`, `p` in `[0, 1]`.
  - Bloch vector components:
    - `qx = p * sin(theta) * cos(phi)`
    - `qy = p * sin(theta) * sin(phi)`
    - `qz = p * cos(theta)`
  - State vector starts at origin `(0, 0, 0)` and ends at `(qx, qy, qz)` (inside or on the outer `R = 1` sphere depending on `p`).
  - Measurement probabilities for `|0>` and `|1>` come from `rho_00` and `rho_11`:
    - `P(|0>) = (1 + qz) / 2`
    - `P(|1>) = (1 - qz) / 2`
- Gate behavior:
  - Applying unitary gate `U` (`I`, `X`, `Y`, `Z`, `H`, `S`, `T`) transforms `rho -> U * rho * U^dagger`, preserving `p` and updating `(theta, phi, p)`.
- Dragging the vector tip handle:
  - Temporarily disable orbit rotation while dragging the tip, then re-enable on pointer up.
  - Dragging moves `(theta, phi)` while preserving current `p` (and provide a slider/number input in the UI to adjust `p` between `0` and `1`, plus a snap-to-surface `p = 1` button).