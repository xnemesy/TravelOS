import { 
  PlaceRef, 
  TimelineDaySchedule, 
  OptimizationProfile, 
  JourneySuggestion, 
  JourneyConflict, 
  OptimizationReport, 
  JourneyStatus, 
  DailyHealth, 
  JourneyQuality, 
  FreeTimeSlot, 
  OptimizationEvent,
  PlaceRole,
  AnchorType,
  ExperienceDensity,
  JourneyConstraints,
  JourneyDecision,
  JourneyReport,
  JourneyAnchor,
  GeoLocation
} from '../../core/engines/types/context.types';
import { DistanceCalculator } from './DistanceCalculator';
import { JourneyAnchorEngine } from './JourneyAnchorEngine';
import { EndOfDayClosureService } from './EndOfDayClosureService';
import { Accommodation, Transport } from '../trip/models/trip-setup.model';
import { 
  CATEGORY_RULES, 
  SCORING_WEIGHTS, 
  OPTIMIZATION_PROFILES, 
  JOURNEY_CONSTRAINTS, 
  PENALTY_RULES, 
  inferPlaceRole 
} from '../config/travel-rules';
import { TravelServices } from '../providers/TravelServices';
import { timelineRuleEngine } from './rules/TimelineRuleEngine';
import { TimelineContext, DEFAULT_MEAL_WINDOWS } from './rules/rules.types';

export interface ComposeJourneyOptions {
  availablePlaces: PlaceRef[]; // Proviene rigorosamente dalla Libreria o tappe della giornata
  travelStyle?: string;
  targetDay?: number;
  dateStr?: string;
  currentSchedule?: TimelineDaySchedule;
  customConstraints?: JourneyConstraints;
  // Journey Anchors del viaggio (arrivo/partenza) — se assenti, la giornata
  // non ha vincoli strutturali (comportamento invariato).
  anchors?: JourneyAnchor[];
  accommodations?: Accommodation[];
  transports?: Transport[];
}

/**
 * ============================================================================
 * JOURNEY COMPOSER SERVICE (v2.1) — IL CERVELLO ISTANZIABILE DI TRAVEL OS
 * ============================================================================
 * Servizio istanziabile che progetta giornate realistiche, umane ed equilibrate.
 * Rispetta il flusso filosofico: Catalogo -> Libreria -> Journey Composer -> Itinerario.
 * Non inventa mai luoghi esterni: lavora esclusivamente sui luoghi resi disponibili.
 */
export class JourneyComposerService {
  /**
   * Punto di ingresso unificato per la composizione della giornata.
   */
  public async compose(options: ComposeJourneyOptions): Promise<TimelineDaySchedule> {
    const style = options.travelStyle || 'culture';
    const dayNum = options.targetDay || options.currentSchedule?.dayNumber || 1;
    const dateStr = options.dateStr || options.currentSchedule?.date || new Date().toISOString().split('T')[0];
    
    // Lavora esclusivamente con i luoghi resi disponibili nella Libreria o nel giorno
    const basePlaces = options.availablePlaces || options.currentSchedule?.places || [];
    
    const scheduleToOptimize: TimelineDaySchedule = options.currentSchedule || {
      dayNumber: dayNum,
      date: dateStr,
      places: basePlaces,
      totalWalkDistanceMeters: 0,
      totalEstimatedDurationMinutes: 0,
      overview: { experiencesCount: basePlaces.length, startTime: '09:00', endTime: '21:00', foodStopsCount: 0 },
      anchors: options.anchors,
    };

    // Se stiamo creando o aggiungendo luoghi non assegnati alla giornata, integriamoli
    if (options.currentSchedule && options.availablePlaces && options.availablePlaces !== options.currentSchedule.places) {
      const existingIds = new Set(scheduleToOptimize.places.map(p => p.id));
      const newPlaces = options.availablePlaces.filter(p => !existingIds.has(p.id));
      scheduleToOptimize.places = [...scheduleToOptimize.places, ...newPlaces];
    }

    return this.composeDayJourneyWithSIP(
      scheduleToOptimize,
      style,
      options.customConstraints,
      options.anchors || scheduleToOptimize.anchors,
      options.accommodations,
      options.transports
    );
  }

  public static normalizeCoordinates(coords?: any): GeoLocation | undefined {
    if (!coords || typeof coords !== 'object') return undefined;
    const lat = typeof coords.lat === 'number' && !isNaN(coords.lat) ? coords.lat
              : typeof coords.latitude === 'number' && !isNaN(coords.latitude) ? coords.latitude
              : undefined;
    const lng = typeof coords.lng === 'number' && !isNaN(coords.lng) ? coords.lng
              : typeof coords.longitude === 'number' && !isNaN(coords.longitude) ? coords.longitude
              : undefined;
    if (lat === undefined || lng === undefined) return undefined;
    return { latitude: lat, longitude: lng };
  }

