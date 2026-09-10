import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { HumanAuthenticationService } from './human-authentication.service';
import { HumanPrincipalRequest } from './human-principal.request';

const AUTHENTICATION_FAILURE = {
  error: {
    code: 'INVALID_ACCESS_TOKEN',
    message: 'Invalid or missing access token',
  },
} as const;

@Injectable()
export class HumanAuthGuard implements CanActivate {
  constructor(private readonly humanAuthentication: HumanAuthenticationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<HumanPrincipalRequest>();
    const accessToken = this.extractBearerToken(request.headers.authorization);

    request.principal = await this.humanAuthentication.authenticate(accessToken);

    return true;
  }

  private extractBearerToken(header: string | string[] | undefined): string {
    if (typeof header !== 'string') {
      throw this.authenticationFailure();
    }

    const match = /^Bearer[ \t]+([^\s]+)$/i.exec(header);

    if (match === null) {
      throw this.authenticationFailure();
    }

    return match[1];
  }

  private authenticationFailure(): UnauthorizedException {
    return new UnauthorizedException(AUTHENTICATION_FAILURE);
  }
}
