import { z } from 'zod';

export const VisitDurationSchema = z.object({
  minutes: z.number().nonnegative(),
});

export type VisitDuration = z.infer<typeof VisitDurationSchema>;

export class VisitDurationVO {
  constructor(public readonly minutes: number) {}

  toHours(): number {
    return this.minutes / 60;
  }

  static fromJSON(data: any): VisitDurationVO {
    const parsed = VisitDurationSchema.parse(data);
    return new VisitDurationVO(parsed.minutes);
  }
}
