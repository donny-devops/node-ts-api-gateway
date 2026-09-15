/**
 * Guards the Fastify major that in-repo plugins declare (`fastify: '4.x'`).
 * Dependabot #31 bumped Fastify 5 while those plugins still required 4.x,
 * so `app.register()` threw before the gateway could listen.
 */

import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import requestContextPlugin from '../src/plugins/requestContext.js';

const require = createRequire(import.meta.url);

describe('Fastify plugin compatibility', () => {
  it('installs Fastify 4.x to match in-repo fastify-plugin constraints', () => {
    const version = require('fastify/package.json').version as string;
    expect(version.startsWith('4.')).toBe(true);
  });

  it('registers the request-context plugin on the installed Fastify', async () => {
    const app = Fastify({ logger: false });
    await expect(app.register(requestContextPlugin)).resolves.toBeDefined();
    await app.close();
  });
});
