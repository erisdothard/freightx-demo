import { z } from 'zod';

export const LoadFiltersSchema = z.object({
  equipment: z
    .enum([
      'van',
      'reefer',
      'flatbed',
      'step_deck',
      'lowboy',
      'tanker',
      'box_truck',
      'sprinter',
      'all',
    ])
    .optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  postedBy: z.string().optional(),
  originState: z.string().length(2).optional(),
  destState: z.string().length(2).optional(),
  minRatePerMile: z.number().positive().optional(),
  page: z.number().int().min(0).optional(),
});

export const CreateLoadInputSchema = z.object({
  posted_by: z.string().min(1),
  company_id: z.string().nullable().optional(),
  equipment: z.string().min(1),
  origin_city: z.string().min(1),
  origin_state: z.string().length(2),
  dest_city: z.string().min(1),
  dest_state: z.string().length(2),
  rate_usd: z.number().positive(),
  pickup_date: z.string().min(1),
  commodity: z.string().optional().nullable(),
  weight_lbs: z.number().positive().optional().nullable(),
  total_miles: z.number().positive().optional().nullable(),
  assignee_id: z.string().uuid().optional().nullable(),
  freight_class: z
    .enum([
      '50',
      '55',
      '60',
      '65',
      '70',
      '77.5',
      '85',
      '92.5',
      '100',
      '110',
      '125',
      '150',
      '175',
      '200',
      '250',
      '300',
      '400',
      '500',
    ])
    .nullable()
    .optional(),
  packaging_type: z
    .enum(['pallets', 'crates', 'boxes', 'drums', 'bags', 'rolls', 'loose', 'other'])
    .nullable()
    .optional(),
  po_number: z.string().max(50).nullable().optional(),
  shipper_reference: z.string().max(100).nullable().optional(),
});

export type LoadFiltersInput = z.infer<typeof LoadFiltersSchema>;
export type CreateLoadInput = z.infer<typeof CreateLoadInputSchema>;
