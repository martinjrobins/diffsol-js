import { createInteractiveSolver, InteractiveSolverConfig } from '../interactive-solver';
import { compile } from '../compile';
import { MatrixType } from '../matrix-type';
import { LinearSolverType } from '../linear-solver-type';
import { OdeSolverType } from '../ode-solver-type';
import { TEST_BACKEND_URL } from './test-config';

const TEST_MODULE_CONFIG = { backendUrl: TEST_BACKEND_URL };

// Mock Plotly
jest.mock('plotly.js', () => ({
  react: jest.fn().mockResolvedValue(undefined),
}));

// Setup global Plotly for tests
const Plotly = require('plotly.js');
(window as any).Plotly = Plotly;

// Mock compile function
jest.mock('../compile', () => ({
  compile: jest.fn(),
}));

// Mock ODE solver
const mockOde = {
  solve: jest.fn(),
  dispose: jest.fn(),
  atol: 1e-6,
  rtol: 1e-6,
  inputs: [['k', 1]] as [string, number][],
  outputs: [['y', 1]] as [string, number][],
};

function makeMockSolution() {
  return {
    ts: new Float64Array([0, 0.5, 1.0]),
    ys: [
      new Float64Array([1.0]),
      new Float64Array([0.75]),
      new Float64Array([0.5]),
    ],
    dispose: jest.fn(),
  };
}

// Add custom jest matchers type
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
    }
  }
}

