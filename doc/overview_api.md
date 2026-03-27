# API Overview

This document provides a high-level overview of the @martinjrobins/diffsol-js TypeScript API.

## Core Functions

### [`compile()`](../functions/index.compile.html)

Compiles DiffSL code and returns a ready-to-use solver.

```typescript
async function compile(
  diffslCode: string,
  config: ModuleConfig,
  matrixType: MatrixType,
  linearSolver?: LinearSolverType,
  odeSolver?: OdeSolverType
): Promise<Ode>
```

**Parameters:**

- **`diffslCode`** - DiffSL source code defining your ODE system
- **`config`** - Configuration for WASM modules ([`ModuleConfig`](../interfaces/index.ModuleConfig.html))
  - `backendUrl` - URL to the backend compilation service (also serves runtime WASM)
  - `initialMemoryPages?` - Initial memory size in pages, 64KB each (default: 256 = 16MB)
  - `maxMemoryPages?` - Maximum memory size in pages (default: 32768 = 2GB)
  - `sharedMemory?` - Enable shared memory for threading (default: false, not yet supported)
- **`matrixType`** - Matrix storage format ([`MatrixType`](../enums/index.MatrixType.html))
  - `MatrixType.NalgebraDense` - Dense matrix (nalgebra)
  - `MatrixType.FaerDense` - Dense matrix (faer)
  - `MatrixType.FaerSparse` - Sparse matrix (faer)
- **`linearSolver`** - Linear solver type ([`LinearSolverType`](../enums/index.LinearSolverType.html), optional, default: Default)
  - `LinearSolverType.Default` - Use solver's default
  - `LinearSolverType.Lu` - LU decomposition
  - `LinearSolverType.Klu` - KLU sparse solver
- **`odeSolver`** - ODE solver method ([`OdeSolverType`](../enums/index.OdeSolverType.html), optional, default: Bdf)
  - `OdeSolverType.Bdf` - Backward Differentiation Formula (stiff problems)
  - `OdeSolverType.Esdirk34` - ESDIRK method
  - `OdeSolverType.TrBdf2` - TR-BDF2 method
  - `OdeSolverType.Tsit45` - Tsitouras 4/5 (non-stiff problems)

**Returns:** [`Ode`](../classes/index.Ode.html) instance

**Example:**

```javascript
// Access from global namespace when using CDN
const { compile, MatrixType, LinearSolverType, OdeSolverType } = window.diffsol;

const ode = await compile(
  model,
  { backendUrl: 'https://diffsol-js.fly.dev' },
  MatrixType.FaerDense,
  LinearSolverType.Lu,
  OdeSolverType.Bdf
);
```

## The [`Ode`](../classes/index.Ode.html) Class

Main solver class for working with ODEs.

### Methods

#### [`getY0(params: Float64Array): Float64Array`](../classes/index.Ode.html#getY0)

Get initial conditions for the ODE system.

**Parameters:**
- `params` - Parameter values (must match the order of `in_i` declarations in DiffSL)

**Returns:** Initial state vector

**Example:**
```typescript
const params = new Float64Array([1.0, 2.0]);
const y0 = ode.getY0(params);
```

---

#### [`rhs(params: Float64Array, t: number, y: Float64Array): Float64Array`](../classes/index.Ode.html#rhs)

Evaluate the right-hand side function at time `t` and state `y`.

**Parameters:**
- `params` - Parameter values
- `t` - Time point
- `y` - State vector

**Returns:** Derivative vector (dy/dt)

**Example:**
```typescript
const dydt = ode.rhs(params, 1.0, y);
```

---

#### [`solve(params: Float64Array, finalTime: number, solution?: Solution): Solution`](../classes/index.Ode.html#solve)

Solve ODE from initial time to final time using adaptive time stepping.

**Parameters:**
- `params` - Parameter values
- `finalTime` - Final time to integrate to
- `solution?` - Optional existing solution object to reuse (avoids memory allocation)

**Returns:** [`Solution`](../classes/index.Solution.html) object with adaptive time steps

