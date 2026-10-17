import { Global, Module } from '@nestjs/common';
import { AccessService } from '../../modules/access/access.service';
import { AuditService } from '../../modules/audit/audit.service';
import { CryptoService } from './crypto.service';

@Global()
@Module({
  providers: [CryptoService, AuditService, AccessService],
  exports: [CryptoService, AuditService, AccessService],
})
export class SecurityModule {}
