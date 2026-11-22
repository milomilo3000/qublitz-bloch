# Qublitz Create Challenge - Interactive Bloch Sphere Visualizer

An interactive 3D quantum state and circuit visualizer built for the **Qublitz 2026 Create Challenge**. Qublitz bridges rigorous quantum mechanics ($2 \times 2$ and $4 \times 4$ density matrices, partial traces, and concurrence) with intuitive visual feedback so anyone—from first-time learners to quantum researchers—can see how quantum states, superposition, decoherence, and entanglement behave in real time.

---

## The Create Challenge: Making Quantum Mechanics Intuitive

Quantum computing is often taught either through intimidating linear algebra or oversimplified metaphors that hide real physics. Our goal for the **Qublitz Create Challenge** was to solve both problems at once:

1. **Progressive Abstraction for Every Audience:** Instead of forcing users to decode raw state vectors immediately, every gate, state transition, and purity change is paired with plain-English explanations (*"What You Are Seeing"*), one-click starter presets, and live measurement probability bars—while keeping exact density matrices, angles ($\theta, \phi$), and Bloch components one click away via **Show Math**.
2. **Authentic Mixed-State & Purity Physics:** Most visualizers only draw pure states on the surface of a Bloch sphere. Qublitz models full **density matrices** ($\rho$), allowing users to explore the interior of the sphere where purity $p \in [0, 1]$ represents quantum coherence/certainty ($p = 1$ on the shell, $p = 0$ at the maximally mixed center).
3. **Extending Intuitively from 1 Qubit to 2 Qubits:** A general entangled 2-qubit state cannot be drawn as a single arrow in 3D space. Rather than hiding entanglement or forcing users to decode abstract 7-sphere Hopf fibrations on the fly, Qublitz renders **two coupled local Bloch spheres** (computed via partial trace) alongside a **continuous Entanglement meter** ($E \in [0, 1]$) and **4-outcome joint probability bars** ($|00\rangle, |01\rangle, |10\rangle, |11\rangle$). Users literally watch individual qubit arrows shrink inward as entanglement rises.

---

## Key Features

### 1-Qubit Mode
* **Interactive 3D Bloch Sphere:** Drag the state tip directly in 3D space or rotate the camera to inspect $|0\rangle$, $|1\rangle$, $|+\rangle$, $|-\rangle$, $|+i\rangle$, and $|-i\rangle$.
* **Gate Transformations & Trajectory Trails:** Apply single-qubit gates (`I`, `X`, `Y`, `Z`, `H`, `S`, `T`) and watch smooth 3D geodesic arcs trace the evolution path while preserving purity $p$.
* **Certainty / Coherence ($p$) Control:** Adjust purity $p \in [0, 1]$ via slider or numeric input, or snap back to the pure outer surface.
* **Plain-English Narration & Math Drawer:** Real-time explanations of measurement odds (`P(|0>)`, `P(|1>)`) alongside a collapsible `2 × 2` density matrix and coordinate readout.

### 2-Qubit Mode
* **Dual Reduced Bloch Spheres (`Qubit 0` & `Qubit 1`):** Computed dynamically from the $4 \times 4$ joint density matrix via partial trace ($\rho_A = \text{Tr}_B(\rho_{AB})$, $\rho_B = \text{Tr}_A(\rho_{AB})$). Local vector length (`P`) automatically reflects entanglement with the partner qubit.
* **Continuous Entanglement Meter ($E \in [0, 1]$):** Tracks separable states ($E = 0$), partially entangled states ($0 < E < 1$), and maximally entangled Bell states ($E = 1$).
* **Joint Outcome Probabilities:** Live bars for $P(|00\rangle)$, $P(|01\rangle)$, $P(|10\rangle)$, and $P(|11\rangle)$ summing to $1.000$.
* **2-Wire Circuit Builder & Quick Gates:** Run single-qubit gates on `q0` or `q1` plus two-qubit `CNOT` (`q0 → q1`), with step-by-step playback and 2Q presets (*Bell Pair*, *Two Independent Flips*, *Product $|+0\rangle$*).

---

## Quick Demo Walkthroughs

### 1. Create Maximal Entanglement (Bell State, $E = 1.000$)
1. Switch to **2 qubit** mode and start from $|00\rangle$.
2. Apply **`H` on `q0`** (creates superposition $|+0\rangle$; entanglement stays `0.000`).
3. Apply **`CNOT` (`q0 → q1`)** (couples the qubits into $\frac{|00\rangle + |11\rangle}{\sqrt{2}}$; `P(|00>)` and `P(|11>)` become `0.500`, entanglement jumps to `1.000`, and both local Bloch vectors shrink to the center).

### 2. Create Partial Entanglement ($0 < E < 1$)
To demonstrate continuous entanglement between `0` and `1`:
1. Start from $|00\rangle$ in **2 qubit** mode.
2. Apply **`H` on `q0`**
3. Apply **`T` on `q0`**
4. Apply **`H` on `q0`** *(creates an asymmetric amplitude split on `q0`)*
5. Apply **`X` on `q1`**
6. Apply **`H` on `q1`**
7. Apply **`CNOT` (`q0 → q1`)** *(entangles the asymmetric branches so $E$ lands strictly between `0` and `1`, pulling both local arrows partway inward)*
8. Apply **`S` on `q1`** *(shifts relative phase while preserving partial entanglement)*

---

## Tech Stack & Architecture

* **Frontend:** React, TypeScript, Vite
* **3D Rendering:** Three.js / React Three Fiber (`@react-three/fiber`)
* **Quantum Simulation Engine:** Custom TypeScript complex matrix & density-operator engine supporting $2 \times 2$ and $4 \times 4$ states, tensor products, partial traces, Bloch vector projections, and continuous concurrence/entanglement metrics.
* **Verification & Stress Testing:** Vitest multi-suite test harness verifying gate unitarity, purity bounds, partial trace consistency, animation frame invariants, and partial entanglement accuracy.

---

## Getting Started

### Prerequisites
* Node.js (v18+ recommended)
* npm

### Installation & Local Development
```bash
git clone https://github.com/milomilo3000/qublitz-bloch.git
cd qublitz-bloch
npm install
npm run dev
```
Open the local URL printed by Vite (typically `http://127.0.0.1:5173` or `5175`).

### Running Tests & Type Checks
```bash
npx vitest run
npx tsc --noEmit
```

---

## License

Built for the **Qublitz 2026 Create Challenge**.
