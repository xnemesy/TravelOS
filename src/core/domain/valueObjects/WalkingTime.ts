import { z } from 'zod';

export const WalkingTimeSchema = z.object({
  minutes: z.number().nonnegative(),
});

export type WalkingTime = z.infer<typeof WalkingTimeSchema>;

export class WalkingTimeVO {
  constructor(public readonly minutes: number) {}

  toSeconds(): number {
    return this.minutes * 60;
  }

  static fromJSON(data: any): WalkingTimeVO {
    const parsed = WalkingTimeSchema.parse(data);
    return new WalkingTimeVO(parsed.minutes);
  }
}
