import { DomainEvent, DomainFactType } from '../engines/types/events.types';

type EventHandler<T = any> = (event: DomainEvent<T>) => void;

/**
 * ============================================================================
 * DOMAIN EVENT BUS
 * ============================================================================
 * Sistema di comunicazione Pub/Sub disaccoppiato tra gli Engine di Travel OS.
 * Assicura che i motori non abbiano dipendenze orizzontali o chiamate dirette.
 * Accetta ESCLUSIVAMENTE Domain Facts rigorosi.
 */
class DomainEventBus {
  private subscribers: Map<DomainFactType | '*', Set<EventHandler>> = new Map();

  /**
   * Pubblica un fatto di dominio sull'Event Bus.
   */
  public publish<T>(event: DomainEvent<T>): void {
    // Notifica i subscriber specifici del tipo di evento
    const specificHandlers = this.subscribers.get(event.type);
    if (specificHandlers) {
      specificHandlers.forEach((handler) => {
        try {
          handler(event);
        } catch (error) {
          console.error(`[DomainEventBus] Error in handler for ${event.type}:`, error);
        }
      });
    }

    // Notifica i subscriber globali ('*') - es. per logging, audit o Context Engine refresh globale
    const globalHandlers = this.subscribers.get('*');
    if (globalHandlers) {
      globalHandlers.forEach((handler) => {
        try {
          handler(event);
        } catch (error) {
          console.error(`[DomainEventBus] Error in wildcard handler:`, error);
        }
      });
    }
  }

  /**
   * Sottoscrive un handler a uno o tutti ('*') i fatti di dominio.
   * Ritorna una funzione di unsubscribe.
   */
  public subscribe<T>(eventType: DomainFactType | '*', handler: (event: DomainEvent<T>) => void): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    
    const handlers = this.subscribers.get(eventType)!;
    handlers.add(handler as EventHandler);

    return () => {
      handlers.delete(handler as EventHandler);
      if (handlers.size === 0) {
        this.subscribers.delete(eventType);
      }
    };
  }

  /**
   * Pulisce tutte le sottoscrizioni (utile nei test o re-init del sistema).
   */
  public clearAllSubscribers(): void {
    this.subscribers.clear();
  }
}

// Esporta l'istanza singleton per l'intero ciclo di vita di Travel OS
export const eventBus = new DomainEventBus();
