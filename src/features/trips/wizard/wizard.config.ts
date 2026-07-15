import {
  validateBasicInfoStep,
  validateFlightsStep,
  validateAccommodationStep,
  validateTravelersStep,
  validateBudgetStep,
} from '../../../domain/trip/validators/trip-wizard.validator';
import { BasicInfoStep } from './steps/BasicInfoStep';
import { FlightsStep } from './steps/FlightsStep';
import { AccommodationStep } from './steps/AccommodationStep';
import { TravelersStep } from './steps/TravelersStep';
import { BudgetStep } from './steps/BudgetStep';
import { SummaryStep } from './steps/SummaryStep';
import { WizardStepDefinition } from './wizard.types';

/**
 * Registro degli step del wizard — unico punto da estendere per aggiungere
 * uno step (nuovo entry + componente + validator puro). L'indicatore di
 * progresso e la navigazione Precedente/Avanti nell'orchestratore iterano
 * questo array, nessun'altra modifica è richiesta.
 *
 * Flusso aggiornato: Info -> Voli -> Alloggio -> Viaggiatori -> Budget -> Riepilogo.
 */
export const WIZARD_STEPS: WizardStepDefinition[] = [
  {
    id: 'basics',
    label: 'Info',
    title: 'Informazioni di base',
    Component: BasicInfoStep,
    validate: validateBasicInfoStep,
  },
  {
    id: 'flights',
    label: 'Voli',
    title: 'Voli & Trasporti (Opzionale)',
    Component: FlightsStep,
    validate: validateFlightsStep,
  },
  {
    id: 'accommodations',
    label: 'Alloggio',
    title: 'Alloggio & Hotel (Opzionale)',
    Component: AccommodationStep,
    validate: validateAccommodationStep,
  },
  {
    id: 'travelers',
    label: 'Ospiti',
    title: 'Chi viaggia',
    Component: TravelersStep,
    validate: validateTravelersStep,
  },
  {
    id: 'budget',
    label: 'Budget',
    title: 'Budget',
    Component: BudgetStep,
    validate: validateBudgetStep,
  },
  {
    id: 'summary',
    label: 'Riepilogo',
    title: 'Riepilogo',
    Component: SummaryStep,
    validate: () => ({ valid: true, errors: {} }),
  },
];
