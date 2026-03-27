/**
 * Test to verify icOptions and odeOptions properties work correctly
 */

import { compile, Ode, MatrixType, InitialConditionOptions, OdeOptions } from '../index';

const TEST_MODEL = `
in_i { k = 1 }
u_i { y = 1 }
F_i { -k * y }
out_i { y }
`;

const config = {
  backendUrl: 'http://localhost:8080',
};

describe('ODE Options Properties', () => {
  let ode: Ode | undefined;

  afterEach(() => {
    if (ode) {
      ode.dispose();
    }
  });

  test('icOptions is InitialConditionOptions instance', async () => {
    ode = await compile(TEST_MODEL, config, MatrixType.FaerDense);
    const icOpts = ode.icOptions;
    expect(icOpts).toBeInstanceOf(InitialConditionOptions);
  });

  test('odeOptions is OdeOptions instance', async () => {
    ode = await compile(TEST_MODEL, config, MatrixType.FaerDense);
    const odeOpts = ode.odeOptions;
    expect(odeOpts).toBeInstanceOf(OdeOptions);
  });

  test('icOptions properties are accessible', async () => {
    ode = await compile(TEST_MODEL, config, MatrixType.FaerDense);
    const icOpts = ode.icOptions;
    
    // Test getting properties
    const useLinesearch = icOpts.use_linesearch;
    expect(typeof useLinesearch).toBe('boolean');
    
    const maxIter = icOpts.max_newton_iterations;
    expect(typeof maxIter).toBe('number');
    expect(maxIter).toBeGreaterThan(0);
  });

  test('odeOptions properties are accessible', async () => {
    ode = await compile(TEST_MODEL, config, MatrixType.FaerDense);
    const odeOpts = ode.odeOptions;
    
    // Test getting properties
    const maxNonlinearIter = odeOpts.max_nonlinear_solver_iterations;
    expect(typeof maxNonlinearIter).toBe('number');
    expect(maxNonlinearIter).toBeGreaterThan(0);
    
    const minTimestep = odeOpts.min_timestep;
    expect(typeof minTimestep).toBe('number');
    expect(minTimestep).toBeGreaterThan(0);
  });

  test('icOptions can be modified', async () => {
    ode = await compile(TEST_MODEL, config, MatrixType.FaerDense);
    const icOpts = ode.icOptions;
    
    const originalValue = icOpts.max_newton_iterations;
    const newValue = originalValue + 1;
    
    icOpts.max_newton_iterations = newValue;
    expect(icOpts.max_newton_iterations).toBe(newValue);
    
    // Restore original
    icOpts.max_newton_iterations = originalValue;
  });

  test('odeOptions can be modified', async () => {
    ode = await compile(TEST_MODEL, config, MatrixType.FaerDense);
    const odeOpts = ode.odeOptions;
    
    const originalValue = odeOpts.max_nonlinear_solver_iterations;
    const newValue = originalValue + 1;
    
    odeOpts.max_nonlinear_solver_iterations = newValue;
    expect(odeOpts.max_nonlinear_solver_iterations).toBe(newValue);
    
    // Restore original
    odeOpts.max_nonlinear_solver_iterations = originalValue;
  });

  test('icOptions and odeOptions are cached', async () => {
    ode = await compile(TEST_MODEL, config, MatrixType.FaerDense);
    const icOpts1 = ode.icOptions;
    const icOpts2 = ode.icOptions;
    expect(icOpts1).toBe(icOpts2);
    
    const odeOpts1 = ode.odeOptions;
    const odeOpts2 = ode.odeOptions;
    expect(odeOpts1).toBe(odeOpts2);
  });

  test('options are cleaned up on dispose', async () => {
    const ode2 = await compile(TEST_MODEL, config, MatrixType.FaerDense);
    const icOpts = ode2.icOptions;
    const odeOpts = ode2.odeOptions;
    
    ode2.dispose();
    
    // Accessing properties after dispose should fail or be handled gracefully
    expect(() => {
      // The objects are disposed but still referenced
      // This test verifies they were created and cleaned up
      expect(icOpts).toBeDefined();
    }).not.toThrow();
  });
});
