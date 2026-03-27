import { compile, ModuleConfig } from './compile';
import { Ode } from './ode';
import { OdeSolverType } from './ode-solver-type';
import { LinearSolverType } from './linear-solver-type';
import { MatrixType } from './matrix-type';
import { basicEditor, PrismEditor } from 'prism-code-editor/setups';
import 'prism-code-editor/prism/languages/javascript';

// Type for code editor themes
export type CodeEditorTheme = 
  | 'atom-one-dark'
  | 'dracula'
  | 'github-dark'
  | 'github-dark-dimmed'
  | 'github-light'
  | 'night-owl'
  | 'night-owl-light'
  | 'prism'
  | 'prism-okaidia'
  | 'prism-solarized-light'
  | 'prism-tomorrow'
  | 'prism-twilight'
  | 'vs-code-dark'
  | 'vs-code-light';

// Declare Plotly as available globally when loaded from CDN
declare global {
  interface Window {
    Plotly: any;
  }
}

// Type definitions for Plotly (simplified)
namespace PlotlyTypes {
  export interface Data {
    x: any;
    y: any;
    type?: string;
    mode?: string;
    name?: string;
    line?: { width?: number };
  }
  
  export interface Layout {
    title?: string;
    xaxis?: { title?: string };
    yaxis?: { title?: string };
    hovermode?: string;
    margin?: { l?: number; r?: number; t?: number; b?: number };
  }
}

/**
 * Configuration for a single slider controlling a model input
 */
export interface SliderConfigMap {
  /** Display label for the input (defaults to input name) */
  label?: string;
  /** Minimum slider value (default: 0) */
  min?: number;
  /** Maximum slider value (default: 1) */
  max?: number;
  /** Initial value (default: 0.5) */
  initial?: number;
}

/**
 * Configuration for a single output
 */
export interface OutputConfigMap {
  /** Display label for the output (defaults to output name) */
  label?: string;
}

/**
 * Configuration for the interactive solver UI
 */
export interface InteractiveSolverConfig {
  /** ID of the DOM element to populate */
  divId: string;
  /** DiffSL model code */
  diffslCode: string;
  /** Slider configurations: map from input name to config, or undefined to use defaults */
  sliders?: Record<string, SliderConfigMap>;
  /** Backend module configuration */
  moduleConfig: ModuleConfig;
  /** Output configurations: map from output name to config, or undefined to use defaults */
  outputs?: Record<string, OutputConfigMap>;
  /** ODE solver type (default: Bdf) */
  odeSolverType?: OdeSolverType;
  /** Linear solver type (default: Default) */
  linearSolverType?: LinearSolverType;
  /** Matrix type (default: FaerDense) */
  matrixType?: MatrixType;
  /** End time for simulation (default: 1.0) */
  finalTime?: number;
  /** Plot height in pixels (default: 500) */
  plotHeight?: number;
  /** Number of time points to evaluate (default: 200) */
  numTimePoints?: number;
  /** Debounce time for slider events in milliseconds (default: 10) */
  debounceMs?: number;
  /** Optional plot title (no title if not provided) */
  plotTitle?: string;
  /** Show code editor (default: true) */
  showCodeEditor?: boolean;
  /** Code editor width as percentage (default: "60%") */
  codeEditorWidth?: string;
  /** Make code editor read-only (default: false) */
  readOnlyCode?: boolean;
  /** Code editor theme (default: "github-light") */
  codeEditorTheme?: CodeEditorTheme;
  /** Code editor height in pixels or CSS string. If not provided, calculated from line count */
  codeEditorHeight?: number | string;
  /** Show help button (default: true) */
  showHelp?: boolean;
  /** Help button position (default: "bottom-right") */
  helpButtonPosition?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  /** Custom help content HTML (optional) */
  customHelpContent?: string;
}

interface InteractiveSolverState {
  ode: Ode | null;
  sliders: HTMLInputElement[];
  sliderNames: string[];
  sliderConfigs: Record<string, RequiredSliderConfig>;
  valueDisplays: HTMLElement[];
  plotDiv: HTMLDivElement;
  errorDiv: HTMLDivElement;
  isLoading: boolean;
  lastSolveTime: number;
  debounceTimer: number | null;
  parameters: Float64Array;
  outputConfigs: Record<string, RequiredOutputConfig>;
  plotTitle?: string;
  codeEditor: PrismEditor | null;
  currentCode: string;
  codeEditorTheme: CodeEditorTheme;
  compileButton: HTMLButtonElement | null;
  isCompiling: boolean;
  helpButton: HTMLButtonElement | null;
  helpDialog: HTMLElement | null;
  helpOverlay: HTMLElement | null;
  isHelpOpen: boolean;
  editButton: HTMLButtonElement | null;
  editDialog: HTMLElement | null;
  editOverlay: HTMLElement | null;
  isEditOpen: boolean;
  config: InteractiveSolverConfig;
}

interface RequiredSliderConfig {
  label: string;
  min: number;
  max: number;
  initial: number;
}

interface RequiredOutputConfig {
  label: string;
}

const CSS_CLASS_PREFIX = 'diffsol-interactive-solver';

/**
 * Create an interactive solver UI that allows real-time parameter adjustment
 * 
 * @param config - Configuration for the solver UI
 * @throws Error if div not found, slider count mismatch, or compilation fails
 */
