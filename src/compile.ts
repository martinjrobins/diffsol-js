/**
 * Two-module WASM loader for diffsol
 * 
 * This loader handles:
 * 1. Creating shared WebAssembly.Memory
 * 2. Loading the runtime module (diffsol-js)
 * 3. Fetching and loading the model module from backend
 * 4. Linking them together with proper import resolution
 */

import { Ode } from './ode';
import { MatrixType } from './matrix-type';
import { LinearSolverType } from './linear-solver-type';
import { OdeSolverType } from './ode-solver-type';
import runtimeWasmBytes from '../wasm/diffsol_c.wasm';

export interface ModuleConfig {
  /** URL to the backend service that compiles models */
  backendUrl: string;
  /** Initial memory size in pages (64KB each). Default: 256 (16MB) */
  initialMemoryPages?: number;
  /** Maximum memory size in pages. Default: 32768 (2GB) */
  maxMemoryPages?: number;
  /** Enable shared memory for threading (not yet supported). Default: false */
  sharedMemory?: boolean;
}

interface CompileResponse {
  /** Base64-encoded WASM binary */
  wasm: string;
  /** Input parameters as [name, size] pairs */
  inputs: [string, number][];
  /** Output parameters as [name, size] pairs */
  outputs: [string, number][];
  /** RHS state dependencies as [index, value] pairs */
  rhs_state_deps: [number, number][];
  /** RHS input dependencies as [index, value] pairs */
  rhs_input_deps: [number, number][];
  /** Mass state dependencies as [index, value] pairs */
  mass_state_deps: [number, number][];
}

export interface DiffsolModules {
  /** The runtime module instance */
  runtime: WebAssembly.Instance;
  /** The model module instance */
  model: WebAssembly.Instance;
  /** Shared memory */
  memory: WebAssembly.Memory;
}

const REQUIRED_MODEL_SYMBOLS = [
  'barrier_init',
  'reset',
  'reset_grad',
  'reset_rgrad',
  'reset_sgrad',
  'reset_srgrad',
  'set_constants',
  'set_u0',
  'rhs',
  'rhs_grad',
  'rhs_rgrad',
  'rhs_sgrad',
  'rhs_srgrad',
  'mass',
  'mass_rgrad',
  'set_u0_grad',
  'set_u0_rgrad',
  'set_u0_sgrad',
  'calc_out',
  'calc_out_grad',
  'calc_out_rgrad',
  'calc_out_sgrad',
  'calc_out_srgrad',
  'calc_stop',
  'calc_stop_grad',
  'calc_stop_rgrad',
  'calc_stop_sgrad',
  'calc_stop_srgrad',
  'set_id',
  'get_dims',
  'set_inputs',
  'get_inputs',
  'set_inputs_grad',
  'set_inputs_rgrad',
] as const;

const OPTIONAL_MODEL_SYMBOLS = [
  'barrier_init',
  'reset',
  'reset_grad',
  'reset_rgrad', 'reset_sgrad', 'reset_srgrad',
  'mass_rgrad',
  'rhs_rgrad', 'rhs_sgrad', 'rhs_srgrad',
  'set_u0_rgrad', 'set_u0_sgrad',
  'calc_out_rgrad', 'calc_out_sgrad', 'calc_out_srgrad',
  'calc_stop_grad',
  'calc_stop_rgrad', 'calc_stop_sgrad', 'calc_stop_srgrad',
  'set_inputs_rgrad',
] as const;

/**
 * Cache for the compiled runtime module.
 * The runtime WASM is bundled with the package, so it is identical across backend URLs.
 */
let runtimeModulePromise: Promise<WebAssembly.Module> | undefined;

/**
 * Compile DiffSL code and create a ready-to-use ODE solver
 */
/**
 * Compile DiffSL code and return an ODE solver instance
 * 
 * @param diffslCode - DiffSL model code
 * @param config - Module configuration (backend URL, memory settings)
 * @param matrixType - Matrix type for the solver
 * @param linearSolver - Linear solver type (default: Default)
 * @param odeSolver - ODE solver type (default: Bdf)
 * @returns Ode solver instance ready to use
 */
export async function compile(
  diffslCode: string,
  config: ModuleConfig,
  matrixType: MatrixType,
  linearSolver: LinearSolverType = LinearSolverType.Default,
  odeSolver: OdeSolverType = OdeSolverType.Bdf
): Promise<Ode> {
  // Create shared memory
  const memory = new WebAssembly.Memory({
    initial: config.initialMemoryPages ?? 256,
    maximum: config.maxMemoryPages ?? 32768,
    shared: config.sharedMemory ?? false,
  });

  // Fetch and compile model from backend
  const compileResp = await compileModel(diffslCode, config.backendUrl);
  const modelWasm = base64ToArrayBuffer(compileResp.wasm);
  const modelModule = await WebAssembly.compile(modelWasm);

  // Load bundled runtime from the package (with caching)
  const runtimeModule = await getCachedRuntimeModule();

  let activeMemory = memory;

  // Build runtime imports with shims first, so we can instantiate runtime
  // even when model functions are only available after model instantiation.
  const runtimeImports = buildRuntimeImports(activeMemory, () => activeMemory);
  const modelFunctionTargets = installRuntimeModelFunctionShims(runtimeImports);

  const runtimeInstance = await WebAssembly.instantiate(runtimeModule, runtimeImports);
  const exportedMemory = (runtimeInstance.exports as any).memory;
  if (exportedMemory instanceof WebAssembly.Memory) {
    activeMemory = exportedMemory;
  }

  // Instantiate model against the active runtime memory.
  const modelImports = buildModelImports(activeMemory);
  const modelInstance = await WebAssembly.instantiate(modelModule, modelImports);
  bindModelExportsToTargets(modelFunctionTargets, modelInstance);

  const modules: DiffsolModules = {
    runtime: runtimeInstance,
    model: modelInstance,
    memory: activeMemory,
  };

  // Create and return solver instance with dependency information and metadata
  const ode = new Ode(
    modules,
    matrixType,
    linearSolver,
    odeSolver,
    compileResp.rhs_state_deps,
    compileResp.rhs_input_deps,
    compileResp.mass_state_deps,
    diffslCode,
    compileResp.inputs,
    compileResp.outputs
  );
  
  return ode;
}

