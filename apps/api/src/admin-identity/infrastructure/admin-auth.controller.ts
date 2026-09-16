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
  UseInterceptors,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  inviteAdminUserSchema,
  acceptAdminInviteSchema,
  loginAdminUserSchema,
} from '@fenac-platform/contracts';
import type {
  InviteAdminUserDto,
  AcceptAdminInviteDto,
  LoginAdminUserDto,
} from '@fenac-platform/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { AuditLogInterceptor } from '../../common/interceptors/audit-log.interceptor';
import { AdminConflictExceptionFilter } from '../../common/filters/admin-conflict.filter';
import { FindTenantBySlugUseCase } from '../../tenants/application/use-cases/find-tenant-by-slug.use-case';
import { InviteAdminUserUseCase } from '../application/use-cases/invite-admin-user.use-case';
import { AcceptAdminInviteUseCase } from '../application/use-cases/accept-admin-invite.use-case';
import { AuthenticateAdminUserUseCase } from '../application/use-cases/authenticate-admin-user.use-case';
import { AdminTokenService } from './admin-token.service';
import type { AdminUser } from '../domain/admin-user.entity';
import { AdminAuthGuard } from './admin-auth.guard';
import type { RequestWithAdmin } from './admin-auth.guard';
import { ADMIN_USERS_REPOSITORY } from '../application/ports/admin-users-repository.port';
import type { AdminUsersRepositoryPort } from '../application/ports/admin-users-repository.port';
import { InvalidAdminCredentialsError } from '../domain/invalid-admin-credentials.error';

const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

@Controller('tenants/:tenantSlug/admin')
@UseFilters(AdminConflictExceptionFilter)
export class AdminAuthController {
  constructor(
    private readonly findTenantBySlug: FindTenantBySlugUseCase,
    private readonly inviteAdminUser: InviteAdminUserUseCase,
    private readonly acceptAdminInvite: AcceptAdminInviteUseCase,
    private readonly authenticateAdminUser: AuthenticateAdminUserUseCase,
    private readonly tokenService: AdminTokenService,
    @Inject(ADMIN_USERS_REPOSITORY)
    private readonly adminUsersRepository: AdminUsersRepositoryPort,
  ) {}

  @Post('invites')
  @HttpCode(201)
  @UseGuards(AdminAuthGuard, RolesGuard)
  @Roles('ORGANIZER')
  @UseInterceptors(AuditLogInterceptor)
  @AuditLog('invited_admin', (result: unknown) => ({
    targetType: 'AdminUser',
    targetId: (result as { id: string }).id,
  }))
  async invite(
    @Param('tenantSlug') tenantSlug: string,
    @Req() request: RequestWithAdmin,
    @Body(new ZodValidationPipe(inviteAdminUserSchema))
    body: InviteAdminUserDto,
  ) {
    const tenant = await this.findTenantBySlug.execute(tenantSlug);
    if (!tenant) throw new NotFoundException('tenant not found');
    if (tenant.id !== request.admin!.tenantId)
      throw new UnauthorizedException();

    const admin = await this.inviteAdminUser.execute({
      tenantId: tenant.id,
      name: body.name,
      email: body.email,
      role: body.role,
    });

    return {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      status: admin.status,
    };
  }

  @Post('invites/:token/accept')
  @HttpCode(200)
  async acceptInvite(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(acceptAdminInviteSchema))
    body: AcceptAdminInviteDto,
  ) {
    const admin = await this.acceptAdminInvite.execute({
      token,
      password: body.password,
    });
    return {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      status: admin.status,
    };
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Param('tenantSlug') tenantSlug: string,
    @Body(new ZodValidationPipe(loginAdminUserSchema))
    body: LoginAdminUserDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const tenant = await this.findTenantBySlug.execute(tenantSlug);
    if (!tenant) throw new NotFoundException('tenant not found');

    let admin: AdminUser;
    try {
      admin = await this.authenticateAdminUser.execute({
        tenantId: tenant.id,
        email: body.email,
        password: body.password,
      });
    } catch (error) {
      if (error instanceof InvalidAdminCredentialsError) {
        throw new UnauthorizedException('invalid credentials');
      }
      throw error;
    }

    const accessToken = this.tokenService.signAccessToken({
      sub: admin.id,
      tenantId: tenant.id,
      role: admin.role,
    });
    const refreshToken = this.tokenService.signRefreshToken({
      sub: admin.id,
      tenantId: tenant.id,
      role: admin.role,
    });

    response.cookie('adminRefreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: `/tenants/${tenantSlug}/admin`,
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    });

    return {
      accessToken,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Param('tenantSlug') tenantSlug: string,
    @Req() request: Request,
  ) {
    const tenant = await this.findTenantBySlug.execute(tenantSlug);
    if (!tenant) throw new NotFoundException('tenant not found');

    const cookies = request.cookies as Record<string, string> | undefined;
    const refreshToken = cookies?.adminRefreshToken;
    if (!refreshToken) throw new UnauthorizedException();

    try {
      const payload = this.tokenService.verifyRefreshToken(refreshToken);
      if (payload.tenantId !== tenant.id) throw new UnauthorizedException();

      const accessToken = this.tokenService.signAccessToken(payload);
      return { accessToken };
    } catch {
      throw new UnauthorizedException();
    }
  }

  @Get('me')
  @UseGuards(AdminAuthGuard)
  async me(
    @Param('tenantSlug') tenantSlug: string,
    @Req() request: RequestWithAdmin,
  ) {
    const tenant = await this.findTenantBySlug.execute(tenantSlug);
    if (!tenant) throw new NotFoundException('tenant not found');
    if (tenant.id !== request.admin!.tenantId)
      throw new UnauthorizedException();

    const admin = await this.adminUsersRepository.findById(
      tenant.id,
      request.admin!.id,
    );
    if (!admin) throw new NotFoundException();

    return {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
    };
  }
}