export async function createInteractiveSolver(config: InteractiveSolverConfig): Promise<void> {
  // Validate inputs
  const targetElement = document.getElementById(config.divId);
  if (!targetElement) {
    throw new Error(`DOM element with id "${config.divId}" not found`);
  }
  const targetDiv = targetElement as HTMLDivElement;

  const finalTime = config.finalTime ?? 1.0;
  const plotHeight = config.plotHeight ?? 500;
  const numTimePoints = config.numTimePoints ?? 200;
  const debounceMs = config.debounceMs ?? 10;
  const matrixType = config.matrixType ?? MatrixType.FaerDense;
  const linearSolverType = config.linearSolverType ?? LinearSolverType.Default;
  const odeSolverType = config.odeSolverType ?? OdeSolverType.Bdf;
  const showCodeEditor = config.showCodeEditor ?? true;
  const showHelp = config.showHelp ?? true;

  let ode: Ode | null = null;
  let modelInputs: [string, number][] = [];
  let modelOutputs: [string, number][] = [];

  // Compile model first to get input/output metadata
  try {
    console.log('Compiling DiffSL model...');
    ode = await compile(
      config.diffslCode,
      config.moduleConfig,
      matrixType,
      linearSolverType,
      odeSolverType
    );

    // Extract metadata from compiled ODE
    modelInputs = ode.inputs;
    modelOutputs = ode.outputs;
    console.log(`Model has ${modelInputs.length} inputs and ${modelOutputs.length} outputs`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    targetDiv.innerHTML = '';
    targetDiv.classList.add(`${CSS_CLASS_PREFIX}-container`);
    const errorDiv = document.createElement('div');
    errorDiv.className = `${CSS_CLASS_PREFIX}-error`;
    errorDiv.style.height = `${plotHeight}px`;
    errorDiv.textContent = `Failed to compile model: ${errorMsg}`;
    targetDiv.appendChild(errorDiv);
    console.error('Interactive solver error:', error);
    return;
  }

  // Merge user config with model metadata
  const sliderConfigs = mergeSliderConfigs(modelInputs, config.sliders);
  const outputConfigs = mergeOutputConfigs(modelOutputs, config.outputs);

  // Initialize state
  const state: InteractiveSolverState = {
    ode: ode,
    sliders: [],
    sliderNames: modelInputs.map(([name]) => name),
    sliderConfigs: sliderConfigs,
    valueDisplays: [],
    plotDiv: document.createElement('div'),
    errorDiv: document.createElement('div'),
    isLoading: false,
    lastSolveTime: 0,
    debounceTimer: null,
    parameters: new Float64Array(modelInputs.length),
    outputConfigs: outputConfigs,
    plotTitle: config.plotTitle,
    codeEditor: null,
    currentCode: config.diffslCode,
    codeEditorTheme: config.codeEditorTheme ?? 'github-light',
    compileButton: null,
    isCompiling: false,
    helpButton: null,
    helpDialog: null,
    helpOverlay: null,
    isHelpOpen: false,
    editButton: null,
    editDialog: null,
    editOverlay: null,
    isEditOpen: false,
    config: config,
  };

  // Build DOM structure
  buildDOM(targetDiv as HTMLDivElement, state, plotHeight, showCodeEditor, showHelp, debounceMs, finalTime, numTimePoints);

  try {
    showLoading(state, true);
    showError(state, '');

    // Initialize parameters with slider initial values
    Object.entries(sliderConfigs).forEach(([name, sliderConfig]) => {
      const inputIndex = modelInputs.findIndex(([inputName]) => inputName === name);
      if (inputIndex >= 0) {
        state.parameters[inputIndex] = sliderConfig.initial;
      }
    });

    // Setup slider event listeners
    setupSliderListeners(state, sliderConfigs, debounceMs);

    // Setup compile button listener
    if (state.compileButton) {
      setupCompileButtonListener(state, finalTime, numTimePoints, matrixType, linearSolverType, odeSolverType, debounceMs);
      // Setup keyboard shortcut (Ctrl+S)
      setupEditorKeyboardShortcuts(state, finalTime, numTimePoints, matrixType, linearSolverType, odeSolverType);
    }

    // Perform initial solve
    await solveAndPlot(state, finalTime, numTimePoints);

    showLoading(state, false);
  } catch (error) {
    showLoading(state, false);
    const errorMsg = error instanceof Error ? error.message : String(error);
    showError(state, `Failed to setup solver: ${errorMsg}`);
    console.error('Interactive solver error:', error);
  }
}

/**
 * Merge model input metadata with user-provided slider configurations
 * Provides defaults for missing configurations
 */
function mergeSliderConfigs(
  modelInputs: [string, number][],
  userConfigs?: Record<string, SliderConfigMap>
): Record<string, RequiredSliderConfig> {
  const merged: Record<string, RequiredSliderConfig> = {};

  modelInputs.forEach(([inputName]) => {
    const userConfig = userConfigs?.[inputName];
    merged[inputName] = {
      label: userConfig?.label ?? inputName,
      min: userConfig?.min ?? 0,
      max: userConfig?.max ?? 1,
      initial: userConfig?.initial ?? 0.5,
    };
  });

  return merged;
}

/**
 * Merge model output metadata with user-provided output configurations
 * Provides defaults for missing configurations
 */
function mergeOutputConfigs(
  modelOutputs: [string, number][],
  userConfigs?: Record<string, OutputConfigMap>
): Record<string, RequiredOutputConfig> {
  const merged: Record<string, RequiredOutputConfig> = {};

  modelOutputs.forEach(([outputName]) => {
    const userConfig = userConfigs?.[outputName];
    merged[outputName] = {
      label: userConfig?.label ?? outputName,
    };
  });

  return merged;
}

/**
 * Build the DOM structure for the interactive solver
 */
function buildDOM(
  targetDiv: HTMLDivElement,
  state: InteractiveSolverState,
  plotHeight: number,
  showCodeEditor: boolean,
  showHelp: boolean,
  debounceMs: number = 50,
  finalTime: number = 1.0,
  numTimePoints: number = 200
): void {
  // Clear existing content
  targetDiv.innerHTML = '';

  // Add container class
  targetDiv.classList.add(`${CSS_CLASS_PREFIX}-container`);
  // Make container position relative for absolute positioned children
  targetDiv.style.position = 'relative';

  // Error display
  state.errorDiv.className = `${CSS_CLASS_PREFIX}-error`;
  state.errorDiv.style.height = `${plotHeight}px`;
  targetDiv.appendChild(state.errorDiv);

  // Plot container
  state.plotDiv.id = `${CSS_CLASS_PREFIX}-plot-${Math.random().toString(36).slice(2)}`;
  state.plotDiv.className = `${CSS_CLASS_PREFIX}-plot`;
  state.plotDiv.style.height = `${plotHeight}px`;
  targetDiv.appendChild(state.plotDiv);

  // Content container (code editor + sliders)
  const contentContainer = document.createElement('div');
  contentContainer.className = `${CSS_CLASS_PREFIX}-content`;
  targetDiv.appendChild(contentContainer);

  // Code editor panel (left side)
  if (showCodeEditor) {
    const codePanel = createCodeEditorPanel(state);
    contentContainer.appendChild(codePanel);
  }

  // Sliders panel (right side)
  const slidersPanel = document.createElement('div');
  slidersPanel.className = `${CSS_CLASS_PREFIX}-sliders-panel`;
  contentContainer.appendChild(slidersPanel);

  // Sliders container
  const slidersContainer = document.createElement('div');
  slidersContainer.className = `${CSS_CLASS_PREFIX}-sliders`;
  slidersPanel.appendChild(slidersContainer);

  // Create sliders from state slider configs
  state.sliderNames.forEach((inputName) => {
    const sliderConfig = state.sliderConfigs[inputName];
    const sliderIndex = state.sliderNames.indexOf(inputName);
    const sliderGroup = createSliderElement(sliderConfig, inputName, sliderIndex);
    slidersContainer.appendChild(sliderGroup.container);
    state.sliders.push(sliderGroup.input);
    state.valueDisplays.push(sliderGroup.display);
  });

  // Help button
  if (showHelp) {
    const helpButton = createHelpButton(state);
    targetDiv.appendChild(helpButton);
    createHelpDialog(state);
    setupHelpButtonListener(state);
  }

  // Edit button
  if (showHelp) {
    const editButton = createEditButton(state);
    targetDiv.appendChild(editButton);
    createEditDialog(state);
    setupEditButtonListener(state, debounceMs, finalTime, numTimePoints);
  }
}

/**
 * Create a single slider element with label and value display
 */
function createSliderElement(
  config: RequiredSliderConfig,
  inputName: string,
  index: number
): { container: HTMLElement; input: HTMLInputElement; display: HTMLElement } {
  const container = document.createElement('div');
  container.className = `${CSS_CLASS_PREFIX}-slider-group`;

  // Label
  const label = document.createElement('label');
  label.className = `${CSS_CLASS_PREFIX}-label`;
  label.textContent = config.label;
  container.appendChild(label);

  // Slider and value in a row
  const sliderRow = document.createElement('div');
  sliderRow.className = `${CSS_CLASS_PREFIX}-slider-row`;

  // Input slider
  const input = document.createElement('input');
  input.type = 'range';
  input.className = `${CSS_CLASS_PREFIX}-input`;
  input.min = String(config.min);
  input.max = String(config.max);
  const step = (config.max - config.min) / 100;
  input.step = String(step);
  input.value = String(config.initial);
  // Dynamic gradient background
  input.style.background = `linear-gradient(to right, #667eea 0%, #667eea ${((config.initial - config.min) / (config.max - config.min)) * 100}%, #d0d0d0 ${((config.initial - config.min) / (config.max - config.min)) * 100}%, #d0d0d0 100%)`;
  input.dataset.sliderIndex = String(index);
  input.dataset.inputName = inputName;

  // Update background gradient on input
  input.addEventListener('input', () => {
    const percent = ((parseFloat(input.value) - config.min) / (config.max - config.min)) * 100;
    input.style.background = `linear-gradient(to right, #667eea 0%, #667eea ${percent}%, #d0d0d0 ${percent}%, #d0d0d0 100%)`;
  });

  sliderRow.appendChild(input);

  // Value display
  const display = document.createElement('span');
  display.className = `${CSS_CLASS_PREFIX}-value`;
  display.textContent = config.initial.toFixed(3);
  sliderRow.appendChild(display);

  container.appendChild(sliderRow);

  return { container, input, display };
}

/**
 * Setup event listeners for sliders
 */
function setupSliderListeners(
  state: InteractiveSolverState,
  sliderConfigs: Record<string, RequiredSliderConfig>,
  debounceMs: number
): void {
  state.sliders.forEach((slider, index) => {
    slider.addEventListener('input', (e) => {
      const value = parseFloat((e.target as HTMLInputElement).value);
      state.parameters[index] = value;
      state.valueDisplays[index].textContent = value.toFixed(3);

      // Debounce the solve
      if (state.debounceTimer !== null) {
        clearTimeout(state.debounceTimer);
      }
      
      state.debounceTimer = window.setTimeout(async () => {
        if (state.ode) {
          try {
            await solveAndPlot(state, state.config.finalTime ?? 1.0, state.config.numTimePoints ?? 200);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            showError(state, `Solve failed: ${errorMsg}`);
            console.error('Solve error:', error);
          }
        }
      }, debounceMs);
    });
  });
}

/**
 * Solve the ODE and update the Plotly plot
 */
async function solveAndPlot(
  state: InteractiveSolverState,
  finalTime: number,
  numTimePoints: number
): Promise<void> {
  if (!state.ode) {
    return;
  }

  const startTime = performance.now();
  showLoading(state, true);

  try {
    // Solve ODE - solver picks its own time values
    console.log(`Solving with parameters:`, Array.from(state.parameters));
    const { ts, ys } = (() => {
      const solution = state.ode!.solve(state.parameters, finalTime);
      try {
        return { ts: solution.ts, ys: solution.ys };
      } finally {
        solution.dispose();
      }
    })();

    // Extract data for Plotly
    const traces: PlotlyTypes.Data[] = [];
    let yAxisTitle = 'Value';
    
    // Create one trace per output
    // ys is a 2D array: ys[timestep][output]
    if (ys.length > 0 && ys[0].length > 0) {
      const numOutputs = ys[0].length;
      const outputNames = Object.keys(state.outputConfigs);
      
      // If only one output, use its label for y-axis
      if (numOutputs === 1 && outputNames.length > 0) {
        yAxisTitle = state.outputConfigs[outputNames[0]].label;
      }
      
      for (let outputIdx = 0; outputIdx < numOutputs; outputIdx++) {
        const yValues = ys.map(y => y[outputIdx]);
        const outputName = outputNames[outputIdx];
        const outputLabel = outputName ? state.outputConfigs[outputName].label : `Output ${outputIdx}`;
        
        traces.push({
          x: Array.from(ts),
          y: yValues,
          type: 'scatter',
          mode: 'lines',
          name: outputLabel,
          line: {
            width: 2,
          },
        });
      }
    }

    // Update plot
    const layout: Partial<PlotlyTypes.Layout> = {
      xaxis: { title: 'Time' },
      yaxis: { title: yAxisTitle },
      hovermode: 'x unified',
      margin: { l: 60, r: 20, t: state.plotTitle ? 40 : 20, b: 50 },
    };

    // Only add title if provided
    if (state.plotTitle) {
      layout.title = state.plotTitle;
    }

    await window.Plotly.react(state.plotDiv, traces, layout, {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
    });

    const elapsed = performance.now() - startTime;
    console.log(`Solve completed in ${elapsed.toFixed(2)}ms`);
    state.lastSolveTime = elapsed;

    showError(state, '');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    showError(state, `Solve failed: ${errorMsg}`);
    console.error('Solve error:', error);
  } finally {
    showLoading(state, false);
  }
}

/**
 * Calculate editor height from number of lines
 * Uses approximately 20px per line plus some padding
 */
function calculateEditorHeightFromLines(lineCount: number): string {
  // Line height is approximately 20px, add more for padding and borders
  const minHeight = 200; // Minimum height
  const maxHeight = 600; // Maximum height
  const calculatedHeight = Math.max(minHeight, Math.min(maxHeight, lineCount * 20 + 30));
  return `${calculatedHeight}px`;
}

/**
 * Setup keyboard shortcut for compiling (Ctrl+S when editor is focused)
 * Uses prism-code-editor's keyCommandMap to intercept Ctrl+S
 */
function setupEditorKeyboardShortcuts(
  state: InteractiveSolverState,
  finalTime: number,
  numTimePoints: number,
  matrixType: MatrixType,
  linearSolverType: LinearSolverType,
  odeSolverType: OdeSolverType
): void {
  if (!state.codeEditor) return;

  // Get the editor's keyCommandMap and store the old 's' handler if it exists
  const oldSHandler = (state.codeEditor as any).keyCommandMap?.['s'];

  // Set up the new Ctrl+S handler
  if (!((state.codeEditor as any).keyCommandMap)) {
    (state.codeEditor as any).keyCommandMap = {};
  }

  (state.codeEditor as any).keyCommandMap['s'] = (e: KeyboardEvent) => {
    // Check for Ctrl+S (Windows/Linux) or Cmd+S (Mac)
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
      // Trigger compile button click
      if (state.compileButton) {
        state.compileButton.click();
      }
      return true; // Prevents default browser save behavior
    }
    // Delegate to old handler if it exists
    return oldSHandler?.(e);
  };
}

