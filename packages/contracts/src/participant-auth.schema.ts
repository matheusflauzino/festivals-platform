import { z } from 'zod';

export const registerParticipantSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  cpf: z.string().regex(/^\d{11}$/, 'cpf must be exactly 11 digits'),
  password: z.string().min(8).max(72),
});

export type RegisterParticipantDto = z.infer<typeof registerParticipantSchema>;

export const loginParticipantSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

export type LoginParticipantDto = z.infer<typeof loginParticipantSchema>;
