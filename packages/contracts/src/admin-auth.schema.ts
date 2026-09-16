import { z } from 'zod';

export const ADMIN_ROLES = ['ORGANIZER', 'JUDGE', 'COMMITTEE'] as const;

export const inviteAdminUserSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  role: z.enum(ADMIN_ROLES),
});

export type InviteAdminUserDto = z.infer<typeof inviteAdminUserSchema>;

export const acceptAdminInviteSchema = z.object({
  password: z.string().min(8).max(72),
});

export type AcceptAdminInviteDto = z.infer<typeof acceptAdminInviteSchema>;

export const loginAdminUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginAdminUserDto = z.infer<typeof loginAdminUserSchema>;