**Example:**
```typescript
const solution = ode.solve(params, 5.0);
console.log('Times:', solution.ts);
console.log('Values:', solution.ys);
solution.dispose();
```

---

#### [`solveDense(params: Float64Array, tEval: Float64Array, solution?: Solution): Solution`](../classes/index.Ode.html#solveDense)

Solve ODE at specific time points (uses interpolation).

**Parameters:**
- `params` - Parameter values
- `tEval` - Time points where solution is desired
- `solution?` - Optional existing solution object to reuse

**Returns:** [`Solution`](../classes/index.Solution.html) object with values at specified times

**Example:**
```typescript
const tEval = new Float64Array([0, 0.5, 1.0, 2.0]);
const solution = ode.solveDense(params, tEval);
console.log('Solution:', solution.ys);
solution.dispose();
```

---

#### [`solveFwdSens(params: Float64Array, tEval: Float64Array, solution?: Solution): Solution`](../classes/index.Ode.html#solveFwdSens)

Solve ODE with forward sensitivities at specific time points.

Forward sensitivities compute how the solution changes with respect to parameters: ∂y/∂p.

**Parameters:**
- `params` - Parameter values
- `tEval` - Time points where solution and sensitivities are desired
- `solution?` - Optional existing solution object to reuse

**Returns:** [`Solution`](../classes/index.Solution.html) object with values and sensitivities at specified times

**Example:**
```typescript
const solution = ode.solveFwdSens(params, tEval);
// solution.ys contains both states and sensitivities
solution.dispose();
```

---

### Properties

#### [`rtol`](../classes/index.Ode.html#rtol) (getter/setter)

Get or set the relative tolerance for the solver.

**Type:** `number`
**Default:** `1e-6`

**Example:**
```typescript
const currentRtol = ode.rtol;  // getter
ode.rtol = 1e-8;                // setter - tighter tolerance
```

---

#### [`atol`](../classes/index.Ode.html#atol) (getter/setter)

Get or set the absolute tolerance for the solver.

**Type:** `number`
**Default:** `1e-6`

**Example:**
```typescript
const currentAtol = ode.atol;  // getter
ode.atol = 1e-10;               // setter - tighter tolerance
```

---

### Resource Management

#### [`dispose(): void`](../classes/index.Ode.html#dispose)

Free solver resources. Always call when done to prevent memory leaks.

**Example:**
```typescript
ode.dispose();
```

---

## The [`Solution`](../classes/index.Solution.html) Class

Represents the solution to an ODE.

### Properties

