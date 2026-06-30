import { z } from 'zod';

export const WalletAssetTypeSchema = z.enum(['cash', 'credit_card', 'debit_card', 'prepaid']);

export const WalletAssetSchema = z.object({
  id: z.string(),
  tripId: z.string(),
  type: WalletAssetTypeSchema,
  name: z.string(), // es. "Contanti EUR", "Revolut", "Amex"
  currency: z.string().length(3),
  balance: z.number(), // Quanto caricato/prelevato
});

export type WalletAsset = z.infer<typeof WalletAssetSchema>;

export const ExchangeRateLockSchema = z.object({
  id: z.string(),
  tripId: z.string(),
  fromCurrency: z.string().length(3),
  toCurrency: z.string().length(3),
  rate: z.number().positive(), // Tasso di cambio bloccato dall'utente
  dateLocked: z.date(),
});

export type ExchangeRateLock = z.infer<typeof ExchangeRateLockSchema>;
