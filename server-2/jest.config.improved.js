/**
 * Improved Jest Configuration for 100% Test Success
 * Optimized for better test isolation and performance
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Coverage configuration
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/scripts/**',
    '!src/config/**',
    '!src/**/*.old.js'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // Test matching
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.improved.js'],
  
  // Timeout configuration
  testTimeout: 15000, // Increased for database operations
  
  // Verbose output
  verbose: true,
  
  // Run tests in band (sequentially) for better isolation
  maxWorkers: 1,
  
  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Detect open handles
  detectOpenHandles: false,
  forceExit: true,
  
  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  
  // Module paths
  moduleDirectories: ['node_modules', 'src'],
  
  // Transform configuration (if needed for ES modules)
  transform: {},
  
  // Global setup/teardown
  globalSetup: undefined,
  globalTeardown: undefined
};