/**
 * Create the code editor panel with editor and compile button
 */
function createCodeEditorPanel(state: InteractiveSolverState): HTMLElement {
  const panel = document.createElement('div');
  panel.className = `${CSS_CLASS_PREFIX}-code-panel`;

  // Editor container
  const editorContainer = document.createElement('div');
  editorContainer.className = `${CSS_CLASS_PREFIX}-code-editor-container`;
  panel.appendChild(editorContainer);

  // Create editor wrapper for proper sizing
  const editorWrapper = document.createElement('div');
  editorWrapper.className = `${CSS_CLASS_PREFIX}-code-editor`;
  editorContainer.appendChild(editorWrapper);

  // Set editor theme (default: github-light)
  const theme = state.config.codeEditorTheme ?? 'github-light';
  state.codeEditorTheme = theme;

  // Calculate or use configured height
  const editorHeight =
    state.config.codeEditorHeight ?? calculateEditorHeightFromLines(state.currentCode.split('\n').length);
  const heightStr = typeof editorHeight === 'number' ? `${editorHeight}px` : String(editorHeight);
  editorWrapper.style.setProperty('--diffsol-editor-height', heightStr);

  // Initialize Prism code editor
  state.codeEditor = basicEditor(
    editorWrapper,
    {
      value: state.currentCode,
      lineNumbers: true,
      readOnly: state.config.readOnlyCode ?? false,
      wordWrap: true,
      theme: theme,
    }
  ) as any;

  // Store editor reference for theme switching
  (window as any).__diffsol_editor_refs__ = (window as any).__diffsol_editor_refs__ || {};
  (window as any).__diffsol_editor_refs__[state.config.divId] = {
    editor: state.codeEditor,
    container: editorWrapper,
  };

  // Compile button container
  const buttonContainer = document.createElement('div');
  buttonContainer.className = `${CSS_CLASS_PREFIX}-compile-button-container`;
  panel.appendChild(buttonContainer);

  // Create compile button
  state.compileButton = document.createElement('button');
  state.compileButton.className = `${CSS_CLASS_PREFIX}-compile-button`;
  state.compileButton.textContent = 'Compile & Run';
  state.compileButton.title = 'Compile and run the model (or press Ctrl+S)';
  buttonContainer.appendChild(state.compileButton);

  // Create help text
  const helpText = document.createElement('small');
  helpText.className = `${CSS_CLASS_PREFIX}-compile-button-help`;
  helpText.textContent = 'Tip: Press Ctrl+S to compile';
  buttonContainer.appendChild(helpText);

  return panel;
}

