import { logger } from './logger';

export interface EventData {
  timestamp: Date;
  source: string;
  [key: string]: any;
}

export class EventPublisher {
  private listeners: Map<string, Array<(data: EventData) => void>> = new Map();
  private static instance: EventPublisher;

  public static getInstance(): EventPublisher {
    if (!EventPublisher.instance) {
      EventPublisher.instance = new EventPublisher();
    }
    return EventPublisher.instance;
  }

  subscribe(event: string, listener: (data: EventData) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
    logger.info(`Event listener subscribed to ${event}`);
  }

  publish(event: string, data: Omit<EventData, 'timestamp'>): void {
    const eventData: EventData = {
      ...data,
      timestamp: new Date(),
      source: data.source
    };

    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => {
        try {
          listener(eventData);
        } catch (error) {
          logger.error(`Error in event listener for ${event}`, error);
        }
      });
    }

    logger.debug(`Event published: ${event}`, eventData);
  }
}

// Event constants
export const EVENTS = {
  TRANSACTION_CREATED: 'transaction.created',
  TRANSACTION_UPDATED: 'transaction.updated',
  DECISION_BLOCKED: 'decision.blocked',
  PAYMENT_PROCESSED: 'payment.processed',
  RISK_ASSESSED: 'risk.assessed',
  LLM_CALL_FAILED: 'llm.call.failed',
  CIRCUIT_BREAKER_OPENED: 'circuit.breaker.opened'
};

export const eventPublisher = EventPublisher.getInstance();
