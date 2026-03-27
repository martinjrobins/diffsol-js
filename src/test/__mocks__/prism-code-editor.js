// Mock for prism-code-editor
const mockEditor = {
  value: '',
  dispose: jest.fn(),
  focus: jest.fn(),
  update: jest.fn(),
};

const createEditor = jest.fn((container, options) => {
  mockEditor.value = options?.value || '';
  return mockEditor;
});

module.exports = {
  createEditor,
  mockEditor,
};
