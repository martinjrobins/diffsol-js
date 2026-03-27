# @martinjrobins/diffsol-js

TypeScript/JavaScript bindings for the diffsol ODE solver with WebAssembly. See <https://github.com/martinjrobins/diffsol> for more details.

## API Documentation

<https://diffsol-js.fly.dev/docs>

## Installation

```bash
npm install @martinjrobins/diffsol-js
```

This package is a thin browser client. It requires a hosted diffsol backend that exposes:

- `POST /compile`
- `GET /wasm/diffsol_js.wasm`

The examples below use the public backend at `https://diffsol-js.fly.dev`.

## Usage

```ts
import {
  compile,
  MatrixType,
  LinearSolverType,
  OdeSolverType,
} from '@martinjrobins/diffsol-js';
```

```ts
const model = `
in_i { k = 1 }
u_i { y = 1 }
F_i { -k * y }
out_i { y }
`;

const ode = await compile(
  model,
  {
    backendUrl: 'https://diffsol-js.fly.dev',
  },
  MatrixType.FaerDense,
  LinearSolverType.Lu,
  OdeSolverType.Bdf
);

const params = new Float64Array([1.0]);
const y0 = ode.getY0(params);

const tEval = new Float64Array([0.0, 0.5, 1.0, 2.0]);
const solution = ode.solveDense(params, tEval);
const ys = solution.ys;

console.log('Initial conditions:', y0);
console.log('Solution:', ys);

solution.dispose();
ode.dispose();
```

## Interactive Solver UI

The package also ships the interactive solver stylesheet:

```ts
import '@martinjrobins/diffsol-js/interactive-solver.css';
```

If you are using the interactive UI components, your app must be able to bundle CSS and resolve the `plotly.js` dependency.

## CDN Usage

The build still produces `dist/diffsol.min.js` for CDN-style usage:

```html
<script src="https://diffsol-js.fly.dev/diffsol.min.js"></script>
```

In that mode the API is available at `window.diffsol`.

## Development

```bash
npm install
npm run test:offline
npm test
npm run build
npm run docs
```

## Publishing

From the `js/` directory:

```bash
npm publish
```

`prepublishOnly` runs the full test suite and rebuilds the package before publishing. Tests default to `https://diffsol-js.fly.dev` and can be overridden with `DIFFSOL_BACKEND_URL` if needed. Replace the placeholder repository metadata in `package.json` before the first real release from the new repo.