  public generateDaySchedule(
    dayNumber: number,
    dateStr: string,
    places: PlaceRef[],
    style?: string
  ): TimelineDaySchedule {
    let totalWalkDistanceMeters = 0;
    let totalEstimatedDurationMinutes = 0;
    let currentMinutesSinceMidnight = 9 * 60; // Default start at 09:00 AM

    const cleanInput = places.filter(p => p.id !== 'hotel-start' && p.id !== 'hotel-end');
    let finalPlaces = cleanInput;

    const hasLegacyAnchors = cleanInput.some(
      (p) => !!p.journeyAnchorKind && p.journeyAnchorKind !== 'accommodation_return'
    );

    if (cleanInput.length > 0 && !hasLegacyAnchors) {
      const firstRealPlace = cleanInput[0];
      const lastRealPlace = cleanInput[cleanInput.length - 1];
      const firstCoords = JourneyComposerService.normalizeCoordinates(firstRealPlace.coordinates);
      const lastCoords = JourneyComposerService.normalizeCoordinates(lastRealPlace.coordinates);

      const hotelStart: PlaceRef = {
        id: 'hotel-start',
        name: 'Alloggio (Partenza)',
        category: 'hotel',
        coordinates: firstCoords,
        durationMinutes: 30,
        isBlock: true,
        address: 'Punto di partenza della giornata',
      };

      const hasEndReturn = cleanInput.some((p) => p.journeyAnchorKind === 'accommodation_return');

      if (hasEndReturn) {
        finalPlaces = [hotelStart, ...cleanInput];
      } else {
        const hotelEnd: PlaceRef = {
          id: 'hotel-end',
          name: 'Alloggio (Ritorno)',
          category: 'hotel',
          coordinates: lastCoords,
          durationMinutes: 30,
          isBlock: true,
          address: 'Punto di rientro a fine giornata',
        };
        finalPlaces = [hotelStart, ...cleanInput, hotelEnd];
      }
    }

    const enrichedPlaces: PlaceRef[] = finalPlaces.map((place, index) => {
      let distanceMeters = 0;
      let estimatedWalkMinutes = 0;

      if (index > 0) {
        const prevPlace = finalPlaces[index - 1];
        distanceMeters = DistanceCalculator.calculateHaversineDistance(
          prevPlace.coordinates,
          place.coordinates
        );

        // Se la distanza supera i 3km (3000m), stimiamo tempo di guida anziché camminata
        if (distanceMeters > 3000) {
          const speedKmh = distanceMeters > 30000 ? 80 : 40; // 80 km/h per autostrada/lungo tragitto, 40 km/h per urbano
          estimatedWalkMinutes = DistanceCalculator.estimateDrivingDurationMinutes(distanceMeters, speedKmh);
        } else {
          estimatedWalkMinutes = DistanceCalculator.estimateWalkingDurationMinutes(distanceMeters);
        }

        currentMinutesSinceMidnight += estimatedWalkMinutes;
      }

      // Journey Anchor (o qualsiasi place con orario reale prenotato): l'istante
      // è immutabile, non un accumulo di camminate/attese. Il Composer avanza
      // l'orologio interno fino a quell'istante reale, senza ricalcolarlo.
      if (place.scheduledTime) {
        const scheduled = new Date(place.scheduledTime);
        currentMinutesSinceMidnight = scheduled.getHours() * 60 + scheduled.getMinutes();
      }

      if (place.category === 'lunch' && currentMinutesSinceMidnight < 12 * 60 + 30) {
        currentMinutesSinceMidnight = 12 * 60 + 30; // Forza pranzo alle 12:30 se troppo presto
      }
      if (place.category === 'dinner' && currentMinutesSinceMidnight < 20 * 60) {
        currentMinutesSinceMidnight = 20 * 60; // Forza cena alle 20:00 se troppo presto
      }

      // Evita l'overflow oltre la mezzanotte del giorno stesso
      if (currentMinutesSinceMidnight > 23 * 60 + 59) {
        currentMinutesSinceMidnight = 23 * 60 + 59;
      }

      const startMins = currentMinutesSinceMidnight;
      totalWalkDistanceMeters += distanceMeters;
      
      const rule = CATEGORY_RULES[place.category] || { defaultDurationMinutes: 60, energyLevel: 'medium' };
      const placeDuration = place.durationMinutes || (rule?.defaultDurationMinutes ?? 60);
      
      const calculatedStartTime = this.formatTime(startMins);
      currentMinutesSinceMidnight += placeDuration;
      
      if (currentMinutesSinceMidnight > 23 * 60 + 59) {
        currentMinutesSinceMidnight = 23 * 60 + 59;
      }
      const calculatedEndTime = this.formatTime(currentMinutesSinceMidnight);
      
      const placeWarnings = place.warnings 
        ? place.warnings.filter((w: string) => !w.includes('Chiuso alle') && !w.includes('Orario sconsigliato') && !w.includes('Distanza irrealistica'))
        : [];

      if (!place.isBlock && startMins >= 22 * 60 + 30) {
        if (!placeWarnings.some((w: string) => w.includes('Orario sconsigliato'))) {
          placeWarnings.push(`Orario sconsigliato (dopo le 22:30).`);
        }
      }

      if (index > 0 && distanceMeters > 50000) { // Distanza > 50km
        const distanceKm = Math.round(distanceMeters / 1000);
        placeWarnings.push(`⚠️ Distanza irrealistica: ${distanceKm} km da coprire.`);
      }

      const role = inferPlaceRole(place);
      const anchorType: AnchorType | undefined = place.anchorType || (place.scheduledTime ? 'HARD' : (place.isLocked ? 'SOFT' : undefined));
      
      const enrichedPlace: PlaceRef = {
        ...place,
        durationMinutes: placeDuration,
        energyLevel: place.energyLevel || rule?.energyLevel || 'medium',
        idealTimeWindows: place.idealTimeWindows || rule?.idealTimeWindows || [],
        distanceMeters,
        estimatedWalkMinutes,
        calculatedStartTime,
        calculatedEndTime,
        warnings: placeWarnings,
        role,
        anchorType,
      };
 
      totalEstimatedDurationMinutes += placeDuration + estimatedWalkMinutes;
      return enrichedPlace;
    });

    const foodStopsCount = enrichedPlaces.filter(p => p.category === 'lunch' || p.category === 'dinner' || p.category === 'breakfast').length;
    const walkingKm = Math.round(totalWalkDistanceMeters / 100) / 10;
    const plannedHours = Math.round(totalEstimatedDurationMinutes / 6) / 10;
    
    const density = this.calculateExperienceDensity(walkingKm, plannedHours, enrichedPlaces.length);
    const theme = this.generateDayTheme(enrichedPlaces, style);
    const mood = this.generateJourneyMood(density, enrichedPlaces, style);

    return {
      dayNumber,
      date: dateStr,
      places: enrichedPlaces,
      totalWalkDistanceMeters,
      totalEstimatedDurationMinutes,
      density,
      theme,
      mood,
      overview: {
        experiencesCount: enrichedPlaces.filter(p => !p.isBlock).length,
        startTime: enrichedPlaces[0]?.calculatedStartTime || '09:00',
        endTime: enrichedPlaces[enrichedPlaces.length - 1]?.calculatedEndTime || '21:00',
        foodStopsCount,
      }
    };
  }

  private generateDayTheme(places: PlaceRef[], style?: string): string {
    if (places.length === 0) {
      const freeDayThemes = [
        'Giornata da creare',
        'Ancora tutta da vivere',
        'Pagina bianca',
        'Nessuna avventura pianificata',
        'Lasciati ispirare'
      ];
      const randomIndex = Math.floor(Math.random() * freeDayThemes.length);
      return freeDayThemes[randomIndex];
    }
    
    // Trova l'esperienza principale o il momento saliente
    const hero = places.find(p => p.role === 'hero_experience') || places.find(p => p.category === 'museum' || p.category === 'landmark');
    const hasSunset = places.some(p => p.role === 'viewpoint' || p.category === 'sunset');
    const hasThermal = places.some(p => p.category === 'spa' || p.category === 'relax');
    const foodStops = places.filter(p => p.category === 'dinner' || p.category === 'lunch');

    const heroName = hero?.name ? hero.name.split(' ')[0] : '';
    
    if (style === 'culture' && hero) return `Immersione nella storia a ${heroName}`;
    if (style === 'family' && hero) return `Avventura in famiglia a ${heroName}`;
    if (hasThermal && hero) return `Tra relax e scoperte`;
    if (hasSunset) return `Fino al tramonto`;
    if (foodStops.length > 1 && style === 'gastronomic') return `Sapori locali`;
    if (hero) return `Scoprendo ${heroName}`;
    
    // Fallback poetico/editoriale per città (es: Budapest) o generico
    const isBudapest = places.some(p => p.address?.toLowerCase().includes('budapest') || p.name.toLowerCase().includes('budapest') || p.id.includes('bud'));
    if (isBudapest) {
      const budapestThemes = [
        'Il cuore di Pest',
        'Budapest Imperiale',
        'Tra il Danubio e il Parlamento',
        'I segreti di Buda',
        'Atmosfere sul Danubio',
        'Passeggiando tra i monumenti'
      ];
      const randomIndex = Math.floor(Math.random() * budapestThemes.length);
      return budapestThemes[randomIndex];
    }

    const fallbackThemes = [
      'Il cuore della città',
      'Passeggiando tra i monumenti',
      'Il quartiere storico',
      'L\'anima della città',
      'Tra piazze e vicoli',
      'Scorci da ricordare'
    ];
    const randomIndex = Math.floor(Math.random() * fallbackThemes.length);
    return fallbackThemes[randomIndex];
  }

