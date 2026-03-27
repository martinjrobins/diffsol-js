# Interactive Solver Component

The interactive solver provides a web-based UI with sliders and live Plotly plots for real-time parameter exploration. The system automatically discovers model inputs and outputs from the compiled backend and provides sensible defaults, with optional customization for labels, ranges, and more.

## Features

- **Code Editor** - Built-in code editor (Prism Code Editor) with 14 themes and configurable height
- **Live Code Editing** - Edit DiffSL model code and recompile on demand with compile button
- **Theme Support** - 14 available editor themes (github-light, dracula, night-owl, etc.)
  - Change theme at runtime with `setCodeEditorTheme(divId, theme)`
  - Dynamic theme switching without page reload
- **Dynamic Editor Height** - Height auto-calculated from line count or set manually
  - Adjust height at runtime with `setCodeEditorHeight(divId, height)`
- **Help & Edit Dialogs** - Help button includes an edit dialog for slider/output labels and ranges
  - Buttons positioned at any corner (top-left, top-right, bottom-left, bottom-right)
  - Help dialog can provide custom HTML or use default help text
- **Real-time Updates** - ODE re-solves automatically as sliders change (50ms debounce, configurable)
- **Plotly Visualization** - Interactive plots with zoom, pan, export
- **Error Handling** - Errors displayed in-place with full plot area for readability
  - Error replaces plot while maintaining consistent layout
  - Code compile/solve errors shown automatically (no `.catch()` needed)
- **Multiple Outputs** - Automatically plots all model outputs as separate traces with custom labels
- **Auto-calculated Steps** - Sliders automatically use 100 intervals between min and max
- **External Styles** - Include the CSS file to style the UI (override as needed)
- **Responsive Design** - Adapts to different screen sizes
- **Customizable Solvers** - Choose ODE and linear solver types

## Quick Example

```javascript
// Access from global namespace when using CDN
const { createInteractiveSolver } = window.diffsol;

await createInteractiveSolver({
  divId: 'solver',
  diffslCode: `
    in_i { k = 1 }
    u_i { y = 1 }
    F_i { -k * y }
    out_i { y }
  `,
  sliders: {
    k: {
      label: 'Decay Rate',
      min: 0.1,
      max: 5,
      initial: 1,
    },
  },
  outputs: {
    y: {
      label: 'y(t)',
    },
  },
  moduleConfig: {
    backendUrl: 'https://diffsol-js.fly.dev',
  },
});
```

## Complete HTML Example with CDN

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>diffsol Interactive Solver</title>
  <style>
    /* Optional: Custom page styling */
    body {
      max-width: 1200px;
      margin: 40px auto;
      padding: 20px;
      background: #f5f5f5;
    }
    h1 {
      color: #333;
      margin-bottom: 20px;
    }
    #solver {
      background: white;
      padding: 24px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
  </style>
</head>
<body>
  <h1>Exponential Decay Model</h1>
  <div id="solver"></div>

  <!-- Load Plotly from CDN -->
  <script src="https://cdn.plot.ly/plotly-2.26.0.min.js"></script>

  <!-- Load diffsol styles and bundle from CDN -->
  <link rel="stylesheet" href="https://diffsol-js.fly.dev/interactive-solver.css" />
  <script src="https://diffsol-js.fly.dev/diffsol.min.js"></script>

  <script>
    // Access diffsol from global namespace
    const { createInteractiveSolver, MatrixType, LinearSolverType, OdeSolverType } = window.diffsol;

    // Create interactive solver (styles and errors are handled automatically)
    createInteractiveSolver({
      divId: 'solver',
      diffslCode: `
        in_i { k = 1 }
        u_i { y = 1 }
        F_i { -k * y }
        out_i { y }
      `,
      sliders: {
        k: {
          label: 'Decay Rate (k)',
          min: 0.1,
          max: 5,
          initial: 1,
        },
      },
      outputs: {
        y: {
          label: 'y(t)',
        },
      },
      moduleConfig: {
        backendUrl: 'https://diffsol-js.fly.dev',
      },
      finalTime: 3.0,
      numTimePoints: 100,
      matrixType: MatrixType.FaerDense,
      linearSolverType: LinearSolverType.Lu,
      odeSolverType: OdeSolverType.Bdf,
      // Code editor options
      showCodeEditor: true,
      codeEditorTheme: 'github-light',      // or 'dracula', 'night-owl', etc.
      codeEditorHeight: 'auto',              // auto-calculated from line count
      // Help dialog options
      showHelp: true,
      helpButtonPosition: 'bottom-right',
    });
    // Note: No .catch() needed - errors are displayed in the UI automatically
  </script>
