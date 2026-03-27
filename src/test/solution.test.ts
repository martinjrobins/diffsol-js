import {
  compile,
  Ode,
  Solution,
  MatrixType,
  LinearSolverType,
  OdeSolverType,
} from '../index';

const TEST_MODEL = `
in_i { k = 1 }
u_i { y = 1 }
F_i { -k * y }
out_i { y }
`;

const config = {
  backendUrl: 'http://localhost:8080',
};

describe('Solution Wrapper', () => {
  let ode: Ode | undefined;
  let solution: Solution | undefined;

  afterEach(() => {
    if (solution) {
      solution.dispose();
      solution = undefined;
    }
    if (ode) {
      ode.dispose();
      ode = undefined;
    }
  });

  test('constructor rejects null handle', () => {
    const memory = new WebAssembly.Memory({ initial: 1 });
    const runtime = { exports: {} } as unknown as WebAssembly.Instance;
    expect(() => new Solution(runtime, memory, 0)).toThrow('Invalid solution handle');
  });

  test('solve returns solution with trajectory data', async () => {
    ode = await compile(
      TEST_MODEL,
      config,
      MatrixType.FaerDense,
      LinearSolverType.Lu,
      OdeSolverType.Bdf
    );

    const params = new Float64Array([1.0]);
    solution = ode.solve(params, 1.0);

    const ts = solution.ts;
    const ys = solution.ys;

    expect(ts.length).toBeGreaterThan(0);
    expect(ys.length).toBe(ts.length);
    expect(ys[0].length).toBe(1);
  });

  test('currentState can be read and updated', async () => {
    ode = await compile(TEST_MODEL, config, MatrixType.FaerDense, LinearSolverType.Lu, OdeSolverType.Bdf);

    const params = new Float64Array([1.0]);
    solution = ode.solve(params, 0.5);

    const state = solution.currentState;
    expect(state.length).toBe(1);

    const updated = new Float64Array([state[0] * 0.5]);
    solution.currentState = updated;

    const readBack = solution.currentState;
    expect(readBack[0]).toBeCloseTo(updated[0], 12);
  });

  test('solve can reuse an existing solution instance', async () => {
    ode = await compile(TEST_MODEL, config, MatrixType.FaerDense, LinearSolverType.Lu, OdeSolverType.Bdf);

    const params = new Float64Array([1.0]);
    solution = ode.solve(params, 0.5);

    const reused = ode.solve(params, 1.0, solution);
    expect(reused).toBe(solution);
  });

  test('solveFwdSens returns a solution with trajectory data', async () => {
    ode = await compile(TEST_MODEL, config, MatrixType.FaerDense, LinearSolverType.Lu, OdeSolverType.Bdf);

    const params = new Float64Array([1.0]);
    const tEval = new Float64Array([0.0, 0.5, 1.0]);
    solution = ode.solveFwdSens(params, tEval);

    const ys = solution.ys;
    expect(ys.length).toBe(tEval.length);
    expect(ys[0].length).toBe(1);
  });

  test('dispose invalidates handle access', async () => {
    ode = await compile(TEST_MODEL, config, MatrixType.FaerDense, LinearSolverType.Lu, OdeSolverType.Bdf);

    const params = new Float64Array([1.0]);
    solution = ode.solve(params, 0.5);
    solution.dispose();
    solution = undefined;

    // Create a fresh one to exercise the error path without using a stale variable in afterEach
    const toDispose = ode.solve(params, 0.25);
    toDispose.dispose();
    expect(() => toDispose.handle).toThrow('Solution has been disposed');
  });

  test('sens getter decodes host-array list and frees list memory', () => {
    const memory = new WebAssembly.Memory({ initial: 1 });
    let heap = 1024;
    let nextHostArrayHandle = 50000;
    const hostArrays = new Map<
      number,
      { ndim: number; dims: [number, number]; strides: [number, number]; dataPtr: number }
    >();

    const alignUp = (value: number, align: number): number =>
      Math.ceil(value / align) * align;

    const alloc = (size: number, align: number): number => {
      const ptr = alignUp(heap, Math.max(1, align));
      heap = ptr + size;
      return ptr;
    };

    const create2DHostArray = (values: number[]): number => {
      const rows = 1;
      const cols = values.length;
      const dataPtr = alloc(cols * 8, 8);
      const data = new Float64Array(memory.buffer, dataPtr, cols);
      for (let i = 0; i < cols; i++) {
        data[i] = values[i];
      }

      const handle = nextHostArrayHandle;
      nextHostArrayHandle += 4;
      hostArrays.set(handle, {
        ndim: 2,
        dims: [rows, cols],
        strides: [8, 8],
        dataPtr,
      });
      return handle;
    };

    const arrayPtr0 = create2DHostArray([1.0, 2.0, 3.0]);
    const arrayPtr1 = create2DHostArray([10.0, 20.0, 30.0]);
    const listPtr = alloc(2 * 4, 4);
    new Uint32Array(memory.buffer, listPtr, 2).set([arrayPtr0, arrayPtr1]);

    const wasmExports = {
      diffsol_alloc: jest.fn((size: number, align: number) => alloc(size, align)),
      diffsol_free: jest.fn(),
      diffsol_solution_wrapper_get_sens: jest.fn(
        (_handle: number, outSensPtr: number, outSensLenPtr: number) => {
          const u32 = new Uint32Array(memory.buffer);
          u32[outSensPtr / 4] = listPtr;
          u32[outSensLenPtr / 4] = 2;
          return 0;
        }
      ),
      diffsol_host_array_ndim: jest.fn((arrayPtr: number) => hostArrays.get(arrayPtr)!.ndim),
      diffsol_host_array_dim: jest.fn((arrayPtr: number, axis: number) => hostArrays.get(arrayPtr)!.dims[axis]),
      diffsol_host_array_stride: jest.fn(
        (arrayPtr: number, axis: number) => hostArrays.get(arrayPtr)!.strides[axis]
      ),
      diffsol_host_array_ptr: jest.fn((arrayPtr: number) => hostArrays.get(arrayPtr)!.dataPtr),
      diffsol_host_array_free: jest.fn(),
      diffsol_host_array_list_free: jest.fn(),
      diffsol_solution_wrapper_free: jest.fn(),
    };

    const runtime = { exports: wasmExports } as unknown as WebAssembly.Instance;
    const mockSolution = new Solution(runtime, memory, 42);

    const sens = mockSolution.sens;
    expect(sens).toHaveLength(2);
    expect(Array.from(sens[0], c => c[0])).toEqual([1.0, 2.0, 3.0]);
    expect(Array.from(sens[1], c => c[0])).toEqual([10.0, 20.0, 30.0]);

    expect(wasmExports.diffsol_host_array_free).toHaveBeenCalledTimes(2);
    expect(wasmExports.diffsol_host_array_list_free).toHaveBeenCalledWith(listPtr, 2);

    mockSolution.dispose();
    expect(wasmExports.diffsol_solution_wrapper_free).toHaveBeenCalledWith(42);
  });
});