/**
 * Rebuild sliders after model recompilation
 * Updates sliders to match new model inputs while preserving user config
 */
function rebuildSliders(
  state: InteractiveSolverState,
  debounceMs: number
): void {
  // Extract new metadata from the compiled ODE
  const modelInputs = state.ode?.inputs ?? [];
  const modelOutputs = state.ode?.outputs ?? [];
  
  console.log(`Rebuilding sliders for ${modelInputs.length} inputs and ${modelOutputs.length} outputs`);
  
  // Re-merge configs with new metadata (preserving user overrides)
  state.sliderConfigs = mergeSliderConfigs(modelInputs, state.config.sliders);
  state.outputConfigs = mergeOutputConfigs(modelOutputs, state.config.outputs);
  state.sliderNames = modelInputs.map(([name]) => name);
  
  // Find the sliders container in the DOM using CSS class
  const slidersPanel = document.querySelector(`.${CSS_CLASS_PREFIX}-sliders-panel`);
  const container = slidersPanel?.querySelector(`.${CSS_CLASS_PREFIX}-sliders`) as HTMLElement;
  
  if (!container) {
    console.error('Could not find sliders container for rebuild');
    return;
  }
  
  // Clear old sliders
  container.innerHTML = '';
  state.sliders = [];
  state.valueDisplays = [];
  state.parameters = new Float64Array(modelInputs.length);
  
  // Create new sliders
  state.sliderNames.forEach((inputName, index) => {
    const sliderConfig = state.sliderConfigs[inputName];
    const sliderGroup = createSliderElement(sliderConfig, inputName, index);
    container.appendChild(sliderGroup.container);
    state.sliders.push(sliderGroup.input);
    state.valueDisplays.push(sliderGroup.display);
    state.parameters[index] = sliderConfig.initial;
  });
  
  // Re-setup slider event listeners
  setupSliderListeners(state, state.sliderConfigs, debounceMs);
}

