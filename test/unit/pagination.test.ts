import { describe, expect, it } from 'vitest';
import { normalizePagination } from '../../src/shared/pagination.js';
import { ValidationError } from '../../src/shared/errors.js';

describe('normalizePagination', () => {
  it('defaults page to 1 and page_size to 20 when absent', () => {
    expect(normalizePagination({})).toEqual({ page: 1, pageSize: 20 });
  });

  it('accepts numeric strings', () => {
    expect(normalizePagination({ page: '2', page_size: '50' })).toEqual({
      page: 2,
      pageSize: 50,
    });
  });

  it('caps page_size at 100', () => {
    expect(normalizePagination({ page: 1, page_size: 500 })).toEqual({
      page: 1,
      pageSize: 100,
    });
  });

  it('rejects zero', () => {
    expect(() => normalizePagination({ page: 0 })).toThrow(ValidationError);
    expect(() => normalizePagination({ page_size: 0 })).toThrow(ValidationError);
  });

  it('rejects negative values', () => {
    expect(() => normalizePagination({ page: -1 })).toThrow(ValidationError);
    expect(() => normalizePagination({ page: '-2' })).toThrow(ValidationError);
  });

  it('rejects non-integer numerics', () => {
    expect(() => normalizePagination({ page: 1.5 })).toThrow(ValidationError);
    expect(() => normalizePagination({ page: '1.5' })).toThrow(ValidationError);
  });

  it('rejects non-numeric strings', () => {
    expect(() => normalizePagination({ page: 'abc' })).toThrow(ValidationError);
    expect(() => normalizePagination({ page_size: 'ten' })).toThrow(
      ValidationError,
    );
  });

  it('treats empty string as default', () => {
    expect(normalizePagination({ page: '', page_size: '' })).toEqual({
      page: 1,
      pageSize: 20,
    });
  });
});
