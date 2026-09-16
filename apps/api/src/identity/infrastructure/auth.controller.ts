import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { Request } from 'express';
import {
  registerParticipantSchema,
  loginParticipantSchema,
} from '@fenac-platform/contracts';
import type {
  RegisterParticipantDto,
  LoginParticipantDto,
} from '@fenac-platform/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UserConflictExceptionFilter } from '../../common/filters/user-conflict.filter';
import { FindTenantBySlugUseCase } from '../../tenants/application/use-cases/find-tenant-by-slug.use-case';
import { RegisterUserUseCase } from '../application/use-cases/register-user.use-case';
import { AuthenticateUserUseCase } from '../application/use-cases/authenticate-user.use-case';
import type { User } from '../domain/user.entity';
import { InvalidCredentialsError } from '../domain/invalid-credentials.error';
import { ParticipantTokenService } from './participant-token.service';
import { ParticipantAuthGuard } from './participant-auth.guard';
import { USERS_REPOSITORY } from '../application/ports/users-repository.port';
import type { UsersRepositoryPort } from '../application/ports/users-repository.port';

const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

@Controller('tenants/:tenantSlug/auth')
@UseFilters(UserConflictExceptionFilter)
export class AuthController {
  constructor(
    private readonly findTenantBySlug: FindTenantBySlugUseCase,
    private readonly registerUser: RegisterUserUseCase,
    private readonly authenticateUser: AuthenticateUserUseCase,
    private readonly tokenService: ParticipantTokenService,
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepositoryPort,
  ) {}

  @Post('register')
  @HttpCode(201)
  async register(
    @Param('tenantSlug') tenantSlug: string,
    @Body(new ZodValidationPipe(registerParticipantSchema))
    body: RegisterParticipantDto,
  ) {
    const tenant = await this.findTenantBySlug.execute(tenantSlug);
    if (!tenant) throw new NotFoundException('tenant not found');

    const user = await this.registerUser.execute({
      tenantId: tenant.id,
      name: body.name,
      email: body.email,
      cpf: body.cpf,
      password: body.password,
    });

    return { id: user.id, name: user.name, email: user.email };
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Param('tenantSlug') tenantSlug: string,
    @Body(new ZodValidationPipe(loginParticipantSchema))
    body: LoginParticipantDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const tenant = await this.findTenantBySlug.execute(tenantSlug);
    if (!tenant) throw new NotFoundException('tenant not found');

    let user: User;
    try {
      user = await this.authenticateUser.execute({
        tenantId: tenant.id,
        identifier: body.identifier,
        password: body.password,
      });
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        throw new UnauthorizedException('invalid credentials');
      }
      throw error;
    }

    const accessToken = this.tokenService.signAccessToken({
      sub: user.id,
      tenantId: tenant.id,
    });
    const refreshToken = this.tokenService.signRefreshToken({
      sub: user.id,
      tenantId: tenant.id,
    });

    response.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: `/tenants/${tenantSlug}/auth`,
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    });

    return {
      accessToken,
      user: { id: user.id, name: user.name, email: user.email },
    };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Param('tenantSlug') tenantSlug: string,
    @Body() _body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const tenant = await this.findTenantBySlug.execute(tenantSlug);
    if (!tenant) throw new NotFoundException('tenant not found');

    const request = response.req as unknown as {
      cookies?: Record<string, string>;
    };
    const refreshToken = request.cookies?.refreshToken;
    if (!refreshToken) throw new UnauthorizedException();

    let payload: { sub: string; tenantId: string };
    try {
      payload = this.tokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedException();
    }

    if (payload.tenantId !== tenant.id) throw new UnauthorizedException();

    const accessToken = this.tokenService.signAccessToken({
      sub: payload.sub,
      tenantId: payload.tenantId,
    });
    return { accessToken };
  }

  @Get('me')
  @UseGuards(ParticipantAuthGuard)
  async me(
    @Param('tenantSlug') tenantSlug: string,
    @Req()
    request: Request & { participant?: { id: string; tenantId: string } },
  ) {
    const tenant = await this.findTenantBySlug.execute(tenantSlug);
    if (!tenant) throw new NotFoundException('tenant not found');
    if (tenant.id !== request.participant!.tenantId) {
      throw new UnauthorizedException();
    }

    const user = await this.usersRepository.findById(
      request.participant!.tenantId,
      request.participant!.id,
    );
    if (!user) throw new NotFoundException();
    return { id: user.id, name: user.name, email: user.email };
  }
}
