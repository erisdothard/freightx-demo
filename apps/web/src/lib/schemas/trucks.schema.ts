import { z } from 'zod';

export const PostTruckInputSchema = z.object({
  posted_by: z.string().uuid(),
  company_id: z.string().uuid().nullable().optional(),
  equipment: z.string().min(1),
  origin_city: z.string().min(1),
  origin_state: z.string().length(2),
  available_date: z.string().min(1),
  dest_states: z.array(z.string().length(2)).optional().nullable(),
  notes: z.string().optional().nullable(),
  rate_per_mile: z.number().positive().optional().nullable(),
});

export const TruckFiltersSchema = z.object({
  equipment: z.string().optional(),
  status: z.string().optional(),
  postedBy: z.string().uuid().optional(),
  page: z.number().int().min(0).optional(),
});

export type PostTruckInput = z.infer<typeof PostTruckInputSchema>;
export type TruckFiltersInput = z.infer<typeof TruckFiltersSchema>;
