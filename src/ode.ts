import { ScalarType } from './scalar-type';
import { MatrixType } from './matrix-type';
import { LinearSolverType } from './linear-solver-type';
import { OdeSolverType } from './ode-solver-type';
import { InitialConditionOptions } from './initial-condition-options';
import { OdeOptions } from './ode-options';
import { Solution } from './solution';
import { DiffsolError, getLastError, DIFFSOL_OK } from './error';
import {
  allocPtr,
  freePtr,
  getPtr,
  allocF64,
  freeF64,
  getF64,
  allocateDependencies,
  freeDependencies
} from './mem-utils';

// Re-export DiffsolError for backward compatibility
export { DiffsolError };

export interface DiffsolModules {
  /** The runtime module instance */
  runtime: WebAssembly.Instance;
  /** The model module instance */
  model: WebAssembly.Instance;
  /** Shared memory */
  memory: WebAssembly.Memory;
}

/**
 * FinalizationRegistry to automatically clean up ODE handles when garbage collected
 */
const odeFinalizationRegistry = new FinalizationRegistry((heldValue: { dispose: () => void }) => {
  heldValue.dispose();
});

/**
 * Wrapper for diffsol C API
 * 
 * Handles:
 * - Memory management (HostArray allocation/deallocation)
 * - Error checking and reporting
 * - Type conversions between JS and C
 */
export class Ode {
  private runtime: WebAssembly.Instance;
  private memory: WebAssembly.Memory;
  private odeHandle: number;
  private _linearSolver: LinearSolverType;
  private _odeSolver: OdeSolverType;
  private _icOptions: InitialConditionOptions | null = null;
  private _odeOptions: OdeOptions | null = null;
  private _inputs: [string, number][];
  private _outputs: [string, number][];

  constructor(
    modules: DiffsolModules,
    matrixType: MatrixType,
    linearSolver: LinearSolverType = LinearSolverType.Default,
    odeSolver: OdeSolverType = OdeSolverType.Bdf,
    rhsStateDeps: [number, number][] = [],
    rhsInputDeps: [number, number][] = [],
    massStateDeps: [number, number][] = [],
    diffslCode?: string,
    inputs: [string, number][] = [],
    outputs: [string, number][] = []
  ) {
    this.runtime = modules.runtime;
    this.memory = modules.memory;
    this._linearSolver = linearSolver;
    this._odeSolver = odeSolver;
    this._inputs = inputs;
    this._outputs = outputs;

    // Create ODE handle immediately
    const exports = this.runtime.exports as any;

    if (typeof exports.diffsol_ode_new_external !== 'function') {
      throw new Error('Runtime module does not export diffsol_ode_new_external');
    }
    
    // Allocate dependency arrays in WASM memory
    const rhsStateDepsPtr = allocateDependencies(this.runtime, this.memory, rhsStateDeps);
    const rhsInputDepsPtr = allocateDependencies(this.runtime, this.memory, rhsInputDeps);
    const massStateDepsPtr = allocateDependencies(this.runtime, this.memory, massStateDeps);

    try {
      this.odeHandle = exports.diffsol_ode_new_external(
        matrixType,
        linearSolver,
        odeSolver,
        rhsStateDepsPtr,
        rhsStateDeps.length,
        rhsInputDepsPtr,
        rhsInputDeps.length,
        massStateDepsPtr,
        massStateDeps.length
      );
    } finally {
      freeDependencies(this.runtime, rhsStateDepsPtr, rhsStateDeps.length);
      freeDependencies(this.runtime, rhsInputDepsPtr, rhsInputDeps.length);
      freeDependencies(this.runtime, massStateDepsPtr, massStateDeps.length);
    }

    if (this.odeHandle === 0) {
      throw getLastError(this.runtime, this.memory);
    }

    // Register for automatic cleanup on garbage collection
    odeFinalizationRegistry.register(this, { dispose: () => this.dispose() }, this);
  }

  /**
   * Free the ODE solver
   * 
   * Explicitly releases resources. Will also be called automatically on garbage collection.
   * Safe to call multiple times.
   */
  dispose(): void {
    if (this.odeHandle !== 0) {
      // Clean up options objects first
      if (this._icOptions !== null) {
        this._icOptions.dispose();
        this._icOptions = null;
      }
      if (this._odeOptions !== null) {
        this._odeOptions.dispose();
        this._odeOptions = null;
      }
      
      const exports = this.runtime.exports as any;
      exports.diffsol_ode_free(this.odeHandle);
      this.odeHandle = 0;
      // Unregister from finalization registry to prevent double-cleanup
      odeFinalizationRegistry.unregister(this);
    }
  }

