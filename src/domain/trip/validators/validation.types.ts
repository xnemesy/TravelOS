/**
 * Tipo di risultato condiviso da tutti i validatori puri di dominio
 * (`trip-wizard.validator.ts`, `transport.validator.ts`, ...). Estratto in un
 * file comune per evitare di ridefinire la stessa forma in ogni validatore.
 */
export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export const VALID: ValidationResult = { valid: true, errors: {} };
