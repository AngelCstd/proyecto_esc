const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;

type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];

export interface EnvironmentConfig {
  NODE_ENV: NodeEnvironment;
  PORT: number;
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

  return {
    NODE_ENV: nodeEnvironment as NodeEnvironment,
    PORT: port,
  };
}
