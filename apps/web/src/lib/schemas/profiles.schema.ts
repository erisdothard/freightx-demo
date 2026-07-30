import { z } from 'zod';

export const UpdateProfileInputSchema = z.object({
  full_name: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  avatar_url: z.string().nullish(),
  notification_preferences: z.record(z.string(), z.unknown()).optional().nullable(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileInputSchema>;
