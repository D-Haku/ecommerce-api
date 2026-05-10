// Feature: ecommerce-api, Property 1: Config fail-fast on missing required environment variable
// Validates: Requirements 1.8

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../../src/shared/config.js';

const REQUIRED_KEYS = [
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'ES_NODE',
];

function buildValidEnv(): NodeJS.ProcessEnv {
  return {
    DB_HOST: 'mysql',
    DB_PORT: '3306',
    DB_USER: 'appuser',
    DB_PASSWORD: 'apppw',
    DB_NAME: 'ecommerce',
    ES_NODE: 'http://elasticsearch:9200',
    API_PORT: '3000',
    SOURCE_API_URL: 'https://example.com/products',
    LOG_LEVEL: 'info',
  };
}

describe('Property 1: config fail-fast on missing required variable', () => {
  it('throws an error naming the missing key when it is removed', () => {
    // Baseline sanity: the valid env must parse successfully.
    expect(() => loadConfig(buildValidEnv())).not.toThrow();

    fc.assert(
      fc.property(fc.constantFrom(...REQUIRED_KEYS), (missingKey) => {
        const env = buildValidEnv();
        delete env[missingKey];

        let thrown: unknown = null;
        try {
          loadConfig(env);
        } catch (err) {
          thrown = err;
        }
        expect(thrown).toBeInstanceOf(ConfigError);
        const err = thrown as ConfigError;
        expect(err.message).toContain(missingKey);
        expect(err.missingKey).toBe(missingKey);
      }),
      { numRuns: 100 },
    );
  });
});
