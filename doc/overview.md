# @diffsol/js - Overview

TypeScript/JavaScript bindings for diffsol ODE solver with WebAssembly.

## What is diffsol?

diffsol is a high-performance ordinary differential equation (ODE) solver written in Rust. It provides a powerful and flexible way to solve mathematical models defined using the DiffSL domain-specific language.

## Architecture

### Two-Module WebAssembly System

The library uses a two-module architecture for optimal performance:

1. **Runtime Module** (`diffsol_js.wasm`)
   - Pre-compiled ODE solver implementation
   - Served by backend at `/wasm/diffsol_js.wasm`
   - Cached after first load

2. **Model Module**
   - Your compiled DiffSL model
   - Generated on-demand via backend `POST /compile` endpoint

Both modules share a single linear memory for zero-copy data exchange.

## Installation

Via npm for Node.js or bundlers:

```bash
npm install @diffsol/js
```

Via CDN for browsers:

```html
<script src="https://diffsol-js.fly.dev/diffsol.min.js"></script>
```

## Requirements

- Node.js 18+ or modern browser with WebAssembly support
- Backend service running (for model compilation and serving runtime WASM)
  - Provides `/compile` endpoint for model compilation
  - Serves runtime WASM at `/wasm/diffsol_js.wasm`
  - Serves API docs at `/docs/`
  - Public version available at `https://diffsol-js.fly.dev/`

## Next Steps

- [Getting Started](getting_started.md) - Quick start guide with CDN examples
- [API Overview](overview_api.md) - High-level overview of the TypeScript API
- [Interactive Solver](interactive_solver.md) - Build interactive UIs with live plotting