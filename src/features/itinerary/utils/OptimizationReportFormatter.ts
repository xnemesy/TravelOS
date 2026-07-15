import { OptimizationEvent, OptimizationReport } from '../../../core/engines/types/context.types';

export interface FormattedOptimizationItem {
  id: string;
  icon: string;
  title: string;
  description?: string;
}

export class OptimizationReportFormatter {
  public static formatEvent(event: OptimizationEvent, index: number): FormattedOptimizationItem {
    switch (event.type) {
      case 'REDUCED_WALKING':
        return {
          id: `evt-${index}`,
          icon: 'walk-outline',
          title: event.delta ? `Risparmiati ${event.delta} km a piedi` : 'Ottimizzato il percorso a piedi',
          description: 'Ridisposte le tappe per minimizzare la fatica e i tempi di spostamento.',
        };
      case 'INSERTED_LUNCH':
        return {
          id: `evt-${index}`,
          icon: 'restaurant-outline',
          title: 'Aggiunta pausa pranzo strategica',
          description: 'Inserito uno spazio di ricarica nella finestra oraria ideale.',
        };
      case 'INSERTED_DINNER':
        return {
          id: `evt-${index}`,
          icon: 'wine-outline',
          title: 'Aggiunta cena in fascia serale',
          description: 'Riservato il giusto tempo per la cena al termine delle attività.',
        };
      case 'REORDERED_LOGICALLY':
        return {
          id: `evt-${index}`,
          icon: 'map-outline',
          title: event.delta ? `Riordinate ${event.delta} tappe` : 'Tappe ordinate geograficamente',
          description: 'Successione logica delle visite in base a vicinanza e orari di apertura.',
        };
      case 'RESOLVED_CONFLICTS':
        return {
          id: `evt-${index}`,
          icon: 'checkmark-circle-outline',
          title: 'Risolti i conflitti orari',
          description: 'Eliminate sovrapposizioni e ritmi di camminata eccessivi.',
        };
      case 'BALANCED_ENERGY':
      default:
        return {
          id: `evt-${index}`,
          icon: 'sparkles-outline',
          title: 'Ritmo equilibrato',
          description: 'Alternanza ottimale tra attività intense e momenti di relax.',
        };
    }
  }

  public static formatReport(report: OptimizationReport): FormattedOptimizationItem[] {
    if (!report.events || report.events.length === 0) {
      const fallback: FormattedOptimizationItem[] = [];
      if (report.savedDistanceKm && report.savedDistanceKm > 0) {
        fallback.push({
          id: 'fb-dist',
          icon: 'walk-outline',
          title: `Risparmiati ${report.savedDistanceKm.toFixed(1)} km a piedi`,
          description: 'Percorso ricalcolato per ridurre la camminata.',
        });
      }
      if (report.insertedMeals && report.insertedMeals > 0) {
        fallback.push({
          id: 'fb-meals',
          icon: 'restaurant-outline',
          title: `Inserite ${report.insertedMeals} pause pasti`,
          description: 'Soste alimentari posizionate nelle ore ideali.',
        });
      }
      if (fallback.length === 0) {
        fallback.push({
          id: 'fb-ok',
          icon: 'sparkles-outline',
          title: 'Itinerario ottimizzato',
          description: 'Tappe organizzate secondo le regole del Journey Engine.',
        });
      }
      return fallback;
    }

    return report.events.map((evt, idx) => this.formatEvent(evt, idx));
  }

