import { Injectable } from '@nestjs/common';
import type {
  AppClientAuthHeaders,
  AppClientAuthRequest,
} from '../app-client';
import type { CoreRequestAuthStrategy } from './core-request-auth-strategy';

@Injectable()
export class NoopCoreRequestAuthStrategy
  implements CoreRequestAuthStrategy
{
  getHeaders(_request: AppClientAuthRequest): AppClientAuthHeaders {
    return {};
  }
}
