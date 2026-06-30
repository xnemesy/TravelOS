import { z } from 'zod';

export const BudgetCategorySchema = z.enum([
  'accommodation',
  'transport',
  'food',
  'activities',
  'shopping',
  'other',
]);

export type BudgetCategory = z.infer<typeof BudgetCategorySchema>;

export const ExpenseSchema = z.object({
  id: z.string(),
  tripId: z.string(),
  amount: z.number().nonnegative(),
  currency: z.string().length(3).default('EUR'),
  baseAmount: z.number().nonnegative().optional(), // L'ammontare convertito nella valuta base del viaggio
  category: BudgetCategorySchema,
  title: z.string().min(1),
  date: z.date(),
  paidBy: z.string().optional(), // UserId di chi ha pagato
  createdAt: z.date(),
});

export type Expense = z.infer<typeof ExpenseSchema>;

export const BudgetSchema = z.object({
  id: z.string(),
  tripId: z.string(),
  totalLimit: z.number().nonnegative().optional(), // Limite totale opzionale
  currency: z.string().length(3).default('EUR'),
  categoryLimits: z.record(BudgetCategorySchema, z.number().nonnegative()).optional(),
  createdAt: z.date(),
});

export type Budget = z.infer<typeof BudgetSchema>;
