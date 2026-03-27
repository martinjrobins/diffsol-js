/**
 * TypeScript wrapper for OdeSolverOptions C API
 * 
 * Provides access to solver options for ODE integration:
 * - Nonlinear solver iteration limits
 * - Error test and step size controls
 * - Jacobian update strategies
 * - Minimum time step constraints
 */

import { DiffsolError, checkError } from './error';
import { allocU32, freeU32, getU32, allocF64, freeF64, getF64 } from './mem-utils';

export class OdeOptions {
  /**
   * Create a wrapper for ODE solver options
   * @param runtime Runtime WebAssembly instance
   * @param memory Shared WebAssembly memory
   * @param optionsHandle Opaque pointer to C OdeSolverOptions
   */
  constructor(
    private runtime: WebAssembly.Instance,
    private memory: WebAssembly.Memory,
    private optionsHandle: number
  ) {}

  /**
   * Maximum number of nonlinear solver iterations per step
   */
  get max_nonlinear_solver_iterations(): number {
    const exports = this.runtime.exports as any;
    const outPtr = allocU32(this.runtime);
    const result = exports.diffsol_ode_options_get_max_nonlinear_solver_iterations(this.optionsHandle, outPtr);
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

  set max_nonlinear_solver_iterations(value: number) {
    (this.runtime.exports.diffsol_ode_options_set_max_nonlinear_solver_iterations as (handle: number, value: number) => void)(
      this.optionsHandle,
      value
    );
    checkError(this.runtime, this.memory);
  }

  /**
   * Maximum number of error test failures before reducing step size
   */
  get max_error_test_failures(): number {
    const exports = this.runtime.exports as any;
    const outPtr = allocU32(this.runtime);
    const result = exports.diffsol_ode_options_get_max_error_test_failures(this.optionsHandle, outPtr);
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

  set max_error_test_failures(value: number) {
    (this.runtime.exports.diffsol_ode_options_set_max_error_test_failures as (handle: number, value: number) => void)(
      this.optionsHandle,
      value
    );
    checkError(this.runtime, this.memory);
  }

  /**
   * Number of steps between Jacobian updates from model
   */
  get update_jacobian_after_steps(): number {
    const exports = this.runtime.exports as any;
    const outPtr = allocU32(this.runtime);
    const result = exports.diffsol_ode_options_get_update_jacobian_after_steps(this.optionsHandle, outPtr);
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

  set update_jacobian_after_steps(value: number) {
    (this.runtime.exports.diffsol_ode_options_set_update_jacobian_after_steps as (handle: number, value: number) => void)(
      this.optionsHandle,
      value
    );
    checkError(this.runtime, this.memory);
  }

  /**
   * Number of steps between RHS Jacobian updates from model
   */
  get update_rhs_jacobian_after_steps(): number {
    const exports = this.runtime.exports as any;
    const outPtr = allocU32(this.runtime);
    const result = exports.diffsol_ode_options_get_update_rhs_jacobian_after_steps(this.optionsHandle, outPtr);
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

  set update_rhs_jacobian_after_steps(value: number) {
    (this.runtime.exports.diffsol_ode_options_set_update_rhs_jacobian_after_steps as (handle: number, value: number) => void)(
      this.optionsHandle,
      value
    );
    checkError(this.runtime, this.memory);
  }

  /**
   * Threshold for deciding when to update Jacobian from model
   */
  get threshold_to_update_jacobian(): number {
    const exports = this.runtime.exports as any;
    const outPtr = allocF64(this.runtime);
    const result = exports.diffsol_ode_options_get_threshold_to_update_jacobian(this.optionsHandle, outPtr);
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

  set threshold_to_update_jacobian(value: number) {
    (this.runtime.exports.diffsol_ode_options_set_threshold_to_update_jacobian as (handle: number, value: number) => void)(
      this.optionsHandle,
      value
    );
    checkError(this.runtime, this.memory);
  }

  /**
   * Threshold for deciding when to update RHS Jacobian from model
   */
  get threshold_to_update_rhs_jacobian(): number {
    const exports = this.runtime.exports as any;
    const outPtr = allocF64(this.runtime);
    const result = exports.diffsol_ode_options_get_threshold_to_update_rhs_jacobian(this.optionsHandle, outPtr);
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

  set threshold_to_update_rhs_jacobian(value: number) {
    (this.runtime.exports.diffsol_ode_options_set_threshold_to_update_rhs_jacobian as (handle: number, value: number) => void)(
      this.optionsHandle,
      value
    );
    checkError(this.runtime, this.memory);
  }

  /**
   * Minimum time step allowed during integration
   */
  get min_timestep(): number {
    const exports = this.runtime.exports as any;
    const outPtr = allocF64(this.runtime);
    const result = exports.diffsol_ode_options_get_min_timestep(this.optionsHandle, outPtr);
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

  set min_timestep(value: number) {
    (this.runtime.exports.diffsol_ode_options_set_min_timestep as (handle: number, value: number) => void)(
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
      (this.runtime.exports.diffsol_ode_options_free as (handle: number) => void)(this.optionsHandle);
      this.optionsHandle = 0;
    }
  }
}