  private generateJourneyMood(density: ExperienceDensity, places: PlaceRef[], style?: string): TimelineDaySchedule['mood'] {
    if (style === 'photography') return 'photography';
    if (style === 'gastronomic') return 'gastronomic';
    if (style === 'culture') return 'culture';
    if (style === 'family') return 'family';

    if (density === 'very_relaxed' || density === 'relaxed') return 'relaxed';
    if (density === 'busy' || density === 'intense') return 'intense';
    return 'balanced';
  }

  public reorderDaySchedule(
    currentSchedule: TimelineDaySchedule,
    orderedPlaceIds: string[]
  ): TimelineDaySchedule {
    const placesMap = new Map(currentSchedule.places.map((p) => [p.id, p]));
    const reorderedPlaces: PlaceRef[] = [];
    
    for (const id of orderedPlaceIds) {
      const place = placesMap.get(id);
      if (place) reorderedPlaces.push(place);
    }

    for (const place of currentSchedule.places) {
      if (!orderedPlaceIds.includes(place.id)) {
        reorderedPlaces.push(place);
      }
    }

    return this.generateDaySchedule(
      currentSchedule.dayNumber,
      currentSchedule.date,
      reorderedPlaces
    );
  }

  private estimateSunsetMinutes(latitude: number, dateStr: string): number {
    const month = new Date(dateStr).getMonth() + 1;
    if (month >= 5 && month <= 8) return 20 * 60; // Estate
    if (month >= 11 || month <= 2) return 16 * 60 + 30; // Inverno
    return 18 * 60; // Primavera/Autunno
  }

  private parseTime(timeStr: string): number {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  }

