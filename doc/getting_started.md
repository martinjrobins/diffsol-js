# Getting Started with @diffsol/js

This guide will help you get started with diffsol using the CDN.

## Installation

diffsol is available via CDN only (not published to npm). Load it in your HTML file:

```html
<!-- Load diffsol from CDN -->
<script src="https://diffsol-js.fly.dev/diffsol.min.js"></script>
```

For interactive visualizations, also load Plotly.js:

```html
<script src="https://cdn.plot.ly/plotly-2.26.0.min.js"></script>
```

## Quick Start with CDN

Here's a complete example using the CDN bundle in an HTML file:

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

  <!-- Load diffsol from CDN -->
  <script src="https://diffsol-js.fly.dev/diffsol.min.js"></script>

  <script>
    (async () => {
      // Access diffsol from global namespace
      const { compile, MatrixType, LinearSolverType, OdeSolverType } = window.diffsol;

      // Define your ODE in DiffSL
      const model = `
        in_i { k = 1 }
        u_i { y = 1 }
        F_i { -k * y }
        out_i { y }
      `;

      // Compile and create solver
      const ode = await compile(
        model,
        {
          backendUrl: 'https://diffsol-js.fly.dev',
        },
        MatrixType.FaerDense,
        LinearSolverType.Lu,
        OdeSolverType.Bdf
      );

      // Get initial conditions
      const params = new Float64Array([1.0]); // k = 1
      const y0 = ode.getY0(params);

      // Solve the ODE at specific time points
      const tEval = new Float64Array([0.0, 0.5, 1.0, 2.0]);
      const solution = ode.solveDense(params, tEval);
      const ys = solution.ys;

      // Display results
      const resultsDiv = document.getElementById('results');
      resultsDiv.innerHTML = `
        <p><strong>Initial conditions:</strong> ${Array.from(y0).join(', ')}</p>
        <p><strong>Solution at t=[0, 0.5, 1, 2]:</strong></p>
        <pre>${Array.from(ys).map((val, i) =>
          `t=${tEval[Math.floor(i/y0.length)]}: y=${val.toFixed(6)}`
        ).join('\n')}</pre>
      `;

      // Clean up
      solution.dispose();
      ode.dispose();
    })();
  </script>
</body>
</html>
```