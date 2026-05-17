import { describe, expect, it } from 'vitest';

import { isPublicPath } from '../src/middleware/auth.js';

describe('isPublicPath', () => {
  it('allows configured health endpoints', () => {
    expect(isPublicPath('/health')).toBe(true);
    expect(isPublicPath('/metrics')).toBe(true);
  });

  it('rejects protected routes', () => {
    expect(isPublicPath('/api/users')).toBe(false);
  });

  it('ignores query strings', () => {
    expect(isPublicPath('/health?full=true')).toBe(true);
  });
});
