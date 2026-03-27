// Mock for prism-code-editor/setups
const mockEditor = {
  value: '',
  dispose: jest.fn(),
  focus: jest.fn(),
  update: jest.fn(),
};

const basicEditor = jest.fn((container, options) => {
  mockEditor.value = options?.value || '';
  return mockEditor;
});

module.exports = {
  basicEditor,
  mockEditor,
};
