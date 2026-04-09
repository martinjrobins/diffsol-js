module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/test/**',
  ],
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  moduleNameMapper: {
    '^plotly\\.js$': '<rootDir>/src/test/__mocks__/plotly.js.js',
    '^.+\\.wasm$': '<rootDir>/src/test/__mocks__/wasm.js',
    '^prism-code-editor$': '<rootDir>/src/test/__mocks__/prism-code-editor.js',
    '^prism-code-editor/prism/languages/javascript$': '<rootDir>/src/test/__mocks__/prism-code-editor-lang.js',
    '^prism-code-editor/layout\\.css$': '<rootDir>/src/test/__mocks__/prism-code-editor-css.js',
    '^prism-code-editor/themes/github-light\\.css$': '<rootDir>/src/test/__mocks__/prism-code-editor-css.js',
  },
};
