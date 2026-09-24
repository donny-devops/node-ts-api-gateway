/**
 * circuitBreaker.ts — Resilient upstream circuit breaker implementation.
 *
 * Implements the Martin Fowler Circuit Breaker pattern with 3 states:
 *   - CLOSED:    Normal operations; failure count increments on error.
 *   - OPEN:      Threshold reached; fail fast immediately without hitting upstream.
 *   - HALF_OPEN: Cooldown passed; allows probe requests to test upstream health.
 */

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenSuccessThreshold: number;
}

export interface CircuitBreakerStats {
  name: string;
  state: CircuitState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureTime: number | null;
  lastStateChange: number;
}

export class CircuitBreakerOpenError extends Error {
  public readonly upstream: string;
  public readonly resetTimeoutMs: number;

  constructor(upstream: string, resetTimeoutMs: number) {
    super(`Circuit breaker is OPEN for upstream: ${upstream}. Requests fail-fast.`);
    this.name = 'CircuitBreakerOpenError';
    this.upstream = upstream;
    this.resetTimeoutMs = resetTimeoutMs;
  }
}

export class CircuitBreaker {
  public readonly name: string;
  public readonly options: CircuitBreakerOptions;

  private state: CircuitState = CircuitState.CLOSED;
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private lastFailureTime: number | null = null;
  private lastStateChange: number = Date.now();

  constructor(name: string, options?: Partial<CircuitBreakerOptions>) {
    this.name = name;
    this.options = {
      failureThreshold: options?.failureThreshold ?? 5,
      resetTimeoutMs: options?.resetTimeoutMs ?? 10_000,
      halfOpenSuccessThreshold: options?.halfOpenSuccessThreshold ?? 2,
    };
  }

  public getState(): CircuitState {
    if (this.state === CircuitState.OPEN && this.lastFailureTime) {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.options.resetTimeoutMs) {
        this.transitionTo(CircuitState.HALF_OPEN);
      }
    }
    return this.state;
  }

  public canExecute(): boolean {
    const currentState = this.getState();
    return currentState === CircuitState.CLOSED || currentState === CircuitState.HALF_OPEN;
  }

  public recordSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.consecutiveSuccesses++;
      if (this.consecutiveSuccesses >= this.options.halfOpenSuccessThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    } else if (this.state === CircuitState.CLOSED) {
      this.consecutiveFailures = 0;
    }
  }

  public recordFailure(): void {
    this.lastFailureTime = Date.now();
    this.consecutiveFailures++;

    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.OPEN);
    } else if (this.state === CircuitState.CLOSED && this.consecutiveFailures >= this.options.failureThreshold) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      throw new CircuitBreakerOpenError(this.name, this.options.resetTimeoutMs);
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (err) {
      this.recordFailure();
      throw err;
    }
  }

  public reset(): void {
    this.transitionTo(CircuitState.CLOSED);
  }

  private transitionTo(newState: CircuitState): void {
    this.state = newState;
    this.lastStateChange = Date.now();

    if (newState === CircuitState.CLOSED) {
      this.consecutiveFailures = 0;
      this.consecutiveSuccesses = 0;
      this.lastFailureTime = null;
    } else if (newState === CircuitState.HALF_OPEN) {
      this.consecutiveSuccesses = 0;
    }
  }

  public getStats(): CircuitBreakerStats {
    return {
      name: this.name,
      state: this.getState(),
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      lastFailureTime: this.lastFailureTime,
      lastStateChange: this.lastStateChange,
    };
  }
}

export class CircuitBreakerRegistry {
  private static breakers = new Map<string, CircuitBreaker>();

  public static getBreaker(name: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
    let breaker = this.breakers.get(name);
    if (!breaker) {
      breaker = new CircuitBreaker(name, options);
      this.breakers.set(name, breaker);
    }
    return breaker;
  }

  public static getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    for (const [name, breaker] of this.breakers.entries()) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  public static clear(): void {
    this.breakers.clear();
  }
}