</body>
</html>
```

## Configuration Reference

### `InteractiveSolverConfig`

Complete configuration interface:

```typescript
interface InteractiveSolverConfig {
  // Required: DOM element ID to populate
  divId: string;

  // Required: DiffSL model code
  diffslCode: string;

  // Required: Backend configuration
  moduleConfig: ModuleConfig;

  // Optional: Slider configurations - map keyed by input name
  // Backend automatically discovers inputs; use this to customize labels, ranges, etc.
  sliders?: Record<string, SliderConfigMap>;

  // Optional: Output configurations - map keyed by output name
  // Backend automatically discovers outputs; use this to customize labels
  outputs?: Record<string, OutputConfigMap>;

  // Optional: Solver configuration
  odeSolverType?: OdeSolverType;           // default: Bdf
  linearSolverType?: LinearSolverType;     // default: Default
  matrixType?: MatrixType;                 // default: FaerDense

  // Optional: Visualization options
  finalTime?: number;                      // default: 1.0
  plotHeight?: number;                     // default: 500px
  numTimePoints?: number;                  // default: 200
  debounceMs?: number;                     // default: 50ms
  plotTitle?: string;                      // optional plot title (no title if not provided)

  // Optional: Code editor options
  showCodeEditor?: boolean;                // default: true
  codeEditorWidth?: string;                // default: "60%" (width of editor, sliders take rest)
  readOnlyCode?: boolean;                  // default: false (allows editing and recompilation)
  codeEditorTheme?: CodeEditorTheme;       // default: "github-light"
  codeEditorHeight?: number | string;      // default: auto-calculated from line count

  // Optional: Help dialog options
  showHelp?: boolean;                      // default: true
  helpButtonPosition?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';  // default: "bottom-right"
  customHelpContent?: string;              // optional custom HTML help content
}
```

### `SliderConfigMap`

Configuration for individual sliders:

```typescript
interface SliderConfigMap {
  label?: string;         // Display label (defaults to input name)
  min?: number;          // Minimum value (default: 0)
  max?: number;          // Maximum value (default: 1)
  initial?: number;      // Initial value (default: 0.5)
  // Note: step is calculated automatically for 100 intervals
}
```

**Example:**
```typescript
sliders: {
  k: {
    label: 'Decay Rate',
    min: 0.1,
    max: 5,
    initial: 1,
  },
  a: {
    label: 'Amplitude',
    min: 0,
    max: 10,
    initial: 5,
  },
}
```

### `OutputConfigMap`

Configuration for output traces:

```typescript
interface OutputConfigMap {
  label?: string;        // Display label (defaults to output name)
}
```

**Example:**
```typescript
outputs: {
  y: {
    label: 'y(t) - Solution',
  },
  z: {
    label: 'z(t) - Derivative',
  },
}
```

### Available Code Editor Themes

```typescript
type CodeEditorTheme =
  | 'atom-one-dark'
  | 'dracula'
  | 'github-dark'
  | 'github-dark-dimmed'
  | 'github-light'
  | 'night-owl'
  | 'night-owl-light'
  | 'prism'
  | 'prism-okaidia'
  | 'prism-solarized-light'
  | 'prism-tomorrow'
  | 'prism-twilight'
  | 'vs-code-dark'
  | 'vs-code-light';
