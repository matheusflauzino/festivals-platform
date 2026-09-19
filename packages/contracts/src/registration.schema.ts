import { z } from 'zod';

export const createRegistrationSchema = z.object({
  participantName: z.string().trim().min(1).max(255),
  participantEmail: z.string().email().max(255),
  participantCpf: z.string().regex(/^\d{11}$/, 'cpf must be exactly 11 digits'),
  songName: z.string().trim().min(1).max(255),
  performers: z.string().trim().min(1).max(2000),
  musicComposer: z.string().trim().max(255).nullable().optional(),
  lyricsComposer: z.string().trim().max(255).nullable().optional(),
  videoUrl: z.string().url().max(2048).nullable().optional(),
});

export type CreateRegistrationDto = z.infer<typeof createRegistrationSchema>;
