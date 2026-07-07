import { z } from 'zod';

export const MoneySchema = z.object({
  amount: z.number().nonnegative(),
  currency: z.string().length(3), // ISO 4217 code (e.g. USD, EUR)
});

export type Money = z.infer<typeof MoneySchema>;

export class MoneyVO {
  constructor(
    public readonly amount: number,
    public readonly currency: string = 'EUR'
  ) {}

  static fromJSON(data: any): MoneyVO {
    const parsed = MoneySchema.parse(data);
    return new MoneyVO(parsed.amount, parsed.currency);
  }
}
