import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TenantsModule } from '../tenants/tenants.module';
import { AuthController } from './infrastructure/auth.controller';
import { ParticipantTokenService } from './infrastructure/participant-token.service';
import { ParticipantAuthGuard } from './infrastructure/participant-auth.guard';
import { PrismaUsersRepository } from './infrastructure/prisma-users.repository';
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password-hasher';
import { USERS_REPOSITORY } from './application/ports/users-repository.port';
import { PASSWORD_HASHER } from './application/ports/password-hasher.port';
import { RegisterUserUseCase } from './application/use-cases/register-user.use-case';
import { AuthenticateUserUseCase } from './application/use-cases/authenticate-user.use-case';

@Module({
  imports: [
    TenantsModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
          throw new Error('JWT_SECRET is not set');
        }
        return { secret };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    RegisterUserUseCase,
    AuthenticateUserUseCase,
    ParticipantTokenService,
    ParticipantAuthGuard,
    { provide: USERS_REPOSITORY, useClass: PrismaUsersRepository },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
  ],
  exports: [ParticipantAuthGuard, ParticipantTokenService],
})
export class IdentityModule {}
