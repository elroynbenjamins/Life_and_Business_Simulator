module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  collectCoverageFrom: [
    'src/engine/**/*.{ts,tsx}',
    '!src/engine/**/*.d.ts',
  ],
};