describe('Interactive Solver', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    // Create a container div for testing
    container = document.createElement('div');
    container.id = 'test-solver';
    document.body.appendChild(container);

    // Reset mocks
    jest.clearAllMocks();
    mockOde.inputs = [['k', 1]];
    mockOde.outputs = [['y', 1]];
    mockOde.solve.mockReturnValue(makeMockSolution());
    (compile as jest.Mock).mockResolvedValue(mockOde);
  });

  afterEach(() => {
    document.body.removeChild(container);
    
    // Clean up any help dialogs that were appended to body
    const helpOverlays = document.querySelectorAll('.diffsol-interactive-solver-help-dialog-overlay');
    helpOverlays.forEach(overlay => {
      if (overlay.parentNode === document.body) {
        document.body.removeChild(overlay);
      }
    });
  });

  describe('createInteractiveSolver', () => {
    it('should throw error if div not found', async () => {
      const config: InteractiveSolverConfig = {
        divId: 'nonexistent',
        diffslCode: 'in_i { k = 1 }',
        moduleConfig: TEST_MODULE_CONFIG,
      };

      await expect(createInteractiveSolver(config)).rejects.toThrow(
        'DOM element with id "nonexistent" not found'
      );
    });

    it('should create DOM structure with correct number of sliders', async () => {
      mockOde.inputs = [['k1', 1], ['k2', 1]];

      const config: InteractiveSolverConfig = {
        divId: 'test-solver',
        diffslCode: 'in_i { k1 = 1; k2 = 1 } u_i { y = 1 } F_i { -(k1 + k2) * y } out_i { y }',
        sliders: {
          k1: { min: 0.1, max: 5, initial: 1, label: 'Decay Rate 1' },
          k2: { min: 0, max: 10, initial: 5, label: 'Decay Rate 2' },
        },
        moduleConfig: TEST_MODULE_CONFIG,
      };

      mockOde.solve.mockReturnValue(makeMockSolution());

      await createInteractiveSolver(config);

      // Check if sliders were created
      const sliderInputs = container.querySelectorAll('input[type="range"]');
      expect(sliderInputs).toHaveLength(2);
    });

    it('should set initial slider values correctly', async () => {
      const config: InteractiveSolverConfig = {
        divId: 'test-solver',
        diffslCode: 'in_i { k = 1 }',
        sliders: {
          k: { min: 0.1, max: 5, initial: 2.5, label: 'Decay Rate' },
        },
        moduleConfig: TEST_MODULE_CONFIG,
      };

      mockOde.solve.mockReturnValue(makeMockSolution());

      await createInteractiveSolver(config);

      const sliderInput = container.querySelector('input[type="range"]') as HTMLInputElement;
      expect(sliderInput.value).toBe('2.5');
    });

    it('should use default slider values if not provided', async () => {
      const config: InteractiveSolverConfig = {
        divId: 'test-solver',
        diffslCode: 'in_i { k = 1 }',
        moduleConfig: TEST_MODULE_CONFIG,
      };

      mockOde.solve.mockReturnValue(makeMockSolution());

      await createInteractiveSolver(config);

      // Check that slider was created with default values
      const sliderInput = container.querySelector('input[type="range"]') as HTMLInputElement;
      expect(sliderInput).toBeTruthy();
      expect(sliderInput.min).toBe('0');
      expect(sliderInput.max).toBe('1');
      expect(sliderInput.value).toBe('0.5');
    });

    it('should display plot after successful solve', async () => {
      const config: InteractiveSolverConfig = {
        divId: 'test-solver',
        diffslCode: 'in_i { k = 1 } u_i { y = 1 } F_i { -k * y } out_i { y }',
        sliders: {
          k: { min: 0.1, max: 5, initial: 1, label: 'Decay Rate' },
        },
        moduleConfig: TEST_MODULE_CONFIG,
      };

      mockOde.solve.mockReturnValue(makeMockSolution());

      await createInteractiveSolver(config);

      // Check that Plotly.react was called
      expect(window.Plotly.react).toHaveBeenCalled();
    });

    it('should handle code editor being shown', async () => {
      const config: InteractiveSolverConfig = {
        divId: 'test-solver',
        diffslCode: 'in_i { k = 1 }',
        moduleConfig: TEST_MODULE_CONFIG,
        showCodeEditor: true,
      };

      mockOde.solve.mockReturnValue(makeMockSolution());

      await createInteractiveSolver(config);

      // Check that code editor panel exists
      const codeEditor = container.querySelector('.diffsol-interactive-solver-code-panel');
      expect(codeEditor).toBeTruthy();
    });

    it('should hide code editor when showCodeEditor is false', async () => {
      const config: InteractiveSolverConfig = {
        divId: 'test-solver',
        diffslCode: 'in_i { k = 1 }',
        moduleConfig: TEST_MODULE_CONFIG,
        showCodeEditor: false,
      };

      mockOde.solve.mockReturnValue(makeMockSolution());

      await createInteractiveSolver(config);

      // Check that code editor is not present
      const codeEditor = container.querySelector('.diffsol-interactive-solver-code-panel');
      expect(codeEditor).toBeFalsy();
    });

    it('should allow customizing plot height', async () => {
      const config: InteractiveSolverConfig = {
        divId: 'test-solver',
        diffslCode: 'in_i { k = 1 }',
        moduleConfig: TEST_MODULE_CONFIG,
        plotHeight: 700,
      };

      mockOde.solve.mockReturnValue(makeMockSolution());

      await createInteractiveSolver(config);

      // Check plotDiv height
      const plotDiv = container.querySelector('.diffsol-interactive-solver-plot') as HTMLDivElement;
      expect(plotDiv.style.height).toBe('700px');
    });

    it('should compile model with correct solver types', async () => {
      const config: InteractiveSolverConfig = {
        divId: 'test-solver',
        diffslCode: 'test',
        sliders: {
          k: { label: 'Parameter K' },
        },
        moduleConfig: TEST_MODULE_CONFIG,
        odeSolverType: OdeSolverType.Tsit45,
        linearSolverType: LinearSolverType.Klu,
        matrixType: MatrixType.FaerSparse,
      };

      mockOde.solve.mockReturnValue(makeMockSolution());

      await createInteractiveSolver(config);

      expect(compile).toHaveBeenCalledWith(
        'test',
        TEST_MODULE_CONFIG,
        MatrixType.FaerSparse,
        LinearSolverType.Klu,
        OdeSolverType.Tsit45
      );
    });

    it('should show help button when showHelp is true', async () => {
      const config: InteractiveSolverConfig = {
        divId: 'test-solver',
        diffslCode: 'in_i { k = 1 }',
        moduleConfig: TEST_MODULE_CONFIG,
        showHelp: true,
      };

      mockOde.solve.mockReturnValue(makeMockSolution());

      await createInteractiveSolver(config);

      // Check that help button is present
      const helpButton = document.body.querySelector('.diffsol-interactive-solver-help-button');
      expect(helpButton).toBeTruthy();
    });

    it('should hide help button when showHelp is false', async () => {
      const config: InteractiveSolverConfig = {
        divId: 'test-solver',
        diffslCode: 'in_i { k = 1 }',
        moduleConfig: TEST_MODULE_CONFIG,
        showHelp: false,
      };

      mockOde.solve.mockReturnValue(makeMockSolution());

      await createInteractiveSolver(config);

      // Check that help button is not present
      const helpButton = document.body.querySelector('.diffsol-interactive-solver-help-button');
      expect(helpButton).toBeFalsy();
    });
  });
});

// Helper constant for debounce timing
const DEBOUNCE_MS = 150;