```

## Runtime Functions

### `setCodeEditorTheme()`

Change the code editor theme at runtime.

```typescript
async function setCodeEditorTheme(
  divId: string,
  theme: CodeEditorTheme
): Promise<void>
```

**Example with Theme Switcher:**

```javascript
// Access from global namespace when using CDN
const { createInteractiveSolver, setCodeEditorTheme } = window.diffsol;

// Create solver
await createInteractiveSolver({
  divId: 'solver',
  diffslCode: '...',
  sliders: { k: { label: 'k', min: 0, max: 1, initial: 0.5 } },
  moduleConfig: { backendUrl: 'https://diffsol-js.fly.dev' },
  codeEditorTheme: 'github-light',
});

// Add theme switcher buttons
document.getElementById('dark-btn').addEventListener('click', async () => {
  await setCodeEditorTheme('solver', 'dracula');
});

document.getElementById('light-btn').addEventListener('click', async () => {
  await setCodeEditorTheme('solver', 'github-light');
});
```

### `setCodeEditorHeight()`

Change the code editor height at runtime.

```typescript
function setCodeEditorHeight(
  divId: string,
  height: number | string
): void
```

**Examples:**

```javascript
// Access from global namespace when using CDN
const { setCodeEditorHeight } = window.diffsol;

setCodeEditorHeight('solver', 300);        // 300px
setCodeEditorHeight('solver', '50vh');     // 50% viewport height
setCodeEditorHeight('solver', 'auto');     // Auto-calculate from code
```

## Styling Customization

The interactive solver styles are provided in `dist/interactive-solver.css`. Include this file alongside the JS bundle, then override any rules as needed.

All elements use CSS classes prefixed with `diffsol-interactive-solver-`.

### Key CSS Classes

**Layout:**
- `.diffsol-interactive-solver-container` - Main container
- `.diffsol-interactive-solver-code-panel` - Code editor panel wrapper
- `.diffsol-interactive-solver-sliders` - Sliders grid container

**Code Editor:**
- `.diffsol-interactive-solver-code-editor-container` - Code editor container
- `.diffsol-interactive-solver-code-editor` - Code editor wrapper (scrollable)
- `.diffsol-interactive-solver-compile-button` - Compile & Run button

**Sliders:**
- `.diffsol-interactive-solver-slider-group` - Individual slider group
- `.diffsol-interactive-solver-label` - Slider label
- `.diffsol-interactive-solver-slider-row` - Slider + value row
- `.diffsol-interactive-solver-input` - Range input element
- `.diffsol-interactive-solver-value` - Value display

**Plot & Errors:**
- `.diffsol-interactive-solver-plot` - Plotly plot container
- `.diffsol-interactive-solver-error` - Error message display (replaces plot on error)

**Help & Dialogs:**
- `.diffsol-interactive-solver-help-button` - Help button
- `.diffsol-interactive-solver-edit-button` - Edit button
- `.diffsol-interactive-solver-edit-dialog` - Edit dialog

### Example Customizations

```css
/* Override code editor colors */
.diffsol-interactive-solver-code-editor {
  background: #1e1e1e;
  --diffsol-editor-height: 400px;
}

/* Override slider colors */
.diffsol-interactive-solver-input {
  background: linear-gradient(to right, #ff6b6b, #4ecdc4) !important;
}

.diffsol-interactive-solver-input::-webkit-slider-thumb {
  background: #ff6b6b;
}

/* Customize labels */
.diffsol-interactive-solver-label {
  font-size: 16px;
  color: #2d3748;
  text-transform: uppercase;
}

/* Customize compile button */
.diffsol-interactive-solver-compile-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.diffsol-interactive-solver-compile-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
}

/* Override error styling */
.diffsol-interactive-solver-error {
  background-color: #fee;
  color: #c62828;
}
```

## Advanced Examples

### Multi-Parameter Model

```javascript
// Access from global namespace when using CDN
const { createInteractiveSolver } = window.diffsol;

