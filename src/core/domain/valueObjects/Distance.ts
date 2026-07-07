import { z } from 'zod';

export const DistanceSchema = z.object({
  value: z.number().nonnegative(),
  unit: z.enum(['meters', 'kilometers']),
});

export type Distance = z.infer<typeof DistanceSchema>;

export class DistanceVO {
  constructor(
    public readonly value: number,
    public readonly unit: 'meters' | 'kilometers' = 'meters'
  ) {}

  toMeters(): number {
    return this.unit === 'kilometers' ? this.value * 1000 : this.value;
  }

  toKilometers(): number {
    return this.unit === 'meters' ? this.value / 1000 : this.value;
  }

  static fromJSON(data: any): DistanceVO {
    const parsed = DistanceSchema.parse(data);
    return new DistanceVO(parsed.value, parsed.unit);
  }
}
