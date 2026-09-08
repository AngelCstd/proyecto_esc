import { Injectable } from '@nestjs/common';

import {
  AppClient,
  type AppClientRequest,
  type AppClientResponse,
} from '../app-client';

@Injectable()
export class CoreClient {
  constructor(private readonly appClient: AppClient) {}

  request<TBody = unknown>(
    request: AppClientRequest,
  ): Promise<AppClientResponse<TBody>> {
    return this.appClient.request<TBody>(request);
  }
}