await createInteractiveSolver({
  divId: 'solver',
  diffslCode: `
    in_i {
      a = 1,
      b = 0.5,
      c = 2
    }
    u_i {
      x = 1,
      y = 0
    }
    F_i {
      a * x - b * x * y,
      c * x * y - y
    }
    out_i { x, y }
  `,
  sliders: {
    a: { label: 'Prey Growth (a)', min: 0.1, max: 3, initial: 1 },
    b: { label: 'Predation Rate (b)', min: 0.1, max: 2, initial: 0.5 },
    c: { label: 'Predator Growth (c)', min: 0.1, max: 3, initial: 2 },
  },
  outputs: {
    x: { label: 'Prey Population' },
    y: { label: 'Predator Population' },
  },
  moduleConfig: { backendUrl: 'http://localhost:8080' },
  finalTime: 20,
  plotTitle: 'Lotka-Volterra Predator-Prey Model',
});
```

### Custom Help Content

```javascript
const { createInteractiveSolver } = window.diffsol;

await createInteractiveSolver({
  divId: 'solver',
  diffslCode: '...',
  sliders: { k: { label: 'k', min: 0, max: 1, initial: 0.5 } },
  moduleConfig: { backendUrl: 'https://diffsol-js.fly.dev' },
  showHelp: true,
  customHelpContent: `
    <h2>My Custom Help</h2>
    <p>This is a custom help dialog with instructions for your specific model.</p>
    <ul>
      <li>Parameter k controls the decay rate</li>
      <li>Higher values lead to faster decay</li>
      <li>Click compile after editing code</li>
    </ul>
  `,
});
```

### Read-Only Code Display

```javascript
const { createInteractiveSolver } = window.diffsol;

await createInteractiveSolver({
  divId: 'solver',
  diffslCode: '...',
  sliders: { k: { label: 'k', min: 0, max: 1, initial: 0.5 } },
  moduleConfig: { backendUrl: 'https://diffsol-js.fly.dev' },
  showCodeEditor: true,
  readOnlyCode: true,  // Disable editing and hide compile button
});
```

### Hide Code Editor

```javascript
const { createInteractiveSolver } = window.diffsol;

await createInteractiveSolver({
  divId: 'solver',
  diffslCode: '...',
  sliders: { k: { label: 'k', min: 0, max: 1, initial: 0.5 } },
  moduleConfig: { backendUrl: 'https://diffsol-js.fly.dev' },
  showCodeEditor: false,  // Only show sliders and plot
});
```

## Best Practices

### Debouncing

The default debounce of 50ms works well for most cases. For computationally expensive models, increase it:

```typescript
debounceMs: 200,  // Wait 200ms after slider stops moving
```

### Number of Time Points

Balance between smoothness and performance:

```typescript
numTimePoints: 100,   // Faster, less smooth
numTimePoints: 500,   // Slower, smoother
```

### Plot Height

Adjust for your layout:

```typescript
plotHeight: 400,      // Compact
plotHeight: 600,      // Standard
plotHeight: 800,      // Large
```

### Error Handling

Errors are automatically displayed in the UI - no need for `.catch()`:

```javascript
const { createInteractiveSolver } = window.diffsol;

// Errors shown automatically
createInteractiveSolver({...});

// Still works if you want custom handling
createInteractiveSolver({...})
  .catch(error => {
    console.error('Additional logging:', error);
  });
```

## Troubleshooting

**Sliders not appearing**
- Ensure your DiffSL code has `in_i { ... }` declarations
- Check that backend compilation succeeded
- Verify slider configuration keys match input names

**Plot not rendering**
- Make sure Plotly.js is loaded before diffsol
- Check browser console for errors
- Verify the target div exists

**Theme not changing**
- Ensure you're using `setCodeEditorTheme()` not direct DOM manipulation
- Check that the theme name is spelled correctly
- Verify the solver was created with `showCodeEditor: true`

**Code editor height issues**
- Try `'auto'` for automatic calculation
- Use explicit pixel values for fixed height
- Use viewport units (`'50vh'`) for responsive sizing

## Next Steps

- [Getting Started](getting_started.md) - Basic usage examples
- [API Overview](overview_api.md) - Complete API reference
- [Overview](overview.md) - Architecture details
