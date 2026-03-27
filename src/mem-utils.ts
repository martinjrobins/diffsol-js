/**
 * Memory allocation utilities for FFI with WebAssembly
 * 
 * Provides helper functions for allocating, freeing, and reading
 * aligned memory for common types (u32, f64) across the FFI boundary.
 */

// Memory layout constants for wasm32 architecture
const U32_BYTES = 4;
const U32_ALIGN = 4;
export const F64_BYTES = 8;
export const F64_ALIGN = 8;
const PTR_BYTES = 4;  // Pointer size on wasm32
const PTR_ALIGN = 4;  // Pointer alignment on wasm32
const USIZE_BYTES = 4;  // usize is 4 bytes on wasm32

/**
 * Allocate aligned memory for a u32 (4 bytes, 4-byte aligned)
 * @param runtime WebAssembly runtime instance
 * @returns Pointer to allocated memory
 */
export function allocU32(runtime: WebAssembly.Instance): number {
  const wasmExports = runtime.exports as any;
  const ptr = wasmExports.diffsol_alloc(U32_BYTES, U32_ALIGN);
  if (ptr === 0) {
    throw new Error('Cannot allocate u32');
  }
  return ptr;
}

/**
 * Free memory allocated for a u32
 * @param runtime WebAssembly runtime instance
 * @param ptr Pointer to free
 */
export function freeU32(runtime: WebAssembly.Instance, ptr: number): void {
  const wasmExports = runtime.exports as any;
  wasmExports.diffsol_free(ptr, U32_BYTES, U32_ALIGN);
}

/**
 * Read a u32 value from memory
 * @param memory WebAssembly memory
 * @param ptr Pointer to read from
 * @returns The u32 value
 */
export function getU32(memory: WebAssembly.Memory, ptr: number): number {
  const view = new Uint32Array(memory.buffer);
  return view[ptr / U32_BYTES];
}

/**
 * Allocate aligned memory for an f64 (8 bytes, 8-byte aligned)
 * @param runtime WebAssembly runtime instance
 * @returns Pointer to allocated memory
 */
export function allocF64(runtime: WebAssembly.Instance): number {
  const wasmExports = runtime.exports as any;
  const ptr = wasmExports.diffsol_alloc(F64_BYTES, F64_ALIGN);
  if (ptr === 0) {
    throw new Error('Cannot allocate f64');
  }
  return ptr;
}

/**
 * Free memory allocated for an f64
 * @param runtime WebAssembly runtime instance
 * @param ptr Pointer to free
 */
export function freeF64(runtime: WebAssembly.Instance, ptr: number): void {
  const wasmExports = runtime.exports as any;
  wasmExports.diffsol_free(ptr, F64_BYTES, F64_ALIGN);
}

/**
 * Read an f64 value from memory
 * @param memory WebAssembly memory
 * @param ptr Pointer to read from
 * @returns The f64 value
 */
export function getF64(memory: WebAssembly.Memory, ptr: number): number {
  const view = new Float64Array(memory.buffer);
  return view[ptr / F64_BYTES];
}

/**
 * Allocate memory for a pointer (4 bytes on wasm32, 4-byte aligned)
 * @param runtime WebAssembly runtime instance
 * @returns Pointer to allocated memory
 */
export function allocPtr(runtime: WebAssembly.Instance): number {
  const wasmExports = runtime.exports as any;
  const ptr = wasmExports.diffsol_alloc(PTR_BYTES, PTR_ALIGN);
  if (ptr === 0) {
    throw new Error('Cannot allocate pointer');
  }
  return ptr;
}

/**
 * Free memory allocated for a pointer
 * @param runtime WebAssembly runtime instance
 * @param ptr Pointer to free
 */
export function freePtr(runtime: WebAssembly.Instance, ptr: number): void {
  const wasmExports = runtime.exports as any;
  wasmExports.diffsol_free(ptr, PTR_BYTES, PTR_ALIGN);
}

/**
 * Read a pointer value from memory
 * @param memory WebAssembly memory
 * @param ptr Pointer to read from
 * @returns The pointer value
 */
export function getPtr(memory: WebAssembly.Memory, ptr: number): number {
  const view = new Uint32Array(memory.buffer);
  return view[ptr / PTR_BYTES];
}

/**
 * Allocate and write a UTF-8 string to WebAssembly memory
 * @param runtime WebAssembly runtime instance
 * @param memory WebAssembly memory
 * @param str String to allocate
 * @returns Object containing pointer and size for later deallocation
 */
export function allocateString(
  runtime: WebAssembly.Instance,
  memory: WebAssembly.Memory,
  str: string
): { ptr: number; size: number } {
  const encoder = new TextEncoder();
  const utf8Bytes = encoder.encode(str);
  
  const wasmExports = runtime.exports as any;
  const size = utf8Bytes.length + 1; // +1 for null terminator
  const ptr = wasmExports.diffsol_alloc_string(size);
  
  if (ptr === 0) {
    throw new Error('Failed to allocate memory for string');
  }
  
  const memView = new Uint8Array(memory.buffer, ptr, size);
  memView.set(utf8Bytes);
  memView[utf8Bytes.length] = 0; // null terminator
  
  return { ptr, size };
}

/**
 * Free memory allocated for a string
 * @param runtime WebAssembly runtime instance
 * @param ptr Pointer to free
 * @param size Size of the allocated string (from allocateString)
 */
export function freeString(
  runtime: WebAssembly.Instance,
  ptr: number,
  size: number
): void {
  const wasmExports = runtime.exports as any;
  wasmExports.diffsol_free_string(ptr, size);
}

/**
 * Allocate and write dependency tuples to WebAssembly memory
 * @param runtime WebAssembly runtime instance
 * @param memory WebAssembly memory
 * @param deps Array of dependency tuples [index1, index2]
 * @returns Pointer to allocated memory, or 0 if deps is empty
 */
export function allocateDependencies(
  runtime: WebAssembly.Instance,
  memory: WebAssembly.Memory,
  deps: [number, number][]
): number {
  if (deps.length === 0) {
    return 0; // NULL pointer
  }
  
  // On wasm32, usize is 4 bytes, so each tuple is 8 bytes total
  const wasmExports = runtime.exports as any;
  const byteSize = deps.length * 2 * USIZE_BYTES;
  const ptr = wasmExports.diffsol_alloc(byteSize, USIZE_BYTES);
  
  if (ptr === 0) {
    throw new Error('Failed to allocate memory for dependencies');
  }
  
  // Write the dependency tuples to memory as Uint32 (4-byte usize values on wasm32)
  const memView = new Uint32Array(memory.buffer, ptr, deps.length * 2);
  for (let i = 0; i < deps.length; i++) {
    memView[i * 2] = deps[i][0];
    memView[i * 2 + 1] = deps[i][1];
  }
  
  return ptr;
}

/**
 * Free memory allocated by allocateDependencies
 * @param runtime WebAssembly runtime instance
 * @param ptr Pointer returned by allocateDependencies
 * @param len Number of dependency tuples
 */
export function freeDependencies(
  runtime: WebAssembly.Instance,
  ptr: number,
  len: number
): void {
  if (ptr === 0 || len === 0) {
    return;
  }
  const wasmExports = runtime.exports as any;
  const byteSize = len * 2 * USIZE_BYTES;
  wasmExports.diffsol_free(ptr, byteSize, USIZE_BYTES);
}