- **[`ts`](../classes/index.Solution.html#ts)** - `Float64Array` of time points
- **[`ys`](../classes/index.Solution.html#ys)** - `Float64Array` of solution values (flattened: [y1_t0, y2_t0, ..., y1_t1, y2_t1, ...])

### Methods

#### [`dispose(): void`](../classes/index.Solution.html#dispose)

Free solution resources.

**Example:**
```typescript
const solution = ode.solve(params, 5.0);
// Use solution...
solution.dispose();
```

---

## Enumerations

### [`MatrixType`](../enums/index.MatrixType.html)

Matrix storage format options:

- `MatrixType.NalgebraDense` - Dense matrix using nalgebra backend
- `MatrixType.FaerDense` - Dense matrix using faer backend (recommended)
- `MatrixType.FaerSparse` - Sparse matrix using faer backend

**Usage:**
```javascript
// Access from global namespace when using CDN
const { MatrixType } = window.diffsol;
const ode = await compile(model, config, MatrixType.FaerDense);
```

---

### [`LinearSolverType`](../enums/index.LinearSolverType.html)

Linear solver algorithm options:

- `LinearSolverType.Default` - Use the ODE solver's default linear solver
- `LinearSolverType.Lu` - LU decomposition (dense matrices)
- `LinearSolverType.Klu` - KLU sparse solver (sparse matrices)

**Usage:**
```javascript
// Access from global namespace when using CDN
const { LinearSolverType } = window.diffsol;
const ode = await compile(model, config, matrixType, LinearSolverType.Lu);
```

---

### [`OdeSolverType`](../enums/index.OdeSolverType.html)

ODE solver method options:

- `OdeSolverType.Bdf` - Backward Differentiation Formula (best for stiff problems)
- `OdeSolverType.Esdirk34` - Explicit Singly Diagonally Implicit Runge-Kutta method
- `OdeSolverType.TrBdf2` - TR-BDF2 method (trapezoidal rule + BDF2)
- `OdeSolverType.Tsit45` - Tsitouras 4/5 Runge-Kutta (best for non-stiff problems)

**Usage:**
```javascript
// Access from global namespace when using CDN
const { OdeSolverType } = window.diffsol;
const ode = await compile(model, config, matrixType, linearSolver, OdeSolverType.Bdf);
```

---

## Interactive Solver Functions

For building interactive UIs with live plotting:

### [`createInteractiveSolver()`](../functions/index.createInteractiveSolver.html)

Creates an interactive solver UI with sliders and real-time plotting.

```typescript
async function createInteractiveSolver(
  config: InteractiveSolverConfig
): Promise<void>
```

See [Interactive Solver](interactive_solver.md) for detailed documentation.

---

### [`setCodeEditorTheme()`](../functions/index.setCodeEditorTheme.html)

Change the code editor theme at runtime.

```typescript
async function setCodeEditorTheme(
  divId: string,
  theme: CodeEditorTheme
): Promise<void>
```

**Example:**
```javascript
// Access from global namespace when using CDN
const { setCodeEditorTheme } = window.diffsol;
await setCodeEditorTheme('solver', 'dracula');
```

---

### [`setCodeEditorHeight()`](../functions/index.setCodeEditorHeight.html)

Change the code editor height at runtime.

```typescript
function setCodeEditorHeight(
  divId: string,
  height: number | string
): void
```

**Example:**
```javascript
// Access from global namespace when using CDN
const { setCodeEditorHeight } = window.diffsol;
setCodeEditorHeight('solver', 300);      // 300px
setCodeEditorHeight('solver', '50vh');   // 50% viewport height
setCodeEditorHeight('solver', 'auto');   // Auto-calculate
```

---

## TypeScript Interfaces

### [`ModuleConfig`](../interfaces/index.ModuleConfig.html)

Configuration for WASM module initialization:

```typescript
interface ModuleConfig {
  backendUrl: string;              // Backend service URL
  initialMemoryPages?: number;     // Initial memory (default: 256 = 16MB)
  maxMemoryPages?: number;         // Max memory (default: 32768 = 2GB)
  sharedMemory?: boolean;          // Enable shared memory (default: false)
}
```

---

## Best Practices

### Memory Management

Always dispose of resources:

```typescript
const solution = ode.solve(params, 5.0);
try {
  // Use solution...
} finally {
  solution.dispose();
}

// When completely done with solver
ode.dispose();
```

### Reusing Solutions

For repeated solves, reuse solution objects to avoid allocations:

```typescript
let solution = ode.solve(params1, 5.0);

// Reuse the same solution object
solution = ode.solve(params2, 5.0, solution);
solution = ode.solve(params3, 5.0, solution);

solution.dispose();
```

### Choosing Solver Types

- **Stiff problems** (fast dynamics, chemical reactions): Use `OdeSolverType.Bdf`
- **Non-stiff problems** (orbital mechanics): Use `OdeSolverType.Tsit45`
- **Dense problems** (small systems): Use `MatrixType.FaerDense` with `LinearSolverType.Lu`
- **Sparse problems** (large systems): Use `MatrixType.FaerSparse` with `LinearSolverType.Klu`

### Error Handling

```typescript
try {
  const ode = await compile(model, config, matrixType);
  const solution = ode.solve(params, 5.0);
  // Use solution...
  solution.dispose();
  ode.dispose();
} catch (error) {
  console.error('Solver error:', error);
}
```

---

## Next Steps

- [Getting Started](getting_started.md) - Quick start examples
- [Interactive Solver](interactive_solver.md) - Build interactive UIs
- [Overview](overview.md) - Architecture and system design

For complete API documentation, see the [TypeDoc generated docs](https://diffsol-js.fly.dev/docs/).