  /**
   * Get initial conditions y0
   */
  getY0(params: Float64Array): Float64Array {
    this.checkHandle();
    const exports = this.runtime.exports as any;

    // Allocate parameter array
    const paramsArray = this.allocateHostArray(params.length, ScalarType.F64);
    this.writeToHostArray(paramsArray, params);

    // Call diffsol_ode_y0
    const resultPtr = allocPtr(this.runtime);
    const result = exports.diffsol_ode_y0(
      this.odeHandle,
      this.getHostArrayPtr(paramsArray),
      params.length,
      resultPtr
    );

    this.freeHostArray(paramsArray);

    if (result !== DIFFSOL_OK) {
      freePtr(this.runtime, resultPtr);
      throw getLastError(this.runtime, this.memory);
    }

    // Read result
    const y0Array = getPtr(this.memory, resultPtr);
    const y0 = this.readHostArray(y0Array);
    this.freeHostArray(y0Array);
    freePtr(this.runtime, resultPtr);

    return y0;
  }

  /**
   * Evaluate RHS function
   */
  rhs(params: Float64Array, t: number, y: Float64Array): Float64Array {
    this.checkHandle();
    const exports = this.runtime.exports as any;

    const paramsArray = this.allocateHostArray(params.length, ScalarType.F64);
    this.writeToHostArray(paramsArray, params);

    const yArray = this.allocateHostArray(y.length, ScalarType.F64);
    this.writeToHostArray(yArray, y);

    const resultPtr = allocPtr(this.runtime);
    const result = exports.diffsol_ode_rhs(
      this.odeHandle,
      this.getHostArrayPtr(paramsArray),
      params.length,
      t,
      this.getHostArrayPtr(yArray),
      y.length,
      resultPtr
    );

    this.freeHostArray(paramsArray);
    this.freeHostArray(yArray);

    if (result !== DIFFSOL_OK) {
      freePtr(this.runtime, resultPtr);
      throw getLastError(this.runtime, this.memory);
    }

    const rhsArray = getPtr(this.memory, resultPtr);
    const rhs = this.readHostArray(rhsArray);
    this.freeHostArray(rhsArray);
    freePtr(this.runtime, resultPtr);

    return rhs;
  }

  /**
   * Solve ODE to final time.
   */
  solve(params: Float64Array, finalTime: number): Solution {
    this.checkHandle();
    const exports = this.runtime.exports as any;

    const paramsArray = this.allocateHostArray(params.length, ScalarType.F64);
    this.writeToHostArray(paramsArray, params);

    const outSolutionPtr = allocPtr(this.runtime);

    const result = exports.diffsol_ode_solve(
      this.odeHandle,
      this.getHostArrayPtr(paramsArray),
      params.length,
      finalTime,
      outSolutionPtr
    );

    this.freeHostArray(paramsArray);

    if (result !== DIFFSOL_OK) {
      freePtr(this.runtime, outSolutionPtr);
      throw getLastError(this.runtime, this.memory);
    }

    const outHandle = getPtr(this.memory, outSolutionPtr);
    freePtr(this.runtime, outSolutionPtr);
    if (outHandle === 0) {
      throw new Error('diffsol_ode_solve returned null solution handle');
    }

    return new Solution(this.runtime, this.memory, outHandle);
  }

  /**
   * Solve a hybrid ODE to final time, automatically applying resets after roots.
   */
  solveHybrid(params: Float64Array, finalTime: number): Solution {
    this.checkHandle();
    const exports = this.runtime.exports as any;

    const paramsArray = this.allocateHostArray(params.length, ScalarType.F64);
    this.writeToHostArray(paramsArray, params);

    const outSolutionPtr = allocPtr(this.runtime);

    const result = exports.diffsol_ode_solve_hybrid(
      this.odeHandle,
      this.getHostArrayPtr(paramsArray),
      params.length,
      finalTime,
      outSolutionPtr
    );

    this.freeHostArray(paramsArray);

    if (result !== DIFFSOL_OK) {
      freePtr(this.runtime, outSolutionPtr);
      throw getLastError(this.runtime, this.memory);
    }

    const outHandle = getPtr(this.memory, outSolutionPtr);
    freePtr(this.runtime, outSolutionPtr);
    if (outHandle === 0) {
      throw new Error('diffsol_ode_solve_hybrid returned null solution handle');
    }

    return new Solution(this.runtime, this.memory, outHandle);
  }

