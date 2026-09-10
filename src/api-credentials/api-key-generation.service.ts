import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';

import type {
  ApiKeyEnvironment,
  GeneratedApiKey,
} from './api-key-generation.contracts';

const RANDOM_SECRET_BYTES = 32;
const DISPLAY_SECRET_CHARACTERS = 8;

const KEY_PREFIXES: Readonly<Record<ApiKeyEnvironment, string>> = {
  test: 'nok_test_',
  live: 'nok_live_',
};

@Injectable()
export class ApiKeyGenerationService {
  generate(environment: ApiKeyEnvironment): GeneratedApiKey {
    const keyPrefix = KEY_PREFIXES[environment];
    if (keyPrefix === undefined) {
      throw new TypeError('Unsupported API key environment.');
    }

    const secret = randomBytes(RANDOM_SECRET_BYTES).toString('base64url');
    const rawKey = `${keyPrefix}${secret}`;

    return {
      rawKey,
      environment,
      keyHash: createHash('sha256').update(rawKey, 'utf8').digest('hex'),
      keyPrefix: `${keyPrefix}${secret.slice(0, DISPLAY_SECRET_CHARACTERS)}`,
    };
  }
}
