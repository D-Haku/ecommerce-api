// Typed error classes used across the ingest and api modules.

export class ValidationError extends Error {
  public readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  public readonly status = 404;
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ServiceUnavailableError extends Error {
  public readonly status = 503;
  constructor(message: string) {
    super(message);
    this.name = 'ServiceUnavailableError';
  }
}

export class SourceFetchError extends Error {
  public readonly status: number;
  public readonly skip: number;
  constructor(status: number, skip: number) {
    super(`source fetch failed at skip=${skip} with status=${status}`);
    this.name = 'SourceFetchError';
    this.status = status;
    this.skip = skip;
  }
}
