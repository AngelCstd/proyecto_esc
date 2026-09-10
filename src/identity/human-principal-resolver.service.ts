import { Injectable, UnauthorizedException } from '@nestjs/common';

import { TrustedHumanIdentity } from './human-identity-verifier';
import { Principal } from './principal';
import { UserInfoRecord, UserInfoRepository } from './user-info.repository';

type HumanRole = 'administrador' | 'reservante' | 'viajero';

interface HumanClassification {
  type: 'agent_user' | 'traveler_user';
  role: HumanRole;
}

const AUTHENTICATION_FAILURE = {
  error: {
    code: 'AUTHENTICATION_FAILED',
    message: 'Authentication failed',
  },
} as const;

@Injectable()
export class HumanPrincipalResolver {
  constructor(private readonly userInfoRepository: UserInfoRepository) {}

  async resolve(identity: TrustedHumanIdentity): Promise<Principal> {
    const userInfo = await this.userInfoRepository.findByUserId(identity.userId);

    if (userInfo === null) {
      throw this.authenticationFailure();
    }

    const classification = this.classify(userInfo.role);

    if (classification === null) {
      throw this.authenticationFailure();
    }

    return this.buildPrincipal(identity, userInfo, classification);
  }

  private classify(role: string | null): HumanClassification | null {
    switch (role) {
      case 'administrador':
      case 'reservante':
        return { type: 'agent_user', role };
      case 'viajero':
        return { type: 'traveler_user', role };
      default:
        return null;
    }
  }

  private buildPrincipal(
    identity: TrustedHumanIdentity,
    userInfo: UserInfoRecord,
    classification: HumanClassification,
  ): Principal {
    return {
      type: classification.type,
      userId: identity.userId,
      ...(userInfo.agentId !== null ? { agentId: userInfo.agentId } : {}),
      ...(userInfo.travelerId !== null
        ? { travelerId: userInfo.travelerId }
        : {}),
      roles: [classification.role],
      scopes: [],
    };
  }

  private authenticationFailure(): UnauthorizedException {
    return new UnauthorizedException(AUTHENTICATION_FAILURE);
  }
}
