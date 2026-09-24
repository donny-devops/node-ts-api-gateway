import { describe, it, expect, beforeEach } from 'vitest';
import {
  CircuitBreaker,
  CircuitBreakerOpenError,
  CircuitBreakerRegistry,
  CircuitState,
} from '../src/services/circuitBreaker.js';

describe('CircuitBreaker Unit Tests', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker('test-service', {
      failureThreshold: 3,
      resetTimeoutMs: 50, // Short timeout for test speed
      halfOpenSuccessThreshold: 2,
    });
  });

  it('starts in CLOSED state and allows requests', () => {
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
    expect(breaker.canExecute()).toBe(true);
  });

  it('remains CLOSED when failures are below threshold', () => {
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
    expect(breaker.getStats().consecutiveFailures).toBe(2);
  });

  it('trips to OPEN state when failure threshold is reached', () => {
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();

    expect(breaker.getState()).toBe(CircuitState.OPEN);
    expect(breaker.canExecute()).toBe(false);
  });

  it('throws CircuitBreakerOpenError when execute is called in OPEN state', async () => {
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();

    await expect(breaker.execute(async () => 'ok')).rejects.toThrow(CircuitBreakerOpenError);
  });

  it('transitions from OPEN to HALF_OPEN after cooldown period', async () => {
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.getState()).toBe(CircuitState.OPEN);

    // Wait for resetTimeoutMs
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);
    expect(breaker.canExecute()).toBe(true);
  });

  it('transitions back to OPEN if a request fails while in HALF_OPEN', async () => {
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

    breaker.recordFailure();
    expect(breaker.getState()).toBe(CircuitState.OPEN);
  });

  it('recovers to CLOSED after consecutive successes in HALF_OPEN', async () => {
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

    breaker.recordSuccess();
    expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

    breaker.recordSuccess();
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
    expect(breaker.canExecute()).toBe(true);
  });

  it('resets consecutive failures when a success occurs in CLOSED state', () => {
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.getStats().consecutiveFailures).toBe(2);

    breaker.recordSuccess();
    expect(breaker.getStats().consecutiveFailures).toBe(0);
  });
});

describe('CircuitBreakerRegistry', () => {
  beforeEach(() => {
    CircuitBreakerRegistry.clear();
  });

  it('returns singleton breaker for the same upstream', () => {
    const b1 = CircuitBreakerRegistry.getBreaker('http://payment-service:8080');
    const b2 = CircuitBreakerRegistry.getBreaker('http://payment-service:8080');
    expect(b1).toBe(b2);
  });

  it('collects stats across all registered breakers', () => {
    const b1 = CircuitBreakerRegistry.getBreaker('service-a');
    const b2 = CircuitBreakerRegistry.getBreaker('service-b');
    b2.recordFailure();

    const allStats = CircuitBreakerRegistry.getAllStats();
    expect(allStats['service-a']).toBeDefined();
    expect(allStats['service-b']).toBeDefined();
    expect(allStats['service-b'].consecutiveFailures).toBe(1);
  });
});
