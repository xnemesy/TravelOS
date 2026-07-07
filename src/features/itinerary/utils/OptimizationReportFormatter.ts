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
    const mainAttractions = places.filter(p => p.category !== 'breakfast' && p.category !== 'lunch' && p.category !== 'dinner' && p.category !== 'drinks' && p.category !== 'free_time');
    
    if (mainAttractions.length === 0) {
      return "Ho strutturato questa giornata per lasciarti il massimo respiro, riducendo gli spostamenti e permettendoti di godere l'atmosfera della città con ritmi lenti e rilassati.";
    }

    const firstPlace = mainAttractions[0];
    const secondPlace = mainAttractions[1];
    
    let text = "";
    const nameLower = firstPlace.name ? firstPlace.name.toLowerCase() : "";
    
    if (nameLower.includes('parlamento') || nameLower.includes('museo') || nameLower.includes('basilica') || nameLower.includes('castello') || nameLower.includes('galleria') || firstPlace.category === 'museum') {
      text += `Ho iniziato da ${firstPlace.name} perché apre presto al mattino ed è il momento ideale per visitarlo con meno affollamento e tempi di attesa ridotti.`;
    } else {
      text += `Ho posizionato ${firstPlace.name} come prima tappa per avviare la giornata al meglio sfruttando le ore più fresche e tranquille del mattino.`;
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