/**
 * Setup compile button event listener
 */
function setupCompileButtonListener(
  state: InteractiveSolverState,
  finalTime: number,
  numTimePoints: number,
  matrixType: MatrixType,
  linearSolverType: LinearSolverType,
  odeSolverType: OdeSolverType,
  debounceMs: number
): void {
  if (!state.compileButton) return;

  state.compileButton.addEventListener('click', async () => {
    if (state.isCompiling || !state.codeEditor) return;

    try {
      state.isCompiling = true;
      state.compileButton!.textContent = 'Compiling...';
      state.compileButton!.disabled = true;
      state.compileButton!.classList.add('loading');
      showError(state, '');

      // Get code from editor
      state.currentCode = state.codeEditor.value;

      console.log('Recompiling model...');

      // Dispose old ODE if exists
      if (state.ode) {
        state.ode.dispose();
        state.ode = null;
      }

      // Compile new model
      state.ode = await compile(
        state.currentCode,
        state.config.moduleConfig,
        matrixType,
        linearSolverType,
        odeSolverType
      );

      // Rebuild sliders to match new model inputs/outputs
      rebuildSliders(state, debounceMs);

      // Solve with new parameters
      await solveAndPlot(state, finalTime, numTimePoints);

      console.log('Recompilation successful');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      showError(state, `Compilation failed: ${errorMsg}`);
      console.error('Compilation error:', error);
    } finally {
      state.isCompiling = false;
      state.compileButton!.textContent = 'Compile & Run';
      state.compileButton!.disabled = false;
      state.compileButton!.classList.remove('loading');
    }
  });
}

/**
 * Create help button
 */
function createHelpButton(state: InteractiveSolverState): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = `${CSS_CLASS_PREFIX}-help-button`;
  button.textContent = '?';
  button.setAttribute('aria-label', 'Help');
  button.title = 'Help';
  
  // Position based on config
  const position = state.config.helpButtonPosition ?? 'bottom-right';
  button.setAttribute('data-position', position);
  
  state.helpButton = button;
  return button;
}

/**
 * Create help dialog and overlay
 */