  /**
   * Solve ODE at specific time points.
   */
  solveDense(
    params: Float64Array,
    tEval: Float64Array
  ): Solution {
    this.checkHandle();
    const exports = this.runtime.exports as any;

    const paramsArray = this.allocateHostArray(params.length, ScalarType.F64);
    this.writeToHostArray(paramsArray, params);

    const tEvalArray = this.allocateHostArray(tEval.length, ScalarType.F64);
    this.writeToHostArray(tEvalArray, tEval);

    const outSolutionPtr = allocPtr(this.runtime);

    const result = exports.diffsol_ode_solve_dense(
      this.odeHandle,
      this.getHostArrayPtr(paramsArray),
      params.length,
      this.getHostArrayPtr(tEvalArray),
      tEval.length,
      outSolutionPtr
    );

    this.freeHostArray(paramsArray);
    this.freeHostArray(tEvalArray);

    if (result !== DIFFSOL_OK) {
      freePtr(this.runtime, outSolutionPtr);
      throw getLastError(this.runtime, this.memory);
    }

    const outHandle = getPtr(this.memory, outSolutionPtr);
    freePtr(this.runtime, outSolutionPtr);
    if (outHandle === 0) {
      throw new Error('diffsol_ode_solve_dense returned null solution handle');
    }

    return new Solution(this.runtime, this.memory, outHandle);
  }

  /**
   * Solve a hybrid ODE at specific time points, automatically applying resets after roots.
   */
  solveHybridDense(
    params: Float64Array,
    tEval: Float64Array
  ): Solution {
    this.checkHandle();
    const exports = this.runtime.exports as any;

    const paramsArray = this.allocateHostArray(params.length, ScalarType.F64);
    this.writeToHostArray(paramsArray, params);

    const tEvalArray = this.allocateHostArray(tEval.length, ScalarType.F64);
    this.writeToHostArray(tEvalArray, tEval);

    const outSolutionPtr = allocPtr(this.runtime);

    const result = exports.diffsol_ode_solve_hybrid_dense(
      this.odeHandle,
      this.getHostArrayPtr(paramsArray),
      params.length,
      this.getHostArrayPtr(tEvalArray),
      tEval.length,
      outSolutionPtr
    );

    this.freeHostArray(paramsArray);
    this.freeHostArray(tEvalArray);

    if (result !== DIFFSOL_OK) {
      freePtr(this.runtime, outSolutionPtr);
      throw getLastError(this.runtime, this.memory);
    }

    const outHandle = getPtr(this.memory, outSolutionPtr);
    freePtr(this.runtime, outSolutionPtr);
    if (outHandle === 0) {
      throw new Error('diffsol_ode_solve_hybrid_dense returned null solution handle');
    }

    return new Solution(this.runtime, this.memory, outHandle);
  }

  /**
   * Solve ODE with forward sensitivities at specific time points.
   */
  solveFwdSens(
    params: Float64Array,
    tEval: Float64Array
  ): Solution {
    this.checkHandle();
    const exports = this.runtime.exports as any;

    const paramsArray = this.allocateHostArray(params.length, ScalarType.F64);
    this.writeToHostArray(paramsArray, params);

    const tEvalArray = this.allocateHostArray(tEval.length, ScalarType.F64);
    this.writeToHostArray(tEvalArray, tEval);

    const outSolutionPtr = allocPtr(this.runtime);

    const result = exports.diffsol_ode_solve_fwd_sens(
      this.odeHandle,
      this.getHostArrayPtr(paramsArray),
      params.length,
      this.getHostArrayPtr(tEvalArray),
      tEval.length,
      outSolutionPtr
    );

    this.freeHostArray(paramsArray);
    this.freeHostArray(tEvalArray);

    if (result !== DIFFSOL_OK) {
      freePtr(this.runtime, outSolutionPtr);
      throw getLastError(this.runtime, this.memory);
    }

    const outHandle = getPtr(this.memory, outSolutionPtr);
    freePtr(this.runtime, outSolutionPtr);
    if (outHandle === 0) {
      throw new Error('diffsol_ode_solve_fwd_sens returned null solution handle');
    }

    return new Solution(this.runtime, this.memory, outHandle);
  }

