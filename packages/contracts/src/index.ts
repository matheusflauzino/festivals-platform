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

export {
  createFestivalSchema,
  updateFestivalSchema,
  createStageSchema,
  createGradeCriterionSchema,
  BRAZILIAN_STATES,
} from './festival.schema.js';
export type {
  CreateFestivalDto,
  UpdateFestivalDto,
  CreateStageDto,
  CreateGradeCriterionDto,
} from './festival.schema.js';

export { createRegistrationSchema } from './registration.schema.js';
export type { CreateRegistrationDto } from './registration.schema.js';
