import { DIFFSOL_OK, getLastError } from './error';
import {
  allocPtr,
  allocU32,
  freePtr,
  freeU32,
  getPtr,
  getU32,
  F64_BYTES
} from './mem-utils';

const solutionFinalizationRegistry = new FinalizationRegistry((heldValue: { dispose: () => void }) => {
  heldValue.dispose();
});

/**
 * Wrapper for SolutionWrapper C API
 *
 * Exposes:
 * - `ys`: 2D state trajectory (columns are time points)
 * - `ts`: solver time points
 * - `sens`: optional forward sensitivities
 */
export class Solution {
  constructor(
    private runtime: WebAssembly.Instance,
    private memory: WebAssembly.Memory,
    private solutionHandle: number
  ) {
    if (solutionHandle === 0) {
      throw new Error('Invalid solution handle');
    }
    solutionFinalizationRegistry.register(this, { dispose: () => this.dispose() }, this);
  }

  /**
   * Opaque pointer used by Ode methods.
   */
  get handle(): number {
    this.checkHandle();
    return this.solutionHandle;
  }

  dispose(): void {
    if (this.solutionHandle !== 0) {
      const exports = this.runtime.exports as any;
      exports.diffsol_solution_wrapper_free(this.solutionHandle);
      this.solutionHandle = 0;
      solutionFinalizationRegistry.unregister(this);
    }
  }

  get ys(): Float64Array[] {
    const exports = this.runtime.exports as any;
    const outArrayPtr = allocPtr(this.runtime);
    const result = exports.diffsol_solution_wrapper_get_ys(this.handle, outArrayPtr);
    if (result !== DIFFSOL_OK) {
      freePtr(this.runtime, outArrayPtr);
      throw getLastError(this.runtime, this.memory);
    }
    const arrayPtr = getPtr(this.memory, outArrayPtr);
    freePtr(this.runtime, outArrayPtr);
    const ys = this.readHostArray2D(arrayPtr);
    this.freeHostArray(arrayPtr);
    return ys;
  }

  get ts(): Float64Array {
    const exports = this.runtime.exports as any;
    const outArrayPtr = allocPtr(this.runtime);
    const result = exports.diffsol_solution_wrapper_get_ts(this.handle, outArrayPtr);
    if (result !== DIFFSOL_OK) {
      freePtr(this.runtime, outArrayPtr);
      throw getLastError(this.runtime, this.memory);
    }
    const arrayPtr = getPtr(this.memory, outArrayPtr);
    freePtr(this.runtime, outArrayPtr);
    const ts = this.readHostArray(arrayPtr);
    this.freeHostArray(arrayPtr);
    return ts;
  }

  get sens(): Float64Array[][] {
    const exports = this.runtime.exports as any;
    const outSensPtr = allocPtr(this.runtime);
    const outSensLenPtr = allocU32(this.runtime);
    const result = exports.diffsol_solution_wrapper_get_sens(
      this.handle,
      outSensPtr,
      outSensLenPtr
    );
    if (result !== DIFFSOL_OK) {
      freePtr(this.runtime, outSensPtr);
      freeU32(this.runtime, outSensLenPtr);
      throw getLastError(this.runtime, this.memory);
    }

    const listPtr = getPtr(this.memory, outSensPtr);
    const len = getU32(this.memory, outSensLenPtr);
    freePtr(this.runtime, outSensPtr);
    freeU32(this.runtime, outSensLenPtr);

    const view = new Uint32Array(this.memory.buffer, listPtr, len);
    const sens: Float64Array[][] = [];
    for (let i = 0; i < len; i++) {
      const arrayPtr = view[i];
      sens.push(this.readHostArray2D(arrayPtr));
      this.freeHostArray(arrayPtr);
    }
    exports.diffsol_host_array_list_free(listPtr, len);
    return sens;
  }

  private checkHandle(): void {
    if (this.solutionHandle === 0) {
      throw new Error('Solution has been disposed');
    }
  }

  private freeHostArray(arrayPtr: number): void {
    const exports = this.runtime.exports as any;
    exports.diffsol_host_array_free(arrayPtr);
  }

  private getHostArrayPtr(arrayPtr: number): number {
    const exports = this.runtime.exports as any;
    return exports.diffsol_host_array_ptr(arrayPtr);
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
    return new Float64Array(memory);
  }

  private readHostArray2D(arrayPtr: number): Float64Array[] {
    const exports = this.runtime.exports as any;
    const ndim = exports.diffsol_host_array_ndim(arrayPtr);
    if (ndim !== 2) {
      throw new Error(`Expected 2D array, got ${ndim}D`);
    }
    const rows = exports.diffsol_host_array_dim(arrayPtr, 0);
    const cols = exports.diffsol_host_array_dim(arrayPtr, 1);
    const rowStride = exports.diffsol_host_array_stride(arrayPtr, 0) / F64_BYTES;
    const colStride = exports.diffsol_host_array_stride(arrayPtr, 1) / F64_BYTES;
    const dataPtr = this.getHostArrayPtr(arrayPtr);

    const result: Float64Array[] = [];
    const memory = new Float64Array(this.memory.buffer);

    for (let col = 0; col < cols; col++) {
      const column = new Float64Array(rows);
      for (let row = 0; row < rows; row++) {
        const offset = dataPtr / F64_BYTES + row * rowStride + col * colStride;
        column[row] = memory[offset];
      }
      result.push(column);
    }

    return result;
  }
}