  /**
   * Solve a hybrid ODE with forward sensitivities at specific time points.
   *
   * The returned solution contains state values in `ys`, evaluation times in `ts`,
   * and parameter sensitivities in `sens`.
   */
  solveHybridFwdSens(
    params: Float64Array,
    tEval: Float64Array
  ): Solution {
    this.checkHandle();
    const exports = this.runtime.exports as any;

    const paramsArray = this.allocateHostArray(params.length, ScalarType.F64);
    this.writeToHostArray(paramsArray, params);

    const tEvalArray = this.allocateHostArray(tEval.length, ScalarType.F64);
    this.writeToHostArray(tEvalArray, tEval);

    const outSolutionPtr = allocPtr(this.runtime);

    const result = exports.diffsol_ode_solve_hybrid_fwd_sens(
      this.odeHandle,
      this.getHostArrayPtr(paramsArray),
      params.length,
      this.getHostArrayPtr(tEvalArray),
      tEval.length,
      outSolutionPtr
    );

    this.freeHostArray(paramsArray);
    this.freeHostArray(tEvalArray);

    if (result !== DIFFSOL_OK) {
      freePtr(this.runtime, outSolutionPtr);
      throw getLastError(this.runtime, this.memory);
    }

    const outHandle = getPtr(this.memory, outSolutionPtr);
    freePtr(this.runtime, outSolutionPtr);
    if (outHandle === 0) {
      throw new Error('diffsol_ode_solve_hybrid_fwd_sens returned null solution handle');
    }

    return new Solution(this.runtime, this.memory, outHandle);
  }

  /**
   * Relative tolerance for the solver (default: 1e-6)
   */
  get rtol(): number {
    this.checkHandle();
    const exports = this.runtime.exports as any;
    const valuePtr = allocF64(this.runtime);
    const result = exports.diffsol_ode_get_rtol(this.odeHandle, valuePtr);
    if (result !== DIFFSOL_OK) {
      freeF64(this.runtime, valuePtr);
      throw getLastError(this.runtime, this.memory);
    }
    const value = getF64(this.memory, valuePtr);
    freeF64(this.runtime, valuePtr);
    return value;
  }

  set rtol(value: number) {
    this.checkHandle();
    const exports = this.runtime.exports as any;
    const result = exports.diffsol_ode_set_rtol(this.odeHandle, value);
    if (result !== DIFFSOL_OK) {
      throw getLastError(this.runtime, this.memory);
    }
  }

  /**
   * Absolute tolerance for the solver (default: 1e-6)
   */
  get atol(): number {
    this.checkHandle();
    const exports = this.runtime.exports as any;
    const valuePtr = allocF64(this.runtime);
    const result = exports.diffsol_ode_get_atol(this.odeHandle, valuePtr);
    if (result !== DIFFSOL_OK) {
      freeF64(this.runtime, valuePtr);
      throw getLastError(this.runtime, this.memory);
    }
    const value = getF64(this.memory, valuePtr);
    freeF64(this.runtime, valuePtr);
    return value;
  }

  set atol(value: number) {
    this.checkHandle();
    const exports = this.runtime.exports as any;
    const result = exports.diffsol_ode_set_atol(this.odeHandle, value);
    if (result !== DIFFSOL_OK) {
      throw getLastError(this.runtime, this.memory);
    }
  }

  /**
   * Linear solver type used by this ODE solver
   */
  get linear_solver(): LinearSolverType {
    return this._linearSolver;
  }

  set linear_solver(value: LinearSolverType) {
    this._linearSolver = value;
  }

  /**
   * ODE solver type used
   */
  get ode_solver(): OdeSolverType {
    return this._odeSolver;
  }

  set ode_solver(value: OdeSolverType) {
    this._odeSolver = value;
  }

