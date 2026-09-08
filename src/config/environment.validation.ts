const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;

type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];

export interface EnvironmentConfig {
  NODE_ENV: NodeEnvironment;
  PORT: number;
  DATABASE_URL: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  CORE_BASE_URL: string;
  CORE_REQUEST_TIMEOUT_MS: number;
}

function requireNonEmptyString(
  environment: Record<string, unknown>,
  name: string,
): string {
  const value = environment[name];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid application configuration: ${name} is required`);
  }

  return value.trim();
}

export function validateEnvironment(
  environment: Record<string, unknown>,
): EnvironmentConfig {
  const nodeEnvironment = environment.NODE_ENV ?? 'development';

  if (
    typeof nodeEnvironment !== 'string' ||
    !NODE_ENVIRONMENTS.some((value) => value === nodeEnvironment)
  ) {
    throw new Error('Invalid application configuration: unsupported NODE_ENV');
  }

  const rawPort = environment.PORT ?? '3000';
  const port =
    typeof rawPort === 'number'
      ? rawPort
      : typeof rawPort === 'string' && /^\d+$/.test(rawPort)
        ? Number(rawPort)
        : Number.NaN;

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('Invalid application configuration: PORT must be valid');
  }

  const supabaseUrl = requireNonEmptyString(environment, 'SUPABASE_URL');
  const databaseUrl = requireNonEmptyString(environment, 'DATABASE_URL');
  const supabaseAnonKey = requireNonEmptyString(
    environment,
    'SUPABASE_ANON_KEY',
  );
  const coreBaseUrl = requireNonEmptyString(environment, 'CORE_BASE_URL');
  const rawCoreRequestTimeout = environment.CORE_REQUEST_TIMEOUT_MS;
  const coreRequestTimeoutMs =
    typeof rawCoreRequestTimeout === 'number'
      ? rawCoreRequestTimeout
      : typeof rawCoreRequestTimeout === 'string' &&
          /^\d+$/.test(rawCoreRequestTimeout)
        ? Number(rawCoreRequestTimeout)
        : Number.NaN;

  if (!Number.isInteger(coreRequestTimeoutMs) || coreRequestTimeoutMs <= 0) {
    throw new Error(
      'Invalid application configuration: CORE_REQUEST_TIMEOUT_MS must be a positive integer',
    );
  }

  let parsedSupabaseUrl: URL;
  try {
    parsedSupabaseUrl = new URL(supabaseUrl);
  } catch {
    throw new Error(
      'Invalid application configuration: SUPABASE_URL must be a valid URL',
    );
  }

  if (!['http:', 'https:'].includes(parsedSupabaseUrl.protocol)) {
    throw new Error(
      'Invalid application configuration: SUPABASE_URL must use HTTP or HTTPS',
    );
  }

  let parsedCoreBaseUrl: URL;
  try {
    parsedCoreBaseUrl = new URL(coreBaseUrl);
  } catch {
    throw new Error(
      'Invalid application configuration: CORE_BASE_URL must be a valid URL',
    );
  }

  if (!['http:', 'https:'].includes(parsedCoreBaseUrl.protocol)) {
    throw new Error(
      'Invalid application configuration: CORE_BASE_URL must use HTTP or HTTPS',
    );
  }

  return {
    NODE_ENV: nodeEnvironment as NodeEnvironment,
    PORT: port,
    DATABASE_URL: databaseUrl,
    SUPABASE_URL: supabaseUrl,
    SUPABASE_ANON_KEY: supabaseAnonKey,
    CORE_BASE_URL: parsedCoreBaseUrl.toString(),
    CORE_REQUEST_TIMEOUT_MS: coreRequestTimeoutMs,
  };
}