  private formatTime(minutesSinceMidnight: number): string {
    const hours = Math.floor(minutesSinceMidnight / 60) % 24;
    const mins = Math.floor(minutesSinceMidnight % 60);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  public calculateExperienceDensity(walkingKm: number, plannedHours: number, placesCount: number): ExperienceDensity {
    if (walkingKm > 12 || plannedHours > 10 || placesCount > 8) return 'intense';
    if (walkingKm > 8 || plannedHours > 8 || placesCount > 6) return 'busy';
    if (walkingKm > 4 || plannedHours > 5 || placesCount > 3) return 'balanced';
    if (plannedHours > 3 || placesCount > 1) return 'relaxed';
    return 'very_relaxed';
  }

  public async composeDayJourney(
    currentSchedule: TimelineDaySchedule,
    profileId: string = 'culture',
    customConstraints?: JourneyConstraints,
    anchors?: JourneyAnchor[],
    accommodations?: Accommodation[],
    transports?: Transport[]
  ): Promise<TimelineDaySchedule> {
    const dayAnchors = anchors || currentSchedule.anchors || [];
    const activityWindow = JourneyAnchorEngine.getDayActivityWindow(dayAnchors, currentSchedule.date);
    const anchorBlocks = JourneyAnchorEngine.toPlaceRefs(dayAnchors, currentSchedule.date);
    const startAnchorBlocks = anchorBlocks.filter(
      (a) => a.journeyAnchorKind && JourneyAnchorEngine.isArrivalAnchorKind(a.journeyAnchorKind)
    );
    const endAnchorBlocks = anchorBlocks.filter(
      (a) => a.journeyAnchorKind && JourneyAnchorEngine.isDepartureAnchorKind(a.journeyAnchorKind)
    );

    if ((!currentSchedule.places || currentSchedule.places.length === 0) && anchorBlocks.length === 0) {
      return currentSchedule;
    }

    const profile = OPTIMIZATION_PROFILES[profileId] || OPTIMIZATION_PROFILES['culture'];
    const constraints = customConstraints || JOURNEY_CONSTRAINTS[profileId] || JOURNEY_CONSTRAINTS['culture'];

    const nonBlockPlaces = (currentSchedule.places || []).filter(p => !p.isBlock).map(p => ({
      ...p,
      role: inferPlaceRole(p),
      anchorType: p.anchorType || (p.scheduledTime ? 'HARD' as AnchorType : (p.isLocked ? 'SOFT' as AnchorType : undefined))
    }));

    if (nonBlockPlaces.length === 0 && anchorBlocks.length === 0) return currentSchedule;

    const beforeDistance = currentSchedule.totalWalkDistanceMeters;

    const hardAnchors = nonBlockPlaces.filter(p => p.anchorType === 'HARD' || p.scheduledTime);
    const softAnchors = nonBlockPlaces.filter(p => p.anchorType === 'SOFT' && !p.scheduledTime && p.isLocked);
    const flexiblePlaces = nonBlockPlaces.filter(p => !p.scheduledTime && !p.isLocked);

    const isMustSee = (p: PlaceRef) => p.role === 'hero_experience' || p.priority === 'must_see' || (p as any).mustSee === true || (p as any).priority === 'high';
    const heroPlaces = flexiblePlaces.filter(isMustSee);
    const secondaryPlaces = flexiblePlaces.filter(p => !isMustSee(p));

    let selectedHeroes: PlaceRef[] = [];
    let demotedHeroes: PlaceRef[] = [];

    const maxHeroes = profileId === 'express' || profileId === 'culture' ? 2 : 1;
    if (heroPlaces.length > maxHeroes) {
      selectedHeroes = heroPlaces.slice(0, maxHeroes);
      demotedHeroes = heroPlaces.slice(maxHeroes).map(p => ({ ...p, role: 'secondary' as PlaceRole }));
    } else {
      selectedHeroes = heroPlaces;
    }

    const availableSecondary = [...secondaryPlaces, ...demotedHeroes];

    // Il tetto oltre cui nessuna attività può proseguire: il primo istante di
    // partenza (check-out/transfer/aeroporto/volo) della giornata, se presente.
    const ceilingMinutes = activityWindow?.endMinutes ?? (24 * 60 - 1);
    const prefEndMinutes = this.parseTime(constraints.preferredEndTime || profile.preferredEndTime || '22:00');
    const effectiveDayEnd = Math.min(ceilingMinutes, prefEndMinutes);

    const composedPlaces: PlaceRef[] = [];
    let currentMinutesSinceMidnight = this.parseTime(profile.preferredStartTime);

    if (currentSchedule.overview?.startTime) {
      const parsedStart = this.parseTime(currentSchedule.overview.startTime);
      if (!isNaN(parsedStart) && parsedStart > 0 && parsedStart < 24 * 60) {
        currentMinutesSinceMidnight = Math.max(currentMinutesSinceMidnight, parsedStart);
      }
    }

    // Nessuna attività può iniziare prima che il viaggiatore sia fisicamente
    // arrivato/trasferito/check-in effettuato: gli anchor di arrivo aprono la
    // giornata e spingono in avanti l'orologio interno del Composer.
    if (startAnchorBlocks.length > 0) {
      composedPlaces.push(...startAnchorBlocks);
      const lastStartAnchor = startAnchorBlocks[startAnchorBlocks.length - 1];
      if (lastStartAnchor.calculatedEndTime) {
        const parsedEnd = this.parseTime(lastStartAnchor.calculatedEndTime);
        if (!isNaN(parsedEnd) && parsedEnd > 0) {
          currentMinutesSinceMidnight = Math.max(currentMinutesSinceMidnight, parsedEnd);
        }
      } else if (lastStartAnchor.scheduledTime) {
        const lastStartAnchorTime = new Date(lastStartAnchor.scheduledTime);
        const anchorMins = !isNaN(lastStartAnchorTime.getTime())
          ? lastStartAnchorTime.getUTCHours() * 60 + lastStartAnchorTime.getUTCMinutes() + (lastStartAnchor.durationMinutes || 0)
          : this.parseTime(lastStartAnchor.scheduledTime) + (lastStartAnchor.durationMinutes || 0);
        if (!isNaN(anchorMins)) {
          currentMinutesSinceMidnight = Math.max(currentMinutesSinceMidnight, anchorMins);
        }
      }
    }
    if (activityWindow) {
      currentMinutesSinceMidnight = Math.max(currentMinutesSinceMidnight, activityWindow.startMinutes);
    }

    const mealWindows = constraints.mealWindows || DEFAULT_MEAL_WINDOWS;
    let hasBreakfast = false;
    let hasLunch = false;
    let hasDinner = false;
    const suggestions: JourneySuggestion[] = [];
    const conflicts: JourneyConflict[] = [];
    const decisions: JourneyDecision[] = [];
    let accumulatedExplanations: string[] = [];

    const canDoSightseeing = effectiveDayEnd - currentMinutesSinceMidnight >= 45;

    if (
      canDoSightseeing &&
      currentMinutesSinceMidnight >= mealWindows.breakfast.startMinutes &&
      currentMinutesSinceMidnight <= mealWindows.breakfast.endMinutes &&
      profile.mealStrategy !== 'none' &&
      currentMinutesSinceMidnight + 30 <= effectiveDayEnd
    ) {
      const breakfastId = `block-breakfast-${Date.now()}`;
      composedPlaces.push({
        id: breakfastId,
        name: '🍳 Colazione e Caffè',
        category: 'breakfast',
        coordinates: nonBlockPlaces[0]?.coordinates,
        isBlock: true,
        durationMinutes: 30,
        role: 'coffee',
      });
      hasBreakfast = true;
      currentMinutesSinceMidnight += 30;
    }

    const pool = [...softAnchors, ...selectedHeroes, ...availableSecondary];
    let current = composedPlaces[composedPlaces.length - 1] || null;

    while (canDoSightseeing && pool.length > 0) {
      let bestIdx = -1;
      let bestScore = -Infinity;
      let bestEvaluation: any = null;

      const context: TimelineContext = {
        currentTimeMinutes: currentMinutesSinceMidnight,
        effectiveDayEnd,
        mealWindows,
        currentPlace: current,
        weather: null,
        energyLevel: 'medium',
        transportationMode: 'walking',
        date: currentSchedule.date,
        tripId: '',
        userPreferences: {
          pace: profileId === 'relax' ? 'relaxed' : (profileId === 'express' ? 'intense' : 'normal'),
          preferredStartTime: profile.preferredStartTime,
          preferredEndTime: '22:00',
        },
        placedIds: new Set(composedPlaces.map(p => p.id)),
      };

      for (let i = 0; i < pool.length; i++) {
        const candidate = pool[i];
        const evaluation = await timelineRuleEngine.evaluate(candidate, context);

        if (evaluation.reject) {
          continue;
        }

        // Regola non negoziabile degli Journey Anchor e di effectiveDayEnd (BUG 7):
        // nessuna attività può finire dopo il tetto imposto o lo spazio utile rimasto.
        const projectedDuration = evaluation.overrideVisitDuration || candidate.durationMinutes || 60;
        let travelMinutesToCandidate = 0;
        const currentCoords = JourneyComposerService.normalizeCoordinates(current?.coordinates);
        const candidateCoords = JourneyComposerService.normalizeCoordinates(candidate?.coordinates);

        if (currentCoords && candidateCoords) {
          const dist = DistanceCalculator.calculateHaversineDistance(currentCoords, candidateCoords);
          travelMinutesToCandidate = dist > 3000
            ? DistanceCalculator.estimateDrivingDurationMinutes(dist, dist > 30000 ? 80 : 40)
            : DistanceCalculator.estimateWalkingDurationMinutes(dist);
        }

        const projectedFinish = currentMinutesSinceMidnight + (evaluation.delayMinutes || 0) + travelMinutesToCandidate + projectedDuration;
        if (projectedFinish > ceilingMinutes || projectedFinish > effectiveDayEnd) {
          continue;
        }

        let geoScore = 0;
        if (currentCoords && candidateCoords) {
          const dist = DistanceCalculator.calculateHaversineDistance(currentCoords, candidateCoords);
          geoScore = (SCORING_WEIGHTS.DISTANCE_MAX - dist) * 0.1;
        }

        const finalScore = evaluation.report.totalScore + geoScore;

        if (finalScore > bestScore) {
          bestScore = finalScore;
          bestIdx = i;
          bestEvaluation = evaluation;
        }
      }

      if (bestIdx === -1) {
        break;
      }

      if (bestEvaluation.insertEvent) {
        const event = bestEvaluation.insertEvent;
        const eventId = `block-${event.type}-${Date.now()}`;
        composedPlaces.push({
          id: eventId,
          name: event.name,
          category: event.type,
          coordinates: JourneyComposerService.normalizeCoordinates(current ? current.coordinates : pool[bestIdx].coordinates),
          isBlock: true,
          durationMinutes: event.durationMinutes,
          role: event.type === 'lunch' || event.type === 'dinner' ? 'food' : 'free_time',
        });
        currentMinutesSinceMidnight += event.durationMinutes;
        
        if (event.type === 'lunch') hasLunch = true;
        if (event.type === 'dinner') hasDinner = true;

        current = composedPlaces[composedPlaces.length - 1];
        continue;
      }

      const nextPlace = pool.splice(bestIdx, 1)[0];

      if (bestEvaluation.delayMinutes > 0) {
        currentMinutesSinceMidnight += bestEvaluation.delayMinutes;
      }

      if (bestEvaluation.report.explanations) {
        accumulatedExplanations.push(...bestEvaluation.report.explanations);
      }

      const duration = bestEvaluation.overrideVisitDuration || nextPlace.durationMinutes || 60;
      
      const decision: JourneyDecision = {
        placeId: nextPlace.id,
        placeName: nextPlace.name,
        reason: bestEvaluation.report.explanations?.join(' | ') || 'Posizionato dal motore di regole.',
        confidence: nextPlace.role === 'hero_experience' ? 0.95 : 0.85,
        alternatives: [],
      };
      decisions.push(decision);

      composedPlaces.push({
        ...nextPlace,
        durationMinutes: duration,
        decision,
      });

      currentMinutesSinceMidnight += duration;
      current = nextPlace;
    }

    // Un giorno di partenza troppo stretto o fuori finestra non forza un pasto che sforerebbe
    // il tetto o la finestra oraria: meglio nessun pranzo/cena che un ritardo al gate o un pasto notturno.
    if (canDoSightseeing && !hasLunch && profile.mealStrategy !== 'none' && currentMinutesSinceMidnight >= mealWindows.lunch.startMinutes && currentMinutesSinceMidnight <= mealWindows.lunch.endMinutes && currentMinutesSinceMidnight + 60 <= effectiveDayEnd) {
      composedPlaces.push({
        id: `block-lunch-${Date.now()}`,
        name: 'Pranzo',
        category: 'lunch',
        coordinates: current?.coordinates,
        isBlock: true,
        durationMinutes: 60,
        role: 'food',
      });
      hasLunch = true;
      currentMinutesSinceMidnight += 60;
    }
    if (canDoSightseeing && !hasDinner && profile.mealStrategy !== 'none' && currentMinutesSinceMidnight >= mealWindows.dinner.startMinutes && currentMinutesSinceMidnight <= mealWindows.dinner.endMinutes && currentMinutesSinceMidnight + 90 <= effectiveDayEnd) {
      composedPlaces.push({
        id: `block-dinner-${Date.now()}`,
        name: 'Cena',
        category: 'dinner',
        coordinates: current?.coordinates,
        isBlock: true,
        durationMinutes: 90,
        role: 'food',
      });
      hasDinner = true;
      currentMinutesSinceMidnight += 90;
    }

    composedPlaces.push(...hardAnchors);

    // Regola C (Sprint 18 — Fase 7): integrazione di EndOfDayClosureService dopo che
    // attività, pasti e coda di pianificazione sono stati risolti e prima di endAnchorBlocks.
    const effectiveAccommodations = accommodations || [];
    const effectiveTransports = transports || [];

    let lastActivityEndMinutes = currentMinutesSinceMidnight;
    for (const p of [...composedPlaces, ...hardAnchors]) {
      if (p.scheduledTime) {
        const d = new Date(p.scheduledTime);
        const startM = !isNaN(d.getTime()) ? d.getUTCHours() * 60 + d.getUTCMinutes() : this.parseTime(p.scheduledTime);
        if (!isNaN(startM)) {
          lastActivityEndMinutes = Math.max(lastActivityEndMinutes, startM + (p.durationMinutes || 0));
        }
      } else if (p.calculatedEndTime) {
        const endM = this.parseTime(p.calculatedEndTime);
        if (!isNaN(endM) && endM > 0) {
          lastActivityEndMinutes = Math.max(lastActivityEndMinutes, endM);
        }
      }
    }

    const lastPlaceWithCoords = [...composedPlaces, ...hardAnchors].reverse().find(p => p.coordinates);
    const lastCoords = JourneyComposerService.normalizeCoordinates(lastPlaceWithCoords?.coordinates);

    const nightAccommodation = effectiveAccommodations.find(
      (a: any) => {
        const checkInStr = typeof a.checkIn === 'string' ? a.checkIn : a.checkIn.toISOString();
        const checkOutStr = typeof a.checkOut === 'string' ? a.checkOut : a.checkOut.toISOString();
        return checkInStr.slice(0, 10) <= currentSchedule.date && checkOutStr.slice(0, 10) > currentSchedule.date;
      }
    );
    const nightAccommodationCoords = JourneyComposerService.normalizeCoordinates(nightAccommodation?.coordinates);

    let returnTravelMinutes = 0;
    if (lastCoords && nightAccommodationCoords) {
      const dist = DistanceCalculator.calculateHaversineDistance(lastCoords, nightAccommodationCoords);
      returnTravelMinutes = dist > 3000
        ? DistanceCalculator.estimateDrivingDurationMinutes(dist, dist > 30000 ? 80 : 40)
        : DistanceCalculator.estimateWalkingDurationMinutes(dist);
    }

    const allNodesBeforeEnd = [...composedPlaces, ...hardAnchors, ...endAnchorBlocks];
    const lastNode = allNodesBeforeEnd.length > 0 ? allNodesBeforeEnd[allNodesBeforeEnd.length - 1] : undefined;

    const shouldReturn = EndOfDayClosureService.shouldReturnToAccommodation({
      dateStr: currentSchedule.date,
      lastNodeAnchorKind: lastNode?.journeyAnchorKind,
      accommodations: effectiveAccommodations,
      transports: effectiveTransports,
      lastActivityEndMinutes,
      dayEndMinutes: ceilingMinutes,
      returnTravelMinutes,
    });

    const hasClosingOrDeparture = allNodesBeforeEnd.some(
      (p) =>
        p.journeyAnchorKind &&
        (p.journeyAnchorKind === 'accommodation_return' ||
          p.journeyAnchorKind === 'check_out' ||
          JourneyAnchorEngine.isDepartureAnchorKind(p.journeyAnchorKind))
    );

    if (shouldReturn && !hasClosingOrDeparture) {
      const returnStartMinutes = Math.min(
        lastActivityEndMinutes + returnTravelMinutes,
        Math.max(lastActivityEndMinutes, ceilingMinutes - 30)
      );
      const startTimeStr = this.formatTime(returnStartMinutes);
      const endTimeStr = this.formatTime(returnStartMinutes + 30);
      // scheduledTime va espresso come istante ISO reale (stessa convenzione di
      // JourneyAnchorEngine.toPlaceRefs), non come stringa "HH:mm": generateDaySchedule
      // lo rilegge con `new Date(place.scheduledTime)` per avanzare l'orologio interno.
      // Costruito da componenti locali (anno/mese/giorno + minuti) così che il
      // round-trip toISOString() -> new Date().getHours()/getMinutes() nel Composer
      // recuperi esattamente gli stessi minuti, indipendentemente dal fuso orario
      // della macchina che esegue il calcolo.
      const [returnYear, returnMonth, returnDay] = currentSchedule.date.split('-').map(Number);
      const returnScheduledDate = new Date(returnYear, returnMonth - 1, returnDay, 0, 0, 0, 0);
      returnScheduledDate.setMinutes(returnStartMinutes);
      const scheduledTimeISO = returnScheduledDate.toISOString();

      const returnPlace: PlaceRef = {
        id: `anchor-accommodation-return-${nightAccommodation?.id || 'default'}-${currentSchedule.date}`,
        name: `Rientro in struttura — ${nightAccommodation ? nightAccommodation.name : 'Alloggio'}`,
        category: 'accommodation_return',
        coordinates: nightAccommodationCoords
          ? {
              latitude: nightAccommodationCoords.latitude,
              longitude: nightAccommodationCoords.longitude,
            }
          : (lastCoords ? { ...lastCoords } : undefined),
        isBlock: true,
        isLocked: true,
        durationMinutes: 30,
        role: 'anchor',
        anchorType: 'HARD',
        journeyAnchorKind: 'accommodation_return',
        scheduledTime: scheduledTimeISO,
        calculatedStartTime: startTimeStr,
        calculatedEndTime: endTimeStr,
      };
      composedPlaces.push(returnPlace);
    }

    composedPlaces.push(...endAnchorBlocks);

    const generated = this.generateDaySchedule(
      currentSchedule.dayNumber,
      currentSchedule.date,
      composedPlaces,
      profileId
    );

    const afterDistance = generated.totalWalkDistanceMeters;
    const savedDistanceKm = Math.max(0, (beforeDistance - afterDistance) / 1000);

    const walkingKm = Math.round(afterDistance / 100) / 10;
    const freeTimeMins = generated.places.filter(p => p.role === 'free_time').reduce((acc, p) => acc + (p.durationMinutes || 0), 0);
    const heroPlace = generated.places.find(p => p.role === 'hero_experience');
    const viewpointPlace = generated.places.find(p => p.role === 'viewpoint' || p.category === 'sunset');
    
    const realVisitsCount = generated.places.filter(p => 
      !p.isBlock && 
      !p.journeyAnchorKind && 
      p.category !== 'hotel' && 
      p.category !== 'transfer' && 
      p.category !== 'breakfast' && 
      p.category !== 'lunch' && 
      p.category !== 'dinner' && 
      p.category !== 'drinks' && 
      p.category !== 'free_time'
    ).length;

    let stars = 5;
    let statusLabel = 'La giornata è perfettamente equilibrata.';
    if (realVisitsCount === 0) {
      if (startAnchorBlocks.length > 0 && (!canDoSightseeing || currentMinutesSinceMidnight >= 18 * 60 || startAnchorBlocks.some(a => a.scheduledTime?.includes('T2') || a.scheduledTime?.includes('T19') || a.scheduledTime?.includes('T18')))) {
        statusLabel = "Nessuna attività di visita aggiunta: tempo a disposizione limitato dopo l'arrivo (o transito serale). Le tappe sono state riprogrammate alle giornate successive.";
      } else if (endAnchorBlocks.length > 0 && !canDoSightseeing) {
        const depTime = new Date(endAnchorBlocks[0].scheduledTime!);
        const depTimeStr = !isNaN(depTime.getTime()) ? `${depTime.getHours().toString().padStart(2, '0')}:${depTime.getMinutes().toString().padStart(2, '0')}` : '11:00';
        statusLabel = `Volo di partenza alle ${depTimeStr}: finestra mattutina ridotta. Previste solo attività leggere o relax prima del transfer.`;
      } else {
        statusLabel = "Giornata dedicata agli spostamenti e alla logistica di transito.";
      }
    } else if (walkingKm > constraints.maxWalkingKm) {
      stars -= 1;
      statusLabel = `Camminata intensa (${walkingKm} km), ma ben distribuita.`;
    } else if (demotedHeroes.length > 0) {
      statusLabel = 'Esperienze Must-See distribuite per non affaticare il ritmo.';
    }

    const bestMomentStr = viewpointPlace 
      ? `Golden Hour presso ${viewpointPlace.name}` 
      : (heroPlace ? `Visita a ${heroPlace.name}` : (realVisitsCount === 0 ? "Arrivo e riposo in vista delle prossime tappe" : "Passeggiata mattutina"));

    const journeyReport: JourneyReport = {
      statusLabel,
      stars: Math.max(1, stars),
      walkingKm,
      freeTimeMinutes: freeTimeMins,
      heroPlaceName: heroPlace ? heroPlace.name : undefined,
      bestMoment: bestMomentStr,
      criticalPoint: walkingKm > 10 ? 'Distanza a piedi elevata tra le attrazioni pomeridiane.' : undefined,
      density: generated.density || 'balanced',
      decisions,
      beforeDistance,
      afterDistance,
      savedDistanceKm,
    };

    const events: OptimizationEvent[] = [];
    if (savedDistanceKm > 0.5) events.push({ type: 'REDUCED_WALKING', delta: Math.round(savedDistanceKm * 10) / 10 });
    if (hasLunch) events.push({ type: 'INSERTED_LUNCH', delta: 1 });
    if (hasDinner) events.push({ type: 'INSERTED_DINNER', delta: 1 });
    events.push({ type: 'BALANCED_ENERGY' });

    generated.suggestions = suggestions;
    generated.conflicts = [];
    generated.journeyReport = journeyReport;
    if (generated.overview) {
      (generated.overview as any).journeyReport = journeyReport;
    }
    generated.anchors = dayAnchors.length > 0 ? dayAnchors : currentSchedule.anchors;
    generated.optimizationReport = {
      beforeDistance,
      afterDistance,
      savedDistanceKm,
      savedWalkingMinutes: Math.max(0, DistanceCalculator.estimateWalkingDurationMinutes(beforeDistance - afterDistance)),
      reorderedStops: composedPlaces.length - hardAnchors.length,
      insertedMeals: (hasLunch ? 1 : 0) + (hasDinner ? 1 : 0),
      conflictsSolved: 0,
      quality: this.calculateJourneyQuality(generated),
      events,
    };

    return generated;
  }

  public async composeDayJourneyWithSIP(
    currentSchedule: TimelineDaySchedule,
    profileId: string = 'culture',
    customConstraints?: JourneyConstraints,
    anchors?: JourneyAnchor[],
    accommodations?: Accommodation[],
    transports?: Transport[]
  ): Promise<TimelineDaySchedule> {
    const composed = await this.composeDayJourney(currentSchedule, profileId, customConstraints, anchors, accommodations, transports);
    if (!composed.places || composed.places.length === 0) return composed;

    const refPlace = composed.places.find(p => p.coordinates);
    if (!refPlace || !refPlace.coordinates) return composed;
    const lat = refPlace.coordinates.latitude;
    const lon = refPlace.coordinates.longitude;

    try {
      const weatherSummary = await TravelServices.weather().getDailyForecast(lat, lon, composed.date);
      if (weatherSummary && weatherSummary.sunset) {
        const [h, m] = weatherSummary.sunset.split(':').map(Number);
        const sunsetMinutes = h * 60 + (m || 0);
        
        for (const place of composed.places) {
          if (place.role === 'viewpoint' || place.category === 'sunset' || place.name.toLowerCase().includes('tramonto')) {
            const startMin = Math.max(0, sunsetMinutes - 45);
            place.calculatedStartTime = this.formatTime(startMin);
            place.calculatedEndTime = this.formatTime(sunsetMinutes + 15);
          }
        }
      }

      for (const place of composed.places) {
        if (!place.isBlock && place.calculatedStartTime) {
          const isOpen = await TravelServices.openingHours().isOpenAt(place.id, composed.date, place.calculatedStartTime);
          if (!isOpen) {
            place.warnings = place.warnings || [];
            if (!place.warnings.some((w: string) => w.includes('Chiuso'))) {
              place.warnings.push(`Chiuso alle ${place.calculatedStartTime} secondo gli orari provider.`);
            }
          }
        }
      }
    } catch (error) {
      console.warn('[JourneyComposerService] SIP enrichment failed, using offline composed schedule:', error);
    }

    return composed;
  }

  public calculateRuntimeStatus(schedule: TimelineDaySchedule, currentTimeMinutes?: number): JourneyStatus {
    const nowMins = currentTimeMinutes ?? (new Date().getHours() * 60 + new Date().getMinutes());
    const places = schedule.places || [];

    if (places.length === 0) {
      return {
        status: 'on_time',
        label: 'Giornata libera',
        differenceMinutes: 0,
        color: '#10B981',
        icon: 'checkmark-circle-outline',
      };
    }

    const currentOrNext = places.find(p => !p.isVisited) || places[places.length - 1];
    const expectedStartMins = this.parseTime(currentOrNext.calculatedStartTime || '09:00');
    const differenceMinutes = nowMins - expectedStartMins;

    if (differenceMinutes <= -15) {
      return { status: 'ahead', label: 'In anticipo', differenceMinutes: Math.abs(differenceMinutes), color: '#3B82F6', icon: 'speedometer-outline' };
    } else if (differenceMinutes > 15 && differenceMinutes <= 45) {
      return { status: 'slight_delay', label: 'Leggero ritardo', differenceMinutes, color: '#F59E0B', icon: 'time-outline' };
    } else if (differenceMinutes > 45) {
      return { status: 'heavy_delay', label: 'Molto in ritardo', differenceMinutes, color: '#EF4444', icon: 'alert-circle-outline' };
    } else {
      return { status: 'on_time', label: 'In orario', differenceMinutes: 0, color: '#10B981', icon: 'checkmark-circle-outline' };
    }
  }

  public calculateRuntimeHealth(schedule: TimelineDaySchedule): DailyHealth {
    const places = schedule.places || [];
    const walkingKm = Math.round((schedule.totalWalkDistanceMeters || 0) / 100) / 10;
    const plannedHours = Math.round((schedule.totalEstimatedDurationMinutes || 0) / 6) / 10;

    let breaksCount = 0;
    let outdoorCount = 0;
    let indoorCount = 0;

    for (const p of places) {
      if (p.role === 'food' || p.role === 'coffee' || p.role === 'free_time' || p.isBlock) breaksCount++;
      const rule = CATEGORY_RULES[p.category];
      if (rule?.weatherPreference === 'indoor') indoorCount++;
      else if (rule?.weatherPreference === 'outdoor' || rule?.weatherPreference === 'sunny' || rule?.weatherPreference === 'golden_hour') outdoorCount++;
    }

    let missingBreaksCount = 0;
    if (plannedHours > 5 && breaksCount === 0) missingBreaksCount = 2;
    else if (plannedHours > 3 && breaksCount === 0) missingBreaksCount = 1;

    let score = 100;
    if (walkingKm > 10) score -= 20;
    if (walkingKm > 15) score -= 20;
    if (plannedHours > 10) score -= 20;
    if (missingBreaksCount > 0) score -= 15 * missingBreaksCount;
    score = Math.max(0, score);

    let status: 'balanced' | 'intense' | 'tiring' | 'relaxing' = 'balanced';
    let label = 'Giornata Bilanciata';
    if (score >= 80) { status = 'balanced'; label = 'Giornata Bilanciata'; }
    else if (score >= 60 && score < 80) { status = walkingKm > 8 ? 'intense' : 'relaxing'; label = walkingKm > 8 ? 'Ritmo Intenso' : 'Ritmo Rilassato'; }
    else { status = 'tiring'; label = 'Molto Impegnativa'; }

    const insights: string[] = [];
    if (walkingKm > 10) insights.push('Hai in programma oltre 10 km a piedi oggi.');
    if (missingBreaksCount > 0) insights.push('Mancano pause food o relax tra le tappe.');
    if (outdoorCount > 4) insights.push('Molte attività all\'aperto: verifica il meteo.');
    if (insights.length === 0) insights.push('Il ritmo della giornata è perfettamente calibrato.');

    return { status, label, score, plannedHours, walkingKm, breaksCount, missingBreaksCount, outdoorCount, indoorCount, insights };
  }

  public calculateJourneyQuality(schedule: TimelineDaySchedule): JourneyQuality {
    const health = this.calculateRuntimeHealth(schedule);
    const conflictsCount = schedule.conflicts?.length || 0;
    const score = Math.max(20, Math.min(100, health.score - (conflictsCount * 10)));

    let stars = 5;
    let label = 'Eccellente';
    if (score >= 90) { stars = 5; label = 'Eccellente'; }
    else if (score >= 75) { stars = 4; label = 'Molto buona'; }
    else if (score >= 60) { stars = 3; label = 'Buona'; }
    else if (score >= 40) { stars = 2; label = 'Impegnativa'; }
    else { stars = 1; label = 'Da rivedere'; }

    const reasons = [...health.insights];
    if (conflictsCount > 0) reasons.push(`${conflictsCount} criticità orarie o di distanza rilevate.`);

    return { score, label, stars, reasons };
  }

  public detectFreeTimeSlots(places: PlaceRef[]): FreeTimeSlot[] {
    const slots: FreeTimeSlot[] = [];
    if (places.length <= 1) return slots;

    for (let i = 0; i < places.length - 1; i++) {
      const prev = places[i];
      const next = places[i + 1];

      const prevEndMins = this.parseTime(prev.calculatedEndTime || '09:00');
      const nextStartMins = this.parseTime(next.calculatedStartTime || '10:00');
      const gap = nextStartMins - prevEndMins;

      if (gap >= 30) {
        let context = 'morning_gap';
        if (prevEndMins >= 12 * 60 && prevEndMins < 17 * 60) context = 'afternoon_relax';
        else if (prevEndMins >= 17 * 60) context = 'evening_free';

        slots.push({
          id: `free-${prev.id}-${next.id}`,
          afterPlaceId: prev.id,
          beforePlaceId: next.id,
          startTime: prev.calculatedEndTime || '12:00',
          endTime: next.calculatedStartTime || '13:00',
          durationMinutes: gap,
          coordinates: prev.coordinates,
          context,
        });
      }
    }
    return slots;
  }

  public generateSmartSuggestions(schedule: TimelineDaySchedule, health: DailyHealth, status?: JourneyStatus): JourneySuggestion[] {
    const suggestions: JourneySuggestion[] = [];
    if (status && status.status === 'heavy_delay') {
      suggestions.push({
        id: 'sug-delay',
        type: 'schedule_delay',
        severity: 'critical',
        title: 'Sei molto in ritardo',
        description: `Sulla tabella di marcia hai ${status.differenceMinutes} min di ritardo.`,
        reason: 'Tappa in corso prolungata oltre il previsto.',
        action: { type: 'open_map', label: 'Ricalcola tappe' },
      });
    }
    if (health.missingBreaksCount > 0) {
      suggestions.push({
        id: 'sug-break',
        type: 'missing_break',
        severity: 'important',
        title: 'Hai camminato molto',
        description: 'Ti consiglio di pianificare una sosta ristoratrice.',
        reason: `Supererai circa ${health.walkingKm} km oggi senza pause sufficienti.`,
        action: { type: 'add_break', label: 'Aggiungi una pausa' },
      });
    }
    if (health.walkingKm > 12) {
      suggestions.push({
        id: 'sug-walk',
        type: 'high_walking',
        severity: 'suggestion',
        title: 'Ritmo intenso a piedi',
        description: `Hai in programma ${health.walkingKm} km a piedi. Valuta un mezzo pubblico.`,
        reason: 'Distanza a piedi elevata tra i monumenti.',
        action: { type: 'open_map', label: 'Vedi trasporti' },
      });
    }
    const freeSlots = this.detectFreeTimeSlots(schedule.places || []);
    if (freeSlots.length > 0) {
      suggestions.push({
        id: 'sug-free',
        type: 'free_time',
        severity: 'info',
        title: 'Tempo libero disponibile',
        description: `Hai uno spazio di ${freeSlots[0].durationMinutes} minuti libero tra le attività.`,
        reason: 'Pausa naturale nell\'itinerario.',
        action: { type: 'open_map', label: 'Esplora nei dintorni' },
      });
    }
    if (suggestions.length === 0) {
      suggestions.push({
        id: 'sug-ok',
        type: 'all_good',
        severity: 'success',
        title: 'Tabella di marcia perfetta',
        description: 'Stai rispettando i tempi e l\'esperienza è bilanciata.',
        reason: 'Nessun problema rilevato dal Journey Composer.',
      });
    }
    return suggestions;
  }

  public calculateAvailableMinutes(totalAwakeMinutes = 720, scheduledMinutes: number): number {
    return Math.max(0, totalAwakeMinutes - scheduledMinutes);
  }
}

/**
 * Istanza singleton esportata per essere utilizzata ovunque.
 */
export const journeyComposer = new JourneyComposerService();

/**
 * @deprecated Wrapper statico per retrocompatibilità. Usa l'istanza singleton `journeyComposer`.
 */
export class JourneyComposer {
  public static async compose(options: ComposeJourneyOptions): Promise<TimelineDaySchedule> {
    return journeyComposer.compose(options);
  }
  public static generateDaySchedule(
    dayNumber: number,
    dateStr: string,
    places: PlaceRef[]
  ): TimelineDaySchedule {
    return journeyComposer.generateDaySchedule(dayNumber, dateStr, places);
  }
  public static reorderDaySchedule(
    currentSchedule: TimelineDaySchedule,
    orderedPlaceIds: string[]
  ): TimelineDaySchedule {
    return journeyComposer.reorderDaySchedule(currentSchedule, orderedPlaceIds);
  }
  public static async composeDayJourney(
    currentSchedule: TimelineDaySchedule,
    profileId: string = 'culture',
    customConstraints?: JourneyConstraints,
    anchors?: JourneyAnchor[],
    accommodations?: Accommodation[],
    transports?: Transport[]
  ): Promise<TimelineDaySchedule> {
    return await journeyComposer.composeDayJourney(currentSchedule, profileId, customConstraints, anchors, accommodations, transports);
  }
  public static async composeDayJourneyWithSIP(
    currentSchedule: TimelineDaySchedule,
    profileId: string = 'culture',
    customConstraints?: JourneyConstraints,
    anchors?: JourneyAnchor[],
    accommodations?: Accommodation[],
    transports?: Transport[]
  ): Promise<TimelineDaySchedule> {
    return journeyComposer.composeDayJourneyWithSIP(currentSchedule, profileId, customConstraints, anchors, accommodations, transports);
  }
  public static calculateRuntimeStatus(schedule: TimelineDaySchedule, currentTimeMinutes?: number): JourneyStatus {
    return journeyComposer.calculateRuntimeStatus(schedule, currentTimeMinutes);
  }
  public static calculateRuntimeHealth(schedule: TimelineDaySchedule): DailyHealth {
    return journeyComposer.calculateRuntimeHealth(schedule);
  }
  public static calculateJourneyQuality(schedule: TimelineDaySchedule): JourneyQuality {
    return journeyComposer.calculateJourneyQuality(schedule);
  }
  public static detectFreeTimeSlots(places: PlaceRef[]): FreeTimeSlot[] {
    return journeyComposer.detectFreeTimeSlots(places);
  }
  public static generateSmartSuggestions(schedule: TimelineDaySchedule, health: DailyHealth, status?: JourneyStatus): JourneySuggestion[] {
    return journeyComposer.generateSmartSuggestions(schedule, health, status);
  }
  public static calculateAvailableMinutes(totalAwakeMinutes = 720, scheduledMinutes: number): number {
    return journeyComposer.calculateAvailableMinutes(totalAwakeMinutes, scheduledMinutes);
  }
}
