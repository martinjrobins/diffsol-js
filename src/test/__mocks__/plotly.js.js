/**
 * Mock Plotly.js for tests
 * Prevents Node.js module resolution errors in jsdom test environment
 */
module.exports = {
  react: jest.fn().mockResolvedValue(undefined),
  newPlot: jest.fn().mockResolvedValue(undefined),
};
