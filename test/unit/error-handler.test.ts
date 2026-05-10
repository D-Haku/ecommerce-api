import { describe, expect, it } from 'vitest';
import { errorToResponse } from '../../src/api/plugins/errorHandler.js';
import {
  NotFoundError,
  ServiceUnavailableError,
  ValidationError,
} from '../../src/shared/errors.js';

describe('errorToResponse', () => {
  it('maps ValidationError to 400', () => {
    const res = errorToResponse(new ValidationError('bad'));
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'bad' });
    expect(res.contentType).toBe('application/json');
  });

  it('maps NotFoundError to 404', () => {
    const res = errorToResponse(new NotFoundError('missing'));
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'missing' });
  });

  it('maps ServiceUnavailableError to 503', () => {
    const res = errorToResponse(new ServiceUnavailableError('down'));
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ message: 'down' });
  });

  it('maps MySQL connection errors to 503', () => {
    const err = Object.assign(new Error('connect ECONNREFUSED'), {
      code: 'ECONNREFUSED',
    });
    const res = errorToResponse(err);
    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/unreachable/);
  });

  it('maps Fastify validation errors to 400', () => {
    const err = Object.assign(new Error('bad input'), {
      validation: [{ message: 'x' }],
      statusCode: 400,
    });
    const res = errorToResponse(err);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('bad input');
  });

  it('maps anything else to 500 and includes correlationId when provided', () => {
    const res = errorToResponse(new Error('boom'), {
      correlationId: 'abc-123',
    });
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('internal server error');
    expect(res.body.correlationId).toBe('abc-123');
  });

  it('500 body omits correlationId when none provided', () => {
    const res = errorToResponse(new Error('boom'));
    expect(res.status).toBe(500);
    expect(res.body.correlationId).toBeUndefined();
  });
});
