import { z } from 'zod';

export const RatingSchema = z.object({
  score: z.number().min(0).max(5),
  reviewCount: z.number().nonnegative(),
});

export type Rating = z.infer<typeof RatingSchema>;

export class RatingVO {
  constructor(
    public readonly score: number,
    public readonly reviewCount: number = 0
  ) {}

  static fromJSON(data: any): RatingVO {
    const parsed = RatingSchema.parse(data);
    return new RatingVO(parsed.score, parsed.reviewCount);
  }
}