  /**
   * Get initial condition solver options
   */
  get icOptions(): InitialConditionOptions {
    if (this._icOptions === null) {
      this.checkHandle();
      const exports = this.runtime.exports as any;
      
      // Call C function to get IC options handle
      const optionsPtr = allocPtr(this.runtime);
      const result = exports.diffsol_ode_get_ic_options(this.odeHandle, optionsPtr);
      
      if (result !== DIFFSOL_OK) {
        freePtr(this.runtime, optionsPtr);
        throw getLastError(this.runtime, this.memory);
      }
      
      const optionsHandle = getPtr(this.memory, optionsPtr);
      freePtr(this.runtime, optionsPtr);
      
      this._icOptions = new InitialConditionOptions(this.runtime, this.memory, optionsHandle);
    }
    return this._icOptions;
  }

  /**
   * Get ODE solver options
   */
  get odeOptions(): OdeOptions {
    if (this._odeOptions === null) {
      this.checkHandle();
      const exports = this.runtime.exports as any;
      
      // Call C function to get ODE options handle
      const optionsPtr = allocPtr(this.runtime);
      const result = exports.diffsol_ode_get_options(this.odeHandle, optionsPtr);
      
      if (result !== DIFFSOL_OK) {
        freePtr(this.runtime, optionsPtr);
        throw getLastError(this.runtime, this.memory);
      }
      
      const optionsHandle = getPtr(this.memory, optionsPtr);
      freePtr(this.runtime, optionsPtr);
      
      this._odeOptions = new OdeOptions(this.runtime, this.memory, optionsHandle);
    }
    return this._odeOptions;
  }

  /**
   * Get model inputs as [name, size] pairs
   */
  get inputs(): [string, number][] {
    return this._inputs;
  }

  /**
   * Get model outputs as [name, size] pairs
   */
  get outputs(): [string, number][] {
    return this._outputs;
  }

  // === Memory management helpers ===

  private checkHandle(): void {
    if (this.odeHandle === 0) {
      throw new Error('Solver has been disposed or failed to initialize');
    }
  }

  private allocateHostArray(len: number, dtype: ScalarType): number {
    const exports = this.runtime.exports as any;
    return exports.diffsol_host_array_alloc_vector(len, dtype);
  }

  private freeHostArray(arrayPtr: number): void {
    const exports = this.runtime.exports as any;
    exports.diffsol_host_array_free(arrayPtr);
  }

  private getHostArrayPtr(arrayPtr: number): number {
    const exports = this.runtime.exports as any;
    return exports.diffsol_host_array_ptr(arrayPtr);
  }

  private writeToHostArray(arrayPtr: number, data: Float64Array): void {
    const dataPtr = this.getHostArrayPtr(arrayPtr);
    const memory = new Float64Array(this.memory.buffer, dataPtr, data.length);
    memory.set(data);
  }

  private readHostArray(arrayPtr: number): Float64Array {
    const exports = this.runtime.exports as any;
    const ndim = exports.diffsol_host_array_ndim(arrayPtr);
    if (ndim !== 1) {
      throw new Error(`Expected 1D array, got ${ndim}D`);
    }
    const len = exports.diffsol_host_array_dim(arrayPtr, 0);
    const dataPtr = this.getHostArrayPtr(arrayPtr);
    const memory = new Float64Array(this.memory.buffer, dataPtr, len);
    return new Float64Array(memory); // Copy
  }

  private readHostArray2D(arrayPtr: number): Float64Array[] {
    const exports = this.runtime.exports as any;
    const ndim = exports.diffsol_host_array_ndim(arrayPtr);
    if (ndim !== 2) {
      throw new Error(`Expected 2D array, got ${ndim}D`);
    }
    const rows = exports.diffsol_host_array_dim(arrayPtr, 0);
    const cols = exports.diffsol_host_array_dim(arrayPtr, 1);
    const rowStride = exports.diffsol_host_array_stride(arrayPtr, 0) / 8; // bytes to f64
    const colStride = exports.diffsol_host_array_stride(arrayPtr, 1) / 8;
    const dataPtr = this.getHostArrayPtr(arrayPtr);

    const result: Float64Array[] = [];
    const memory = new Float64Array(this.memory.buffer);

    for (let col = 0; col < cols; col++) {
      const column = new Float64Array(rows);
      for (let row = 0; row < rows; row++) {
        const offset = dataPtr / 8 + row * rowStride + col * colStride;
        column[row] = memory[offset];
      }
      result.push(column);
    }

    return result;
  }


}
