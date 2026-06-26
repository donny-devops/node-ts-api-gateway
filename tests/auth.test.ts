import { describe, expect, it } from 'vitest';

import { config } from '../config/gateway.js';
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

  it('matches wildcard public paths', () => {
    const publicPaths = config.jwt.publicPaths as unknown as string[];
    const original = [...publicPaths];
    publicPaths.push('/docs/*');

    expect(isPublicPath('/docs/api')).toBe(true);
    expect(isPublicPath('/docs-private/api')).toBe(false);

    publicPaths.splice(0, publicPaths.length, ...original);
  });
});
