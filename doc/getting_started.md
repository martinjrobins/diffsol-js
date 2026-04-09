# Getting Started with @martinjrobins/diffsol-js

This guide shows two ways to get started with diffsol:

1. Install `@martinjrobins/diffsol-js` from npm in a bundler-based app.
2. Load the CDN bundle directly in the browser.

In both cases, the package bundles the runtime WASM and requires a backend that exposes:

- `POST /compile`

The examples below use the public backend at `https://diffsol-js.fly.dev`.

## Getting Started with npm

Install the package:

```bash
npm install @martinjrobins/diffsol-js
```

Then import the API in your application code:

```ts
import {
  compile,
  MatrixType,
  LinearSolverType,
  OdeSolverType,
} from '@martinjrobins/diffsol-js';

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

console.log('Initial conditions:', y0);
console.log('Solution:', solution.ys);

solution.dispose();
ode.dispose();
```

## Getting Started with the CDN

If you do not want to bundle the package, you can load the prebuilt browser bundle instead.

For interactive visualizations, also load Plotly.js:

```html
<script src="https://cdn.plot.ly/plotly-2.26.0.min.js"></script>
```

Here is a complete HTML example using the CDN bundle:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>diffsol Example</title>
</head>
<body>
  <h1>Exponential Decay</h1>
  <div id="results"></div>

  <script src="https://diffsol-js.fly.dev/diffsol.min.js"></script>

  <script>
    (async () => {
      const { compile, MatrixType, LinearSolverType, OdeSolverType } = window.diffsol;

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

      const resultsDiv = document.getElementById('results');
      resultsDiv.innerHTML = `
        <p><strong>Initial conditions:</strong> ${Array.from(y0).join(', ')}</p>
        <p><strong>Solution at t=[0, 0.5, 1, 2]:</strong></p>
        <pre>${Array.from(ys).map((val, i) =>
          `t=${tEval[Math.floor(i / y0.length)]}: y=${val.toFixed(6)}`
        ).join('\n')}</pre>
      `;

      solution.dispose();
      ode.dispose();
    })();
  </script>
</body>
</html>
```
