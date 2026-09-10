import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { HumanPrincipalRequest } from './human-principal.request';
import { Principal } from './principal';

export const CurrentHumanPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Principal | undefined =>
    context.switchToHttp().getRequest<HumanPrincipalRequest>().principal,
);
