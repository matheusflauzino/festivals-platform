export { createTenantSchema } from './tenant.schema.js';
export type { CreateTenantDto } from './tenant.schema.js';

export { registerParticipantSchema, loginParticipantSchema } from './participant-auth.schema.js';
export type { RegisterParticipantDto, LoginParticipantDto } from './participant-auth.schema.js';

export {
  inviteAdminUserSchema,
  acceptAdminInviteSchema,
  loginAdminUserSchema,
  ADMIN_ROLES,
} from './admin-auth.schema.js';
export type {
  InviteAdminUserDto,
  AcceptAdminInviteDto,
  LoginAdminUserDto,
} from './admin-auth.schema.js';
