module.exports = {
  preset: 'jest-expo',
  setupFiles: ['./jest.setup.js'],
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  collectCoverageFrom: [
    'src/engine/**/*.{ts,tsx}',
    '!src/engine/**/*.d.ts',
  ],
};
