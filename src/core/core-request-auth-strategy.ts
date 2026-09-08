import type { RequestAuthStrategy } from '../app-client';

export const CORE_REQUEST_AUTH_STRATEGY = Symbol(
  'CORE_REQUEST_AUTH_STRATEGY',
);

export interface CoreRequestAuthStrategy extends RequestAuthStrategy {}
