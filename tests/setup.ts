// Global test setup configuration
import { performance } from 'perf_hooks';

// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.CLIENT_ID = 'test-client';
process.env.CLIENT_SECRET = 'test-secret-key';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.JWT_EXPIRES_IN = '24h';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.OPENAI_MODEL = 'gpt-4';
process.env.OPENAI_MAX_TOKENS = '500';
process.env.OPENAI_TEMPERATURE = '0.1';

// Circuit breaker test configuration
process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD = '3';
process.env.CIRCUIT_BREAKER_TIMEOUT = '5000';
process.env.CIRCUIT_BREAKER_RESET_TIMEOUT = '10000';

// Retry configuration for tests
process.env.RETRY_MAX_ATTEMPTS = '2';
process.env.RETRY_BASE_DELAY = '100';

// Rate limiting configuration for tests
process.env.RATE_LIMIT_WINDOW_MS = '60000';
process.env.RATE_LIMIT_MAX_REQUESTS = '1000';

// Test timeout configuration
jest.setTimeout(30000); // 30 seconds for integration tests

// Global test hooks
beforeAll(() => {
  console.log('🧪 Starting test suite...');
});

afterAll(() => {
  console.log('✅ Test suite completed');
});

// Performance monitoring for slow tests
const slowTestThreshold = 5000; // 5 seconds

beforeEach(() => {
  (global as any).testStartTime = performance.now();
});

afterEach(() => {
  const testEndTime = performance.now();
  const testDuration = testEndTime - (global as any).testStartTime;
  
  if (testDuration > slowTestThreshold) {
    console.warn(
      `⚠️  Slow test detected: ${expect.getState().currentTestName} took ${testDuration.toFixed(2)}ms`
    );
  }
});

// Mock console methods to reduce noise during tests (optional)
const originalConsole = { ...console };

// Suppress console logs during tests unless LOG_LEVEL is debug
if (process.env.LOG_LEVEL !== 'debug') {
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
}

// Restore console for specific test debugging
(global as any).restoreConsole = () => {
  console.log = originalConsole.log;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
};

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process during tests
});

// Memory leak detection
const initialMemoryUsage = process.memoryUsage();
const memoryLeakThreshold = 100 * 1024 * 1024; // 100MB

afterAll(() => {
  const finalMemoryUsage = process.memoryUsage();
  const heapIncrease = finalMemoryUsage.heapUsed - initialMemoryUsage.heapUsed;
  
  if (heapIncrease > memoryLeakThreshold) {
    console.warn(
      `⚠️  Potential memory leak detected: heap increased by ${(heapIncrease / 1024 / 1024).toFixed(2)}MB`
    );
  }
});

export {};
