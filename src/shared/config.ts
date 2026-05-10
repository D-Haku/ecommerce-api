// Fail-fast environment variable parsing via zod.

import { z } from 'zod';

const ConfigSchema = z.object({
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive(),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string().min(1),
  ES_NODE: z.string().min(1),
  API_PORT: z.coerce.number().int().positive().default(3000),
  SOURCE_API_URL: z.string().min(1).default('https://dummyjson.com/products'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
});

export type Config = z.infer<typeof ConfigSchema>;

export class ConfigError extends Error {
  public readonly missingKey: string;
  constructor(missingKey: string, message: string) {
    super(message);
    this.name = 'ConfigError';
    this.missingKey = missingKey;
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const keyPath =
      issue && issue.path.length > 0 ? String(issue.path[0]) : 'unknown';
    const detail = issue ? issue.message : 'invalid configuration';
    throw new ConfigError(
      keyPath,
      `missing or invalid required environment variable: ${keyPath} (${detail})`,
    );
  }
  return parsed.data;
}

// CLI entrypoint: validate the environment and exit non-zero on failure.
const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] !== undefined &&
  import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  try {
    loadConfig();
    process.stdout.write('config ok\n');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}