  public static generateWhyDayWorks(places: any[], totalWalkDistanceMeters?: number): string {
    if (!places || places.length === 0) return '';
    const realVisits = places.filter(p => 
      !p.isBlock && 
      !p.journeyAnchorKind && 
      p.category !== 'hotel' && 
      p.category !== 'transfer' && 
      p.category !== 'breakfast' && 
      p.category !== 'lunch' && 
      p.category !== 'dinner' && 
      p.category !== 'drinks' && 
      p.category !== 'free_time'
    );

    const firstItemTime = places[0]?.calculatedStartTime || places[0]?.scheduledTime || '';
    let startHours = 9;
    if (typeof firstItemTime === 'string' && firstItemTime.includes(':')) {
      startHours = parseInt(firstItemTime.split(':')[0], 10);
    } else if (firstItemTime instanceof Date) {
      startHours = firstItemTime.getHours();
    } else if (typeof firstItemTime === 'string' && firstItemTime.includes('T')) {
      startHours = new Date(firstItemTime).getHours();
    }

    if (realVisits.length === 0) {
      const hasArrival = places.some(p => p.journeyAnchorKind && p.journeyAnchorKind.includes('arrival'));
      if (startHours >= 20 || (hasArrival && startHours >= 18)) {
        return "Oggi il viaggio è dedicato all'arrivo. Hai poco tempo utile prima della notte, quindi il planner ha evitato di programmare visite e ti accompagna direttamente verso l'alloggio per iniziare il viaggio riposato.";
      }
      return "Nessuna esperienza è stata pianificata perché il tempo disponibile non consentirebbe una visita completa e rilassata. Il percorso si concentra sugli spostamenti e sulla logistica del viaggio.";
    }

    const firstPlace = realVisits[0];
    const secondPlace = realVisits[1];
    
    let text = "";
    const nameLower = firstPlace.name ? firstPlace.name.toLowerCase() : "";
    
    const firstVisitTime = firstPlace.calculatedStartTime || firstPlace.scheduledTime || '';
    let firstVisitHours = startHours;
    if (typeof firstVisitTime === 'string' && firstVisitTime.includes(':')) {
      firstVisitHours = parseInt(firstVisitTime.split(':')[0], 10);
    } else if (firstVisitTime instanceof Date) {
      firstVisitHours = firstVisitTime.getHours();
    } else if (typeof firstVisitTime === 'string' && firstVisitTime.includes('T')) {
      firstVisitHours = new Date(firstVisitTime).getHours();
    }

    if (firstVisitHours >= 14) {
      if (nameLower.includes('parlamento') || nameLower.includes('museo') || nameLower.includes('basilica') || nameLower.includes('castello') || nameLower.includes('galleria') || firstPlace.category === 'museum') {
        text += `Ho iniziato da ${firstPlace.name} nel momento migliore per visitarlo ottimizzando i tempi di attesa e l'afflusso.`;
      } else {
        text += `Ho posizionato ${firstPlace.name} come prima tappa del pomeriggio/serata per sfruttare al meglio le ore disponibili.`;
      }
    } else {
      if (nameLower.includes('parlamento') || nameLower.includes('museo') || nameLower.includes('basilica') || nameLower.includes('castello') || nameLower.includes('galleria') || firstPlace.category === 'museum') {
        text += `Ho iniziato da ${firstPlace.name} perché apre presto al mattino ed è il momento ideale per visitarlo con meno affollamento e tempi di attesa ridotti.`;
      } else {
        text += `Ho posizionato ${firstPlace.name} come prima tappa per avviare la giornata al meglio sfruttando le ore più fresche e tranquille del mattino.`;
      }
    }

    if (secondPlace) {
      const secLower = secondPlace.name ? secondPlace.name.toLowerCase() : "";
      if (secondPlace.category === 'sunset' || secLower.includes('bastione') || secLower.includes('pescatori') || secLower.includes('panoram') || secLower.includes('monte') || secLower.includes('collina') || secLower.includes('tramonto')) {
        text += ` ${secondPlace.name} è stato programmato prima di pranzo e nelle ore di ottima visibilità per sfruttare la luce migliore e ammirare il panorama.`;
      } else {
        text += ` ${secondPlace.name} si innesta perfettamente lungo il percorso logico per ridurre al minimo i tempi di transito.`;
      }
    }

    const hasBreaks = places.some(p => p.category === 'lunch' || p.category === 'free_time' || p.category === 'drinks' || p.category === 'dinner');
    if (hasBreaks) {
      text += " Ho inserito pause strategiche nelle finestre di maggior affaticamento";
    } else {
      text += " I tempi tra una visita e l'altra sono stati bilanciati";
    }

    if (totalWalkDistanceMeters !== undefined && totalWalkDistanceMeters > 0) {
      const km = (totalWalkDistanceMeters / 1000).toFixed(1).replace('.', ',');
      text += ` e ridotto gli spostamenti a piedi (circa ${km} km totali) per mantenere un ritmo piacevole e sostenibile.`;
    } else {
      text += " e ridotto al minimo gli spostamenti a piedi per non affaticare il passo.";
    }

    return text;
  }
}
