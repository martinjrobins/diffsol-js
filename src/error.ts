/**
 * Error handling utilities for diffsol FFI
 * 
 * Provides centralized error checking and message retrieval from the C API.
 */

// Error code constants from C API
export const DIFFSOL_OK = 0;
export const DIFFSOL_ERR = -1;
export const DIFFSOL_BAD_ARG = -2;

/**
 * Custom error class for diffsol errors with optional file and line information
 */
export class DiffsolError extends Error {
  constructor(
    message: string,
    public readonly file?: string,
    public readonly line?: number
  ) {
    super(message);
    this.name = 'DiffsolError';
  }
}

/**
 * Check if there's an error from the last C function call and throw if present
 * @param runtime WebAssembly runtime instance
 * @param memory WebAssembly memory
 * @throws DiffsolError if error code is non-zero
 */
export function checkError(
  runtime: WebAssembly.Instance,
  memory: WebAssembly.Memory
): void {
  const error_code = (runtime.exports.diffsol_error_code as () => number)();
  if (error_code !== 0) {
    const error_msg = getErrorMessage(runtime, memory);
    throw new DiffsolError(error_msg);
  }
}

/**
 * Get error message from the C API
 * @param runtime WebAssembly runtime instance
 * @param memory WebAssembly memory
 * @returns Error message string
 */
export function getErrorMessage(
  runtime: WebAssembly.Instance,
  memory: WebAssembly.Memory
): string {
  const get_error = runtime.exports.diffsol_error as () => number;
  const msg_ptr = get_error();
  if (msg_ptr === 0) return 'Unknown error';

  const bytes = new Uint8Array(memory.buffer, msg_ptr);
  let length = 0;
  while (bytes[length] !== 0 && length < 1024) length++;
  return new TextDecoder().decode(bytes.slice(0, length));
}

/**
 * Get detailed error information from the C API including file and line
 * @param runtime WebAssembly runtime instance
 * @param memory WebAssembly memory
 * @returns DiffsolError with full error details
 */
export function getLastError(
  runtime: WebAssembly.Instance,
  memory: WebAssembly.Memory
): DiffsolError {
  const exports = runtime.exports as any;
  const messagePtr = exports.diffsol_last_error_message();
  const filePtr = exports.diffsol_last_error_file();
  const line = exports.diffsol_last_error_line();

  let message = 'Unknown error';
  let file = undefined;

  if (messagePtr !== 0) {
    message = readCString(memory, messagePtr);
  }
  if (filePtr !== 0) {
    file = readCString(memory, filePtr);
  }

  exports.diffsol_clear_last_error();

  return new DiffsolError(message, file, line);
}

/**
 * Read a null-terminated C string from WebAssembly memory
 * @param memory WebAssembly memory
 * @param ptr Pointer to the C string
 * @returns Decoded string
 */
function readCString(memory: WebAssembly.Memory, ptr: number): string {
  const bytes = new Uint8Array(memory.buffer);
  let end = ptr;
  while (bytes[end] !== 0) end++;
  const stringBytes = bytes.slice(ptr, end);
  return new TextDecoder().decode(stringBytes);
}
