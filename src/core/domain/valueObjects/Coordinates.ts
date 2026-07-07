import { z } from 'zod';

export const CoordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitude: z.number().optional(),
});

export type Coordinates = z.infer<typeof CoordinatesSchema>;

export class CoordinatesVO {
  constructor(
    public readonly latitude: number,
    public readonly longitude: number,
    public readonly altitude?: number
  ) {}

  static fromJSON(data: any): CoordinatesVO {
    const parsed = CoordinatesSchema.parse(data);
    return new CoordinatesVO(parsed.latitude, parsed.longitude, parsed.altitude);
  }
}
