import { ConfigService } from '@nestjs/config';

import { EnvironmentConfig } from '../config/environment.validation';

export const SUPABASE_CLIENT = Symbol('SUPABASE_CLIENT');

export interface SupabaseVerificationClient {
  auth: {
    getUser(accessToken: string): Promise<{
      data: { user: { id: string } | null };
      error: unknown;
    }>;
  };
}

type CreateClient = (
  url: string,
  key: string,
  options: {
    auth: {
      persistSession: false;
      autoRefreshToken: false;
      detectSessionInUrl: false;
    };
  },
) => SupabaseVerificationClient;

export function createSupabaseClient(
  configService: ConfigService<EnvironmentConfig, true>,
): SupabaseVerificationClient {
  const { createClient } = require('@supabase/supabase-js') as {
    createClient: CreateClient;
  };

  return createClient(
    configService.get('SUPABASE_URL', { infer: true }),
    configService.get('SUPABASE_ANON_KEY', { infer: true }),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
