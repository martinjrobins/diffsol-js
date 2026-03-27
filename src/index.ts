/**
 * Main entry point for @martinjrobins/diffsol-js
 */

export { compile, validateModuleExports, getModuleImports } from './compile';
export type { ModuleConfig } from './compile';

export { Ode, DiffsolError } from './ode';
export type { DiffsolModules } from './ode';
export { Solution } from './solution';
export { InitialConditionOptions } from './initial-condition-options';
export { OdeOptions } from './ode-options';
export { ScalarType } from './scalar-type';
export { MatrixType } from './matrix-type';
export { LinearSolverType } from './linear-solver-type';
export { OdeSolverType } from './ode-solver-type';

export { createInteractiveSolver, setCodeEditorTheme, setCodeEditorHeight } from './interactive-solver';
export type { SliderConfigMap, OutputConfigMap, InteractiveSolverConfig, CodeEditorTheme } from './interactive-solver';