/**
 * Get or load the compiled runtime module, with caching
 */
async function getCachedRuntimeModule(): Promise<WebAssembly.Module> {
  if (runtimeModulePromise) {
    return runtimeModulePromise;
  }

  // Not in cache - compile the bundled runtime bytes
  runtimeModulePromise = WebAssembly.compile(new Uint8Array(runtimeWasmBytes));
  return runtimeModulePromise;
}

async function compileModel(diffslCode: string, backendUrl: string): Promise<CompileResponse> {
  // Normalize backend URL by removing trailing slash
  const normalizedUrl = backendUrl.replace(/\/$/, '');
  
  const response = await fetch(`${normalizedUrl}/compile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
    },
    body: diffslCode,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Model compilation failed: ${response.statusText}\n${errorText}`);
  }

  return response.json();
}

/**
 * Decode base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Build imports for the model module
 */
function buildModelImports(memory: WebAssembly.Memory): WebAssembly.Imports {
  return {
    env: {
      memory,
      // Model may also need these if it uses any std functions
      __linear_memory: memory,
    },
  };
}

/**
 * Build initial imports for the runtime module
 */
function buildRuntimeImports(
  memory: WebAssembly.Memory,
  getMemory: () => WebAssembly.Memory
): WebAssembly.Imports {
  const imports: WebAssembly.Imports = {
    env: {
      memory,
      __linear_memory: memory,
    },
  };

  // Add WASI imports if needed (for wasm32-wasip1 target)
  // This is a minimal WASI implementation for the functions we need
  imports.wasi_snapshot_preview1 = buildWasiImports(getMemory);

  return imports;
}

function installRuntimeModelFunctionShims(
  runtimeImports: WebAssembly.Imports
): Record<string, Function> {
  const targets: Record<string, Function> = {};
  if (!runtimeImports.env) {
    runtimeImports.env = {};
  }

  for (const symbol of REQUIRED_MODEL_SYMBOLS) {
    (runtimeImports.env as Record<string, WebAssembly.ExportValue>)[symbol] =
      (...args: unknown[]) => {
        const fn = targets[symbol];
        if (fn) {
          return fn(...args);
        }
        return 0;
      };
  }

  return targets;
}

function bindModelExportsToTargets(
  targets: Record<string, Function>,
  modelInstance: WebAssembly.Instance
): void {
  const wrapModelFunction = (fn: Function) => (...args: unknown[]) => fn(...args);

  // Map model exports to runtime imports
  const exports = modelInstance.exports as Record<string, WebAssembly.ExportValue>;
  for (const symbol of REQUIRED_MODEL_SYMBOLS) {
    const exported = exports[symbol];
    if (typeof exported === 'function') {
      targets[symbol] = wrapModelFunction(exported);
    }
  }

  // Provide no-op stubs for optional symbols not exported by the model
  for (const symbol of OPTIONAL_MODEL_SYMBOLS) {
    if (!exports[symbol]) {
      targets[symbol] = () => 0;
    }
  }

  const optionalSymbolSet = new Set<string>(OPTIONAL_MODEL_SYMBOLS as readonly string[]);
  const missingSymbols = REQUIRED_MODEL_SYMBOLS
    .filter(sym => !exports[sym])
    .filter(sym => !optionalSymbolSet.has(sym));

  if (missingSymbols.length > 0) {
    console.warn('Missing required symbols from model:', missingSymbols);
    // Don't throw here - let instantiation fail with proper error
  }
}

/**
 * Minimal WASI imports (stub implementations)
 * Only needed if runtime is built with wasm32-wasip1 target
 */
function buildWasiImports(getMemory: () => WebAssembly.Memory): Record<string, Function> {
  void getMemory;
  return {
    proc_exit: () => 0,
    fd_write: () => 0,
    fd_close: () => 0,
    fd_seek: () => 0,
    fd_read: () => 0,
    environ_sizes_get: () => 0,
    environ_get: () => 0,
    args_sizes_get: () => 0,
    args_get: () => 0,
    random_get: () => 0,
    sched_yield: () => 0,
    clock_time_get: () => 0,
    clock_res_get: () => 0,
    poll_oneoff: () => 0,
    sock_accept: () => 0,
    sock_recv: () => 0,
    sock_send: () => 0,
    sock_shutdown: () => 0,
    sock_socket: () => 0,
    sock_bind: () => 0,
    sock_connect: () => 0,
    sock_listen: () => 0,
    sock_setsockopt: () => 0,
    sock_getsockopt: () => 0,
    sock_getpeername: () => 0,
    sock_getsockname: () => 0,
  };
}

/**
 * Validate that a module exports the required symbols
 */
export function validateModuleExports(
  module: WebAssembly.Module,
  requiredSymbols: string[]
): { valid: boolean; missing: string[] } {
  const exports = WebAssembly.Module.exports(module);
  const exportNames = exports.map(e => e.name);
  
  const missing = requiredSymbols.filter(sym => !exportNames.includes(sym));
  
  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Get all imports required by a module
 * Useful for debugging import resolution issues
 */
export function getModuleImports(module: WebAssembly.Module): Array<{
  module: string;
  name: string;
  kind: string;
}> {
  return WebAssembly.Module.imports(module);
}
