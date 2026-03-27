import '@testing-library/jest-dom';

// Polyfill fetch for jsdom test environment if not already available
if (typeof global.fetch === 'undefined') {
  // Use node-fetch as a polyfill
  const fetch = require('node-fetch');
  global.fetch = fetch as any;
}

// Polyfill TextEncoder and TextDecoder for jsdom test environment
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder as any;
  global.TextDecoder = TextDecoder as any;
}