function createHelpDialog(state: InteractiveSolverState): void {
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = `${CSS_CLASS_PREFIX}-help-dialog-overlay`;
  overlay.style.display = 'none';
  state.helpOverlay = overlay;

  // Create dialog
  const dialog = document.createElement('div');
  dialog.className = `${CSS_CLASS_PREFIX}-help-dialog`;
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', `${CSS_CLASS_PREFIX}-help-title`);

  // Dialog header
  const header = document.createElement('div');
  header.className = `${CSS_CLASS_PREFIX}-help-dialog-header`;

  const title = document.createElement('h2');
  title.id = `${CSS_CLASS_PREFIX}-help-title`;
  title.textContent = 'Interactive Solver Help';
  header.appendChild(title);

  const closeButton = document.createElement('button');
  closeButton.className = `${CSS_CLASS_PREFIX}-help-dialog-close`;
  closeButton.innerHTML = '&times;';
  closeButton.setAttribute('aria-label', 'Close help');
  header.appendChild(closeButton);

  dialog.appendChild(header);

  // Dialog content
  const content = document.createElement('div');
  content.className = `${CSS_CLASS_PREFIX}-help-dialog-content`;
  
  const helpHTML = state.config.customHelpContent ?? `
    <div class="${CSS_CLASS_PREFIX}-help-section">
      <h3>🎨 Code Editor</h3>
      <p>Edit your DiffSL model code directly in the editor. The code defines your differential equation system with inputs, state variables, and outputs.</p>
    </div>

    <div class="${CSS_CLASS_PREFIX}-help-section">
      <h3>🔧 Compile & Run Button</h3>
      <p>Click this button to recompile your model with any code changes you've made. The solver will automatically run with the current parameter values and update the plot.</p>
    </div>

    <div class="${CSS_CLASS_PREFIX}-help-section">
      <h3>🎚️ Parameter Sliders</h3>
      <p>Use the sliders to adjust input parameters in real-time. The model will automatically re-solve and update the plot as you move the sliders. Each slider shows the current parameter value.</p>
    </div>

    <div class="${CSS_CLASS_PREFIX}-help-section">
      <h3>⚙️ Edit Config</h3>
      <p>Use the gear button to edit slider labels and ranges, and rename outputs. Click Save to apply changes to the sliders and plot.</p>
    </div>

    <div class="${CSS_CLASS_PREFIX}-help-section">
      <h3>📊 Plot</h3>
      <p>The plot shows the solution of your differential equation over time. Hover over the plot to see exact values. You can zoom and pan using the plot controls.</p>
    </div>

    <div class="${CSS_CLASS_PREFIX}-help-section">
      <h3>💡 Tips</h3>
      <ul>
        <li>Changes to sliders update the plot immediately</li>
        <li>After editing code, click "Compile & Run" or press <strong>Ctrl+S</strong> to recompile</li>
        <li>Use the gear button to customize labels and ranges</li>
        <li>Hover over the plot to inspect values and zoom/pan using the controls</li>
        <li>Watch the error box for compilation or runtime issues</li>
      </ul>
    </div>
  `;
  
  content.innerHTML = helpHTML;
  dialog.appendChild(content);

  overlay.appendChild(dialog);
  state.helpDialog = dialog;

  // Append to document body (not to container, to avoid positioning issues)
  document.body.appendChild(overlay);
}

/**
 * Setup help button and dialog event listeners
 */
function setupHelpButtonListener(state: InteractiveSolverState): void {
  if (!state.helpButton || !state.helpOverlay || !state.helpDialog) return;

  const showHelp = () => {
    if (state.helpOverlay && state.helpDialog) {
      state.helpOverlay.style.display = 'flex';
      state.isHelpOpen = true;
      document.body.style.overflow = 'hidden';
      
      // Focus the dialog
      state.helpDialog.focus();
    }
  };

  const hideHelp = () => {
    if (state.helpOverlay) {
      state.helpOverlay.style.display = 'none';
      state.isHelpOpen = false;
      document.body.style.overflow = '';
      
      // Return focus to help button
      state.helpButton?.focus();
    }
  };

  // Help button click
  state.helpButton.addEventListener('click', showHelp);

  // Close button click
  const closeButton = state.helpDialog.querySelector(`.${CSS_CLASS_PREFIX}-help-dialog-close`);
  closeButton?.addEventListener('click', hideHelp);

  // Overlay click (outside dialog)
  state.helpOverlay.addEventListener('click', (e) => {
    if (e.target === state.helpOverlay) {
      hideHelp();
    }
  });

  // ESC key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.isHelpOpen) {
      hideHelp();
    }
  });
}

/**
 * Create edit button
 */
function createEditButton(state: InteractiveSolverState): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = `${CSS_CLASS_PREFIX}-edit-button`;
  button.textContent = '⚙️';
  button.setAttribute('aria-label', 'Edit configurations');
  button.title = 'Edit slider and output configurations';
  
  // Position based on config - same as help button
  const position = state.config.helpButtonPosition ?? 'bottom-right';
  button.setAttribute('data-position', position);
  
  state.editButton = button;
  return button;
}

/**
 * Create edit dialog for slider and output configurations
 */
function createEditDialog(state: InteractiveSolverState): void {
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = `${CSS_CLASS_PREFIX}-edit-dialog-overlay`;
  overlay.style.display = 'none';
  state.editOverlay = overlay;

  // Create dialog
  const dialog = document.createElement('div');
  dialog.className = `${CSS_CLASS_PREFIX}-edit-dialog`;
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', `${CSS_CLASS_PREFIX}-edit-title`);

  // Dialog header
  const header = document.createElement('div');
  header.className = `${CSS_CLASS_PREFIX}-edit-dialog-header`;

  const title = document.createElement('h2');
  title.id = `${CSS_CLASS_PREFIX}-edit-title`;
  title.textContent = 'Configure Sliders & Outputs';
  header.appendChild(title);

  const closeButton = document.createElement('button');
  closeButton.className = `${CSS_CLASS_PREFIX}-edit-dialog-close`;
  closeButton.innerHTML = '&times;';
  closeButton.setAttribute('aria-label', 'Close');
  header.appendChild(closeButton);

  dialog.appendChild(header);

  // Dialog content
  const content = document.createElement('div');
  content.className = `${CSS_CLASS_PREFIX}-edit-dialog-content`;

  dialog.appendChild(content);
  rebuildEditDialogContent(state, content);

  // Dialog footer with buttons
  const footer = document.createElement('div');
  footer.className = `${CSS_CLASS_PREFIX}-edit-dialog-footer`;

  const cancelButton = document.createElement('button');
  cancelButton.className = `${CSS_CLASS_PREFIX}-edit-dialog-cancel`;
  cancelButton.textContent = 'Cancel';
  footer.appendChild(cancelButton);

  const saveButton = document.createElement('button');
  saveButton.className = `${CSS_CLASS_PREFIX}-edit-dialog-save`;
  saveButton.textContent = 'Save';
  footer.appendChild(saveButton);

  dialog.appendChild(footer);

  overlay.appendChild(dialog);
  state.editDialog = dialog;

  // Append to document body
  document.body.appendChild(overlay);
}

