import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Button } from '../../../shared/components/Button';
import { WizardProgress } from '../../../shared/components/WizardProgress';
import { FormScreenHeader } from '../../../shared/components/FormScreenHeader';
import { ErrorBanner } from '../../../shared/components/ErrorBanner';
import { useTripStore } from '../store/trip.store';
import { useTravelActions } from '../../../shared/hooks/useTravelActions';
import { tripSetupEngine } from '../../../core/engines';
import { WIZARD_STEPS } from './wizard.config';
import { WizardFormState } from './wizard.types';

interface TripSetupWizardProps {
  editTripId?: string;
}

function buildDefaultFormState(): WizardFormState {
  const start = new Date();
  start.setDate(start.getDate() + 14);
  const end = new Date();
  end.setDate(end.getDate() + 17);

  return {
    emoji: '✈️',
    title: '',
    destination: '',
    currency: 'EUR',
    coverImageUrl: undefined,
    startDate: start,
    endDate: end,
    adults: 1,
    children: 0,
    pets: 0,
    budgetAmount: undefined,
    transports: [],
    accommodations: [],
  };
}

/**
 * Orchestratore del Trip Setup Wizard (Sprint 16.1 & Redesign UX). Possiede solo stato di
 * presentazione (step corrente, bozza dei campi, errori di validazione) —
 * la validazione vera e propria vive in `trip-wizard.validator.ts` (dominio,
 * pura). La persistenza passa da `useTripStore` per i campi core del Trip,
 * e da `useTravelActions` / `tripSetupEngine` per trasporti e alloggi opzionali.
 *
 * Flusso ridisegnato: Info di base -> Voli/Trasporti (opzionali) -> Alloggio (opzionale)
 * -> Ospiti -> Budget -> Riepilogo -> Accesso immediato al Planner senza bounce.
 */
export const TripSetupWizard: React.FC<TripSetupWizardProps> = ({ editTripId }) => {
  const router = useRouter();
  const { createTrip, updateTrip, getTripById } = useTripStore();
  const travelActions = useTravelActions();

  const isEditing = Boolean(editTripId);
  const existingTrip = editTripId ? getTripById(editTripId) : undefined;

  const [stepIndex, setStepIndex] = useState(0);
  const [formState, setFormState] = useState<WizardFormState>(buildDefaultFormState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const tripIdRef = useRef<string | undefined>(editTripId);

  useEffect(() => {
    if (isEditing && existingTrip) {
      setFormState({
        emoji: existingTrip.emoji || '✈️',
        title: existingTrip.title,
        destination: existingTrip.destination,
        currency: existingTrip.currency || 'EUR',
        coverImageUrl: existingTrip.coverImageUrl,
        startDate: new Date(existingTrip.startDate),
        endDate: new Date(existingTrip.endDate),
        adults: existingTrip.travelers?.adults ?? 1,
        children: existingTrip.travelers?.children ?? 0,
        pets: existingTrip.travelers?.pets ?? 0,
        budgetAmount: existingTrip.budgetAmount,
        transports: [],
        accommodations: [],
      });

      Promise.all([
        tripSetupEngine.getTransports(existingTrip.id),
        tripSetupEngine.getAccommodations(existingTrip.id),
      ])
        .then(([transports, accommodations]) => {
          setFormState((prev) => ({
            ...prev,
            transports: transports || [],
            accommodations: accommodations || [],
          }));
        })
        .catch(() => {
          // Silently fallback se non c'è ancora un setup esistente
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, existingTrip?.id]);

  const handleChange = (patch: Partial<WizardFormState>) => {
    setFormState((prev) => ({ ...prev, ...patch }));
  };

  const toTripPayload = (state: WizardFormState) => ({
    title: state.title.trim(),
    destination: state.destination.trim(),
    emoji: state.emoji,
    currency: state.currency,
    startDate: state.startDate,
    endDate: state.endDate,
    coverImageUrl: state.coverImageUrl,
    travelers: { adults: state.adults, children: state.children, pets: state.pets },
    budgetAmount: state.budgetAmount,
  });

  // Autosave: persiste la bozza corrente. Crea il Trip al primo salvataggio
  // e sincronizza voli e alloggi opzionali via TripSetupEngine.
  const persistDraft = async (): Promise<boolean> => {
    setIsSaving(true);
    setSaveError('');
    try {
      const payload = toTripPayload(formState);
      if (!tripIdRef.current) {
        if (!payload.title || !payload.destination) {
          // Step Info non ancora completo: tieni in memoria
          return true;
        }
        const created = await createTrip(payload);
        tripIdRef.current = created.id;
        if (created.coverImageUrl !== formState.coverImageUrl) {
          setFormState((prev) => ({ ...prev, coverImageUrl: created.coverImageUrl }));
        }
      } else {
        await updateTrip(tripIdRef.current, payload);
      }

      if (tripIdRef.current) {
        await travelActions.syncTransportsAndAccommodations(
          tripIdRef.current,
          formState.transports || [],
          formState.accommodations || []
        );
      }
      return true;
    } catch (e: any) {
      setSaveError(e?.message || 'Errore durante il salvataggio automatico.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const goToStep = async (index: number) => {
    await persistDraft();
    setStepIndex(index);
  };

  const goBack = async () => {
    if (stepIndex === 0) {
      router.back();
      return;
    }
    await goToStep(stepIndex - 1);
  };

  const goNext = async () => {
    const step = WIZARD_STEPS[stepIndex];
    const result = step.validate(formState);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    setErrors({});

    const persisted = await persistDraft();
    if (!persisted) return;

    if (stepIndex === WIZARD_STEPS.length - 1) {
      if (isEditing) {
        router.back();
      } else if (tripIdRef.current) {
        router.replace(`/trip/${tripIdRef.current}` as any);
      } else {
        router.back();
      }
      return;
    }
    setStepIndex((i) => i + 1);
  };

  const currentStep = WIZARD_STEPS[stepIndex];
  const StepComponent = currentStep.Component;
  const isLastStep = stepIndex === WIZARD_STEPS.length - 1;

  return (
    <View className="flex-1">
      <FormScreenHeader
        title={isEditing ? 'Modifica viaggio' : currentStep.title}
        onLeftPress={goBack}
        leftLabel={stepIndex === 0 ? 'Annulla' : 'Indietro'}
      />

      {/* Progress */}
      <View className="px-5 pt-4">
        <WizardProgress steps={WIZARD_STEPS} currentIndex={stepIndex} />
      </View>

      {saveError ? <ErrorBanner message={saveError} /> : null}

      {/* Step content — transizione in dissolvenza tra uno step e l'altro */}
      <Animated.View
        key={stepIndex}
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(120)}
        className="flex-1 px-5 pt-6"
      >
        <StepComponent
          formState={formState}
          errors={errors}
          onChange={handleChange}
          onJumpToStep={goToStep}
        />
      </Animated.View>

      {/* Footer navigation */}
      <View className="px-5 pb-8 pt-3 border-t border-gray-100">
        <Button
          label={isSaving ? 'Salvataggio...' : isLastStep ? 'Termina e apri Planner' : 'Avanti'}
          onPress={goNext}
          disabled={isSaving}
          variant="solid"
          size="lg"
          fullWidth
        />
      </View>
    </View>
  );
};
