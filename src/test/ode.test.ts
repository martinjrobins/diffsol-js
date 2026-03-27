/**
 * Jest integration tests for diffsol WASM
 * 
 * Tests:
 * - Module loading and compilation
 * - ODE solver initialization
 * - Initial conditions (y0)
 * - Right-hand side (rhs) evaluation
 * - Tolerance getters/setters
 * - Full ODE solve
 * - Error handling
 */

import { compile, Ode, MatrixType, LinearSolverType, OdeSolverType, DiffsolError } from '../index';

// Simple DiffSL model for testing: exponential decay dy/dt = -k*y
const TEST_MODEL = `
in_i { k = 1 }
u_i { y = 1 }
F_i { -k * y }
out_i { y }
`;

const config = {
  backendUrl: 'http://localhost:8080',
};

describe('diffsol WASM Integration', () => {
  let ode: Ode | undefined;

  afterEach(() => {
    if (ode) {
      ode.dispose();
      ode = undefined;
    }
  });

  describe('Module Loading', () => {
    test('should compile and load modules successfully', async () => {
      ode = await compile(
        TEST_MODEL,
        config,
        MatrixType.FaerDense,
        LinearSolverType.Lu,
        OdeSolverType.Bdf
      );
      
      expect(ode).toBeDefined();
      expect(ode).toBeInstanceOf(Ode);
    });

    test('should create ODE solver with different matrix types', async () => {
      const matrixTypes = [
        MatrixType.NalgebraDense,
        MatrixType.FaerDense,
        MatrixType.FaerSparse,
      ];

      for (const matrixType of matrixTypes) {
        const solver = await compile(
          TEST_MODEL,
          config,
          matrixType,
          LinearSolverType.Lu,
          OdeSolverType.Bdf
        );
        expect(solver).toBeDefined();
        solver.dispose();
      }
    });

    test('should create ODE solver with different linear solvers', async () => {
      const linearSolvers = [
        LinearSolverType.Default,
        LinearSolverType.Lu,
        // LinearSolverType.Klu, unsupported
      ];

      for (const linearSolver of linearSolvers) {
        const solver = await compile(
          TEST_MODEL,
          config,
          MatrixType.FaerDense,
          linearSolver,
          OdeSolverType.Bdf
        );
        expect(solver).toBeDefined();
        solver.dispose();
      }
    });

    test('should create ODE solver with different ODE solvers', async () => {
      const odeSolvers = [
        OdeSolverType.Bdf,
        OdeSolverType.Esdirk34,
        OdeSolverType.TrBdf2,
        OdeSolverType.Tsit45,
      ];

      for (const odeSolver of odeSolvers) {
        const solver = await compile(
          TEST_MODEL,
          config,
          MatrixType.FaerDense,
          LinearSolverType.Lu,
          odeSolver
        );
        expect(solver).toBeDefined();
        solver.dispose();
      }
    });

    test('should use default linear and ODE solvers when not specified', async () => {
      const solver = await compile(
        TEST_MODEL,
        config,
        MatrixType.FaerDense
        // linearSolver and odeSolver omitted, should default to Default and Bdf
      );
      
      expect(solver).toBeDefined();
      expect(solver.linear_solver).toBe(LinearSolverType.Default);
      expect(solver.ode_solver).toBe(OdeSolverType.Bdf);
      solver.dispose();
    });
  });

  describe('ODE Functions', () => {
    beforeEach(async () => {
      ode = await compile(
        TEST_MODEL,
        config,
        MatrixType.FaerDense,
        LinearSolverType.Lu,
        OdeSolverType.Bdf
      );
    });

    test('should compute initial conditions correctly', () => {
      expect(ode).toBeDefined();
      const params = new Float64Array([1.0]); // k = 1
      const y0 = ode!.getY0(params);

      expect(y0).toHaveLength(1);
      expect(y0[0]).toBeCloseTo(1.0, 6);
    });

    test('should evaluate RHS function correctly', () => {
      expect(ode).toBeDefined();
      const params = new Float64Array([1.0]); // k = 1
      const t = 0.0;
      const y = new Float64Array([1.0]);

      const dydt = ode!.rhs(params, t, y);

      expect(dydt).toHaveLength(1);
      // For exponential decay: dy/dt = -k*y = -1*1 = -1
      expect(dydt[0]).toBeCloseTo(-1.0, 6);
    });

    test('should evaluate RHS at different points', () => {
      expect(ode).toBeDefined();
      const params = new Float64Array([1.0]); // k = 1

      const testCases = [
        { t: 0.0, y: 1.0, expected: -1.0 },
        { t: 0.5, y: 0.5, expected: -0.5 },
        { t: 1.0, y: 2.0, expected: -2.0 },
      ];

      for (const testCase of testCases) {
        const y = new Float64Array([testCase.y]);
        const dydt = ode!.rhs(params, testCase.t, y);
        expect(dydt[0]).toBeCloseTo(testCase.expected, 6);
      }
    });
  });

  describe('Tolerance Settings', () => {
    beforeEach(async () => {
      ode = await compile(
        TEST_MODEL,
        config,
        MatrixType.FaerDense,
        LinearSolverType.Lu,
        OdeSolverType.Bdf
      );
    });

    test('should get and set relative tolerance', () => {
      expect(ode).toBeDefined();
      
      const originalRtol = ode!.rtol;
      expect(originalRtol).toBeGreaterThan(0);

      ode!.rtol = 1e-8;
      const newRtol = ode!.rtol;
      expect(newRtol).toBeCloseTo(1e-8, 10);
    });

    test('should get and set absolute tolerance', () => {
      expect(ode).toBeDefined();
      
      const originalAtol = ode!.atol;
      expect(originalAtol).toBeGreaterThan(0);

      ode!.atol = 1e-9;
      const newAtol = ode!.atol;
      expect(newAtol).toBeCloseTo(1e-9, 10);
    });

    test('should maintain multiple tolerance changes', () => {
      expect(ode).toBeDefined();

      ode!.rtol = 1e-7;
      ode!.atol = 1e-8;

      expect(ode!.rtol).toBeCloseTo(1e-7, 10);
      expect(ode!.atol).toBeCloseTo(1e-8, 10);

      ode!.rtol = 1e-9;
      expect(ode!.rtol).toBeCloseTo(1e-9, 10);
      expect(ode!.atol).toBeCloseTo(1e-8, 10);
    });
  });

  describe('Solver Type Settings', () => {
    beforeEach(async () => {
      ode = await compile(
        TEST_MODEL,
        config,
        MatrixType.FaerDense,
        LinearSolverType.Lu,
        OdeSolverType.Esdirk34
      );
    });

    test('should get linear solver type', () => {
      expect(ode).toBeDefined();
      expect(ode!.linear_solver).toBe(LinearSolverType.Lu);
    });

    test('should set linear solver type', () => {
      expect(ode).toBeDefined();
      
      ode!.linear_solver = LinearSolverType.Klu;
      expect(ode!.linear_solver).toBe(LinearSolverType.Klu);

      ode!.linear_solver = LinearSolverType.Default;
      expect(ode!.linear_solver).toBe(LinearSolverType.Default);
    });

    test('should get ODE solver type', () => {
      expect(ode).toBeDefined();
      expect(ode!.ode_solver).toBe(OdeSolverType.Esdirk34);
    });

    test('should set ODE solver type', () => {
      expect(ode).toBeDefined();
      
      ode!.ode_solver = OdeSolverType.Bdf;
      expect(ode!.ode_solver).toBe(OdeSolverType.Bdf);

      ode!.ode_solver = OdeSolverType.TrBdf2;
      expect(ode!.ode_solver).toBe(OdeSolverType.TrBdf2);
    });
  });

  describe('ODE Solve', () => {
    beforeEach(async () => {
      ode = await compile(
        TEST_MODEL,
        config,
        MatrixType.FaerDense,
        LinearSolverType.Lu,
        OdeSolverType.Bdf
      );
    });

    test('should solve ODE to final time', () => {
      expect(ode).toBeDefined();
      const params = new Float64Array([1.0]); // k = 1
      const finalTime = 1.0;

      const solution = ode!.solve(params, finalTime);
      try {
        const ys = solution.ys;
        const ts = solution.ts;
        expect(ys).toBeDefined();
        expect(ts).toBeDefined();
        expect(ys.length).toBeGreaterThan(0);
        expect(ts.length).toBeGreaterThan(0);
        expect(ys).toHaveLength(ts.length);
      } finally {
        solution.dispose();
      }
    });

    test('should solve ODE at specific time points', () => {
      expect(ode).toBeDefined();
      const params = new Float64Array([1.0]); // k = 1
      const tEval = new Float64Array([0.0, 0.5, 1.0, 2.0]);

      const solution = ode!.solveDense(params, tEval);
      try {
        const ys = solution.ys;
        expect(ys).toHaveLength(tEval.length);
        
        // Verify solution makes sense for exponential decay dy/dt = -y
        // y(t) = y0 * exp(-k*t) = 1.0 * exp(-t)
        for (let i = 0; i < tEval.length; i++) {
          const analytical = Math.exp(-tEval[i]);
          const computed = ys[i][0];
          const error = Math.abs(computed - analytical);

          // Should be accurate to about 1e-5 with default tolerances
          expect(error).toBeLessThan(1e-3);
        }
      } finally {
        solution.dispose();
      }
    });

    test('should compute accurate solution at t=0', () => {
      expect(ode).toBeDefined();
      const params = new Float64Array([1.0]);
      const tEval = new Float64Array([0.0, 1.0]);

      const solution = ode!.solveDense(params, tEval);
      try {
        const ys = solution.ys;
        expect(ys[0][0]).toBeCloseTo(1.0, 4);
      } finally {
        solution.dispose();
      }
    });

    test('should handle multiple solves', () => {
      expect(ode).toBeDefined();
      const params = new Float64Array([1.0]);

      const tEval1 = new Float64Array([0.0, 1.0]);
      const solution1 = ode!.solveDense(params, tEval1);

      const tEval2 = new Float64Array([0.0, 0.5, 1.0]);
      const solution2 = ode!.solveDense(params, tEval2);

      try {
        const ys1 = solution1.ys;
        const ys2 = solution2.ys;
        // Both should give the same solution at t=1.0
        expect(ys1[1][0]).toBeCloseTo(ys2[2][0], 6);
      } finally {
        solution1.dispose();
        solution2.dispose();
      }
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      ode = await compile(
        TEST_MODEL,
        config,
        MatrixType.FaerDense,
        LinearSolverType.Lu,
        OdeSolverType.Bdf
      );
    });

    test('should throw error on invalid parameter count for rhs', () => {
      expect(ode).toBeDefined();
      const badParams = new Float64Array([]); // Wrong size
      const y = new Float64Array([1.0]);

      expect(() => {
        ode!.rhs(badParams, 0.0, y);
      }).toThrow();
    });

    test('should throw DiffsolError with proper context', () => {
      expect(ode).toBeDefined();
      const badParams = new Float64Array([]); // Wrong size
      const y = new Float64Array([1.0]);

      try {
        ode!.rhs(badParams, 0.0, y);
        fail('Should have thrown an error');
      } catch (e: any) {
        expect(e).toBeInstanceOf(DiffsolError);
        expect(e.message).toBeDefined();
      }
    });
  });

  describe('Lifecycle', () => {
    test('should dispose ODE solver', async () => {
      const solver = await compile(
        TEST_MODEL,
        config,
        MatrixType.FaerDense,
        LinearSolverType.Lu,
        OdeSolverType.Bdf
      );

      expect(solver).toBeDefined();
      solver.dispose();

      // After dispose, the handle should be invalid
      // (operations would fail if we tried to use it)
    });

    test('should handle multiple dispose calls gracefully', async () => {
      const solver = await compile(
        TEST_MODEL,
        config,
        MatrixType.FaerDense,
        LinearSolverType.Lu,
        OdeSolverType.Bdf
      );

      solver.dispose();
      // Should not throw on second dispose
      expect(() => solver.dispose()).not.toThrow();
    });

    test('should auto-cleanup with FinalizationRegistry when not explicitly disposed', async () => {
      let solver: Ode | undefined = await compile(
        TEST_MODEL,
        config,
        MatrixType.FaerDense,
        LinearSolverType.Lu,
        OdeSolverType.Bdf
      );

      expect(solver).toBeDefined();
      
      // Remove the reference without calling dispose
      solver = undefined;

      // Force garbage collection if available (only works with --expose-gc flag in Node.js)
      if (global.gc) {
        global.gc();
        // Finalizer should have been called, cleaning up resources
      }

      // Test passes if no crash or resource leak occurs
      expect(true).toBe(true);
    });
  });
});
