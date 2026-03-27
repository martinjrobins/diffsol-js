/**
 * TypeScript wrapper for InitialConditionSolverOptions C API
 * 
 * Provides access to solver options for initial condition computation:
 * - Line search settings (enabled, max iterations)
 * - Newton iteration limits
 * - Linear solver setup limits
 * - Convergence factors (step reduction, Armijo constant)
 */

import { DiffsolError, checkError } from './error';
import { allocU32, freeU32, getU32, allocF64, freeF64, getF64 } from './mem-utils';

export class InitialConditionOptions {
  /**
   * Create a wrapper for initial condition options
   * @param runtime Runtime WebAssembly instance
   * @param memory Shared WebAssembly memory
   * @param optionsHandle Opaque pointer to C InitialConditionSolverOptions
   */
  constructor(
    private runtime: WebAssembly.Instance,
    private memory: WebAssembly.Memory,
    private optionsHandle: number
  ) {}

  /**
   * Whether to use line search in initial condition computation
   */
  get use_linesearch(): boolean {
    const exports = this.runtime.exports as any;
    const outPtr = allocU32(this.runtime);
    const result = exports.diffsol_ic_options_get_use_linesearch(this.optionsHandle, outPtr);
    if (result !== 0) {
      freeU32(this.runtime, outPtr);
      checkError(this.runtime, this.memory);
      return false;
    }
    const value = getU32(this.memory, outPtr);
    freeU32(this.runtime, outPtr);
    checkError(this.runtime, this.memory);
    return value !== 0;
  }

  set use_linesearch(value: boolean) {
    (this.runtime.exports.diffsol_ic_options_set_use_linesearch as (handle: number, value: number) => void)(
      this.optionsHandle,
      value ? 1 : 0
    );
    checkError(this.runtime, this.memory);
  }

  /**
   * Maximum number of line search iterations for initial condition computation
   */
  get max_linesearch_iterations(): number {
    const exports = this.runtime.exports as any;
    const outPtr = allocU32(this.runtime);
    const result = exports.diffsol_ic_options_get_max_linesearch_iterations(this.optionsHandle, outPtr);
    if (result !== 0) {
      freeU32(this.runtime, outPtr);
      checkError(this.runtime, this.memory);
      return 0;
    }
    const value = getU32(this.memory, outPtr);
    freeU32(this.runtime, outPtr);
    checkError(this.runtime, this.memory);
    return value;
  }

  set max_linesearch_iterations(value: number) {
    (this.runtime.exports.diffsol_ic_options_set_max_linesearch_iterations as (handle: number, value: number) => void)(
      this.optionsHandle,
      value
    );
    checkError(this.runtime, this.memory);
  }

  /**
   * Maximum number of Newton iterations for initial condition computation
   */
  get max_newton_iterations(): number {
    const exports = this.runtime.exports as any;
    const outPtr = allocU32(this.runtime);
    const result = exports.diffsol_ic_options_get_max_newton_iterations(this.optionsHandle, outPtr);
    if (result !== 0) {
      freeU32(this.runtime, outPtr);
      checkError(this.runtime, this.memory);
      return 0;
    }
    const value = getU32(this.memory, outPtr);
    freeU32(this.runtime, outPtr);
    checkError(this.runtime, this.memory);
    return value;
  }

  set max_newton_iterations(value: number) {
    (this.runtime.exports.diffsol_ic_options_set_max_newton_iterations as (handle: number, value: number) => void)(
      this.optionsHandle,
      value
    );
    checkError(this.runtime, this.memory);
  }

  /**
   * Maximum number of linear solver setups during initial condition computation
   */
  get max_linear_solver_setups(): number {
    const exports = this.runtime.exports as any;
    const outPtr = allocU32(this.runtime);
    const result = exports.diffsol_ic_options_get_max_linear_solver_setups(this.optionsHandle, outPtr);
    if (result !== 0) {
      freeU32(this.runtime, outPtr);
      checkError(this.runtime, this.memory);
      return 0;
    }
    const value = getU32(this.memory, outPtr);
    freeU32(this.runtime, outPtr);
    checkError(this.runtime, this.memory);
    return value;
  }

  set max_linear_solver_setups(value: number) {
    (this.runtime.exports.diffsol_ic_options_set_max_linear_solver_setups as (handle: number, value: number) => void)(
      this.optionsHandle,
      value
    );
    checkError(this.runtime, this.memory);
  }

  /**
   * Step reduction factor for line search during initial condition computation
   */
  get step_reduction_factor(): number {
    const exports = this.runtime.exports as any;
    const outPtr = allocF64(this.runtime);
    const result = exports.diffsol_ic_options_get_step_reduction_factor(this.optionsHandle, outPtr);
    if (result !== 0) {
      freeF64(this.runtime, outPtr);
      checkError(this.runtime, this.memory);
      return 0;
    }
    const value = getF64(this.memory, outPtr);
    freeF64(this.runtime, outPtr);
    checkError(this.runtime, this.memory);
    return value;
  }

  set step_reduction_factor(value: number) {
    (this.runtime.exports.diffsol_ic_options_set_step_reduction_factor as (handle: number, value: number) => void)(
      this.optionsHandle,
      value
    );
    checkError(this.runtime, this.memory);
  }

  /**
   * Armijo constant for line search during initial condition computation
   */
  get armijo_constant(): number {
    const exports = this.runtime.exports as any;
    const outPtr = allocF64(this.runtime);
    const result = exports.diffsol_ic_options_get_armijo_constant(this.optionsHandle, outPtr);
    if (result !== 0) {
      freeF64(this.runtime, outPtr);
      checkError(this.runtime, this.memory);
      return 0;
    }
    const value = getF64(this.memory, outPtr);
    freeF64(this.runtime, outPtr);
    checkError(this.runtime, this.memory);
    return value;
  }

  set armijo_constant(value: number) {
    (this.runtime.exports.diffsol_ic_options_set_armijo_constant as (handle: number, value: number) => void)(
      this.optionsHandle,
      value
    );
    checkError(this.runtime, this.memory);
  }

  /**
   * Clean up C resources
   */
  dispose(): void {
    if (this.optionsHandle !== 0) {
      (this.runtime.exports.diffsol_ic_options_free as (handle: number) => void)(this.optionsHandle);
      this.optionsHandle = 0;
    }
  }
}
