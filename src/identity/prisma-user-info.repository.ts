import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { UserInfoRecord, UserInfoRepository } from './user-info.repository';

@Injectable()
export class PrismaUserInfoRepository extends UserInfoRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findByUserId(userId: string): Promise<UserInfoRecord | null> {
    const userInfo = await this.prisma.userInfo.findUnique({
      where: { id_user: userId },
      select: {
        id_user: true,
        id_agente: true,
        id_viajero: true,
        rol: true,
      },
    });

    if (userInfo === null) {
      return null;
    }

    return {
      userId: userInfo.id_user,
      agentId: userInfo.id_agente,
      travelerId: userInfo.id_viajero,
      role: userInfo.rol,
    };
  }
}
