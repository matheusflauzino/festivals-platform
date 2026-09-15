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
import { FindTenantBySlugUseCase } from '../../tenants/application/use-cases/find-tenant-by-slug.use-case';
import { RegisterUserUseCase } from '../application/use-cases/register-user.use-case';
import { AuthenticateUserUseCase } from '../application/use-cases/authenticate-user.use-case';
import type { User } from '../domain/user.entity';
import { ParticipantTokenService } from './participant-token.service';
import { ParticipantAuthGuard } from './participant-auth.guard';
import { USERS_REPOSITORY } from '../application/ports/users-repository.port';
import type { UsersRepositoryPort } from '../application/ports/users-repository.port';

const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

@Controller('tenants/:tenantSlug/auth')
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
    } catch {
      throw new UnauthorizedException('invalid credentials');
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
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    });

    return {
      accessToken,
      user: { id: user.id, name: user.name, email: user.email },
    };
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(
    @Param('tenantSlug') _tenantSlug: string,
    @Body() _body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.doRefresh(response);
  }

  @Get('me')
  @UseGuards(ParticipantAuthGuard)
  async me(@Req() request: Request & { participant?: { id: string } }) {
    const user = await this.usersRepository.findById(request.participant!.id);
    if (!user) throw new NotFoundException();
    return { id: user.id, name: user.name, email: user.email };
  }

  private doRefresh(response: Response) {
    const request = response.req as unknown as {
      cookies?: Record<string, string>;
    };
    const refreshToken = request.cookies?.refreshToken;
    if (!refreshToken) throw new UnauthorizedException();

    try {
      const payload = this.tokenService.verify(refreshToken);
      const accessToken = this.tokenService.signAccessToken({
        sub: payload.sub,
        tenantId: payload.tenantId,
      });
      return { accessToken };
    } catch {
      throw new UnauthorizedException();
    }
  }
}
