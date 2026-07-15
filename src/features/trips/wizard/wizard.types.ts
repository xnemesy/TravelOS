import React from 'react';
import { WizardStepValidation } from '../../../domain/trip/validators/trip-wizard.validator';

export type WizardStepId = 'basics' | 'flights' | 'accommodations' | 'travelers' | 'budget' | 'summary';

/**
 * Stato del form del wizard, superset dei campi `Trip` che il wizard
 * raccoglie. Non è un tipo di dominio — è la forma "bozza" mutabile che gli
 * step popolano; viene tradotto in un payload `Trip` solo al momento del
 * salvataggio (vedi `toTripPayload` in `TripSetupWizard.tsx`).
 */
export interface WizardFormState {
  emoji: string;
  title: string;
  destination: string;
  currency: string;
  coverImageUrl?: string;
  startDate: Date;
  endDate: Date;
  adults: number;
  children: number;
  pets: number;
  budgetAmount?: number;
  transports?: import('../../../domain/trip/models/trip-setup.model').Transport[];
  accommodations?: import('../../../domain/trip/models/trip-setup.model').Accommodation[];
}

export interface StepComponentProps {
  formState: WizardFormState;
  errors: Record<string, string>;
  onChange: (patch: Partial<WizardFormState>) => void;
  /** Usato solo dallo step Summary per saltare a uno step precedente da modificare. */
  onJumpToStep: (index: number) => void;
}

export interface WizardStepDefinition {
  id: WizardStepId;
  /** Etichetta breve mostrata nell'indicatore di progresso. */
  label: string;
  /** Titolo mostrato nell'header dello step. */
  title: string;
  Component: React.ComponentType<StepComponentProps>;
  validate: (formState: WizardFormState) => WizardStepValidation;
}
