import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TenantsModule } from '../tenants/tenants.module';
import { AdminAuthController } from './infrastructure/admin-auth.controller';
import { AdminTokenService } from './infrastructure/admin-token.service';
import { AdminAuthGuard } from './infrastructure/admin-auth.guard';
import { PrismaAdminUsersRepository } from './infrastructure/prisma-admin-users.repository';
import { ADMIN_USERS_REPOSITORY } from './application/ports/admin-users-repository.port';
import { InviteAdminUserUseCase } from './application/use-cases/invite-admin-user.use-case';
import { AcceptAdminInviteUseCase } from './application/use-cases/accept-admin-invite.use-case';
import { AuthenticateAdminUserUseCase } from './application/use-cases/authenticate-admin-user.use-case';
import { BcryptPasswordHasher } from '../identity/infrastructure/bcrypt-password-hasher';
import { PASSWORD_HASHER } from '../identity/application/ports/password-hasher.port';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuditLogInterceptor } from '../common/interceptors/audit-log.interceptor';

@Module({
  imports: [
    TenantsModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.ADMIN_JWT_SECRET;
        if (!secret) {
          throw new Error('ADMIN_JWT_SECRET is not set');
        }
        return { secret };
      },
    }),
  ],
  controllers: [AdminAuthController],
  providers: [
    InviteAdminUserUseCase,
    AcceptAdminInviteUseCase,
    AuthenticateAdminUserUseCase,
    AdminTokenService,
    AdminAuthGuard,
    RolesGuard,
    AuditLogInterceptor,
    { provide: ADMIN_USERS_REPOSITORY, useClass: PrismaAdminUsersRepository },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
  ],
  exports: [AdminAuthGuard, AdminTokenService],
})
export class AdminIdentityModule {}