/**
 * Rebuild edit dialog content to reflect current inputs and outputs
 */
function rebuildEditDialogContent(
  state: InteractiveSolverState,
  contentEl?: HTMLElement
): void {
  const content =
    contentEl ??
    (state.editDialog?.querySelector(
      `.${CSS_CLASS_PREFIX}-edit-dialog-content`
    ) as HTMLElement | null);

  if (!content) return;

  content.innerHTML = '';

  // Simulation settings section
  const settingsSection = document.createElement('div');
  settingsSection.className = `${CSS_CLASS_PREFIX}-edit-section`;

  const settingsTitle = document.createElement('h3');
  settingsTitle.textContent = 'Simulation Settings';
  settingsSection.appendChild(settingsTitle);

  const settingsTable = document.createElement('table');
  settingsTable.className = `${CSS_CLASS_PREFIX}-edit-table`;

  const settingsBody = document.createElement('tbody');
  const finalTimeRow = document.createElement('tr');
  const currentFinalTime = state.config.finalTime ?? 1.0;
  finalTimeRow.innerHTML = `
    <td class="${CSS_CLASS_PREFIX}-edit-label-cell">Final Time</td>
    <td><input type="number" value="${currentFinalTime}" step="0.1" min="0.001" class="${CSS_CLASS_PREFIX}-edit-final-time" /></td>
  `;
  settingsBody.appendChild(finalTimeRow);
  settingsTable.appendChild(settingsBody);
  settingsSection.appendChild(settingsTable);

  content.appendChild(settingsSection);

  // Sliders section
  const sliderSection = document.createElement('div');
  sliderSection.className = `${CSS_CLASS_PREFIX}-edit-section`;

  const sliderTitle = document.createElement('h3');
  sliderTitle.textContent = 'Sliders';
  sliderSection.appendChild(sliderTitle);

  const sliderTable = document.createElement('table');
  sliderTable.className = `${CSS_CLASS_PREFIX}-edit-table`;

  // Slider table header
  const sliderHeader = document.createElement('thead');
  sliderHeader.innerHTML = `
    <tr>
      <th>Input Name</th>
      <th>Label</th>
      <th>Min</th>
      <th>Max</th>
      <th>Initial</th>
    </tr>
  `;
  sliderTable.appendChild(sliderHeader);

  // Slider table body
  const sliderBody = document.createElement('tbody');
  state.sliderNames.forEach((inputName) => {
    const config = state.sliderConfigs[inputName];
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="${CSS_CLASS_PREFIX}-edit-readonly">${inputName}</td>
      <td><input type="text" value="${config.label}" class="${CSS_CLASS_PREFIX}-edit-label" data-input="${inputName}" /></td>
      <td><input type="number" value="${config.min}" step="0.01" class="${CSS_CLASS_PREFIX}-edit-min" data-input="${inputName}" /></td>
      <td><input type="number" value="${config.max}" step="0.01" class="${CSS_CLASS_PREFIX}-edit-max" data-input="${inputName}" /></td>
      <td><input type="number" value="${config.initial}" step="0.01" class="${CSS_CLASS_PREFIX}-edit-initial" data-input="${inputName}" /></td>
    `;
    sliderBody.appendChild(row);
  });
  sliderTable.appendChild(sliderBody);
  sliderSection.appendChild(sliderTable);

  content.appendChild(sliderSection);

  // Outputs section
  const outputSection = document.createElement('div');
  outputSection.className = `${CSS_CLASS_PREFIX}-edit-section`;

  const outputTitle = document.createElement('h3');
  outputTitle.textContent = 'Outputs';
  outputSection.appendChild(outputTitle);

  const outputTable = document.createElement('table');
  outputTable.className = `${CSS_CLASS_PREFIX}-edit-table`;

  // Output table header
  const outputHeader = document.createElement('thead');
  outputHeader.innerHTML = `
    <tr>
      <th>Output Name</th>
      <th>Label</th>
    </tr>
  `;
  outputTable.appendChild(outputHeader);

  // Output table body
  const outputBody = document.createElement('tbody');
  Object.entries(state.outputConfigs).forEach(([outputName, config]) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="${CSS_CLASS_PREFIX}-edit-readonly">${outputName}</td>
      <td><input type="text" value="${config.label}" class="${CSS_CLASS_PREFIX}-edit-output-label" data-output="${outputName}" /></td>
    `;
    outputBody.appendChild(row);
  });
  outputTable.appendChild(outputBody);
  outputSection.appendChild(outputTable);

  content.appendChild(outputSection);
}

/**
 * Setup edit button and dialog event listeners
 */
