import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { PrismaSecurityAuditRepository } from './prisma-security-audit.repository';
import { SecurityAuditRecordingService } from './security-audit-recording.service';
import { SecurityAuditRepository } from './security-audit.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    PrismaSecurityAuditRepository,
    {
      provide: SecurityAuditRepository,
      useExisting: PrismaSecurityAuditRepository,
    },
    SecurityAuditRecordingService,
  ],
  exports: [SecurityAuditRecordingService],
})
export class SecurityAuditModule {}
