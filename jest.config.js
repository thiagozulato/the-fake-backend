module.exports = {
  preset: 'ts-jest',
  collectCoverageFrom: ['source/**/*'],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
};