function setupEditButtonListener(
  state: InteractiveSolverState,
  debounceMs: number,
  finalTime: number,
  numTimePoints: number
): void {
  if (!state.editButton || !state.editOverlay || !state.editDialog) return;

  const showEdit = () => {
    if (state.editOverlay && state.editDialog) {
      rebuildEditDialogContent(state);
      state.editOverlay.style.display = 'flex';
      state.isEditOpen = true;
      document.body.style.overflow = 'hidden';
      
      // Focus the dialog
      state.editDialog.focus();
    }
  };

  const hideEdit = () => {
    if (state.editOverlay) {
      state.editOverlay.style.display = 'none';
      state.isEditOpen = false;
      document.body.style.overflow = '';
      
      // Return focus to edit button
      state.editButton?.focus();
    }
  };

  const saveEdit = async () => {
    try {
      if (!state.config.sliders) {
        state.config.sliders = {};
      }
      if (!state.config.outputs) {
        state.config.outputs = {};
      }

      // Collect slider config changes
      const sliderInputs = state.editDialog!.querySelectorAll(`.${CSS_CLASS_PREFIX}-edit-label`) as NodeListOf<HTMLInputElement>;
      sliderInputs.forEach((input) => {
        const inputName = input.dataset.input!;
        state.config.sliders![inputName] = {
          ...state.config.sliders![inputName],
          label: input.value,
        };
      });

      const minInputs = state.editDialog!.querySelectorAll(`.${CSS_CLASS_PREFIX}-edit-min`) as NodeListOf<HTMLInputElement>;
      minInputs.forEach((input) => {
        const inputName = input.dataset.input!;
        state.config.sliders![inputName] = {
          ...state.config.sliders![inputName],
          min: parseFloat(input.value),
        };
      });

      const maxInputs = state.editDialog!.querySelectorAll(`.${CSS_CLASS_PREFIX}-edit-max`) as NodeListOf<HTMLInputElement>;
      maxInputs.forEach((input) => {
        const inputName = input.dataset.input!;
        state.config.sliders![inputName] = {
          ...state.config.sliders![inputName],
          max: parseFloat(input.value),
        };
      });

      const initialInputs = state.editDialog!.querySelectorAll(`.${CSS_CLASS_PREFIX}-edit-initial`) as NodeListOf<HTMLInputElement>;
      initialInputs.forEach((input) => {
        const inputName = input.dataset.input!;
        state.config.sliders![inputName] = {
          ...state.config.sliders![inputName],
          initial: parseFloat(input.value),
        };
      });

      // Collect output config changes
      const outputLabelInputs = state.editDialog!.querySelectorAll(`.${CSS_CLASS_PREFIX}-edit-output-label`) as NodeListOf<HTMLInputElement>;
      outputLabelInputs.forEach((input) => {
        const outputName = input.dataset.output!;
        state.config.outputs![outputName] = {
          ...state.config.outputs![outputName],
          label: input.value,
        };
      });

      // Collect simulation settings
      const finalTimeInput = state.editDialog!.querySelector(`.${CSS_CLASS_PREFIX}-edit-final-time`) as HTMLInputElement | null;
      if (finalTimeInput) {
        const newFinalTime = parseFloat(finalTimeInput.value);
        if (!isNaN(newFinalTime) && newFinalTime > 0) {
          state.config.finalTime = newFinalTime;
        }
      }

      // Rebuild sliders with updated configs
      rebuildSliders(state, debounceMs);

      // Solve and plot with updated configs
      await solveAndPlot(state, state.config.finalTime ?? 1.0, state.config.numTimePoints ?? 200);

      hideEdit();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      showError(state, `Configuration error: ${errorMsg}`);
      console.error('Configuration error:', error);
    }
  };

  // Edit button click
  state.editButton.addEventListener('click', showEdit);

  // Close button click
  const closeButton = state.editDialog.querySelector(`.${CSS_CLASS_PREFIX}-edit-dialog-close`);
  closeButton?.addEventListener('click', hideEdit);

  // Cancel button click
  const cancelButton = state.editDialog.querySelector(`.${CSS_CLASS_PREFIX}-edit-dialog-cancel`);
  cancelButton?.addEventListener('click', hideEdit);

  // Save button click
  const saveButton = state.editDialog.querySelector(`.${CSS_CLASS_PREFIX}-edit-dialog-save`);
  saveButton?.addEventListener('click', saveEdit);

  // Overlay click (outside dialog)
  state.editOverlay.addEventListener('click', (e) => {
    if (e.target === state.editOverlay) {
      hideEdit();
    }
  });

  // ESC key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.isEditOpen) {
      hideEdit();
    }
  });
}

/**
 * Show/hide loading indicator
 */
function showLoading(state: InteractiveSolverState, show: boolean): void {
  state.isLoading = show;
  // Could add a loading spinner here if desired
}

/**
 * Display error message in the error div
 */
function showError(state: InteractiveSolverState, message: string): void {
  if (message) {
    state.errorDiv.textContent = message;
    state.errorDiv.style.display = 'block';
    state.plotDiv.style.display = 'none';
  } else {
    state.errorDiv.textContent = '';
    state.errorDiv.style.display = 'none';
    state.plotDiv.style.display = 'block';
  }
}

/**
 * Set the code editor theme for an interactive solver
 * @param divId - The ID of the div containing the interactive solver
 * @param theme - The theme to set
 */
export async function setCodeEditorTheme(divId: string, theme: CodeEditorTheme): Promise<void> {
  const editorRef = (window as any).__diffsol_editor_refs__?.[divId];
  if (!editorRef) {
    console.warn(`Interactive solver with divId "${divId}" not found`);
    return;
  }

  try {
    // Use setOptions to change the theme (it's async as per prism-code-editor docs)
    if (editorRef.editor.setOptions) {
      await editorRef.editor.setOptions({ theme });
    } else {
      // Fallback to update method if setOptions is not available
      editorRef.editor.update({ theme });
    }
  } catch (error) {
    console.error(`Failed to set code editor theme: ${error}`);
  }
}

/**
 * Set the code editor height for an interactive solver
 * @param divId - The ID of the div containing the interactive solver
 * @param height - The height to set (in pixels or CSS string)
 */
export function setCodeEditorHeight(divId: string, height: number | string): void {
  const editorRef = (window as any).__diffsol_editor_refs__?.[divId];
  if (!editorRef) {
    console.warn(`Interactive solver with divId "${divId}" not found`);
    return;
  }

  const heightStr = typeof height === 'number' ? `${height}px` : String(height);
  editorRef.container.style.setProperty('--diffsol-editor-height', heightStr);
}
