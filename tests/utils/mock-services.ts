import { RiskAssessment, Transaction } from '../../src/types';
import { createMockRiskAssessment } from './test-helpers';

export class MockLLMService {
  private shouldFail: boolean = false;
  private mockDelay: number = 0;
  private mockRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';

  setFailureMode(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  setMockDelay(delay: number): void {
    this.mockDelay = delay;
  }

  setMockRiskLevel(riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'): void {
    this.mockRiskLevel = riskLevel;
  }

  async assessTransactionRisk(transaction: Transaction): Promise<RiskAssessment> {
    if (this.mockDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.mockDelay));
    }

    if (this.shouldFail) {
      throw new Error('LLM service unavailable');
    }

    const riskScore = this.getRiskScoreByLevel(this.mockRiskLevel);
    
    return createMockRiskAssessment(transaction.id, {
      riskLevel: this.mockRiskLevel,
      riskScore,
      explanation: `Mock ${this.mockRiskLevel} risk assessment for testing`,
      factors: [
        {
          factor: 'mock_factor',
          weight: riskScore,
          description: `Mock risk factor for ${this.mockRiskLevel} risk`
        }
      ],
      recommendations: this.getRecommendationsByRiskLevel(this.mockRiskLevel)
    });
  }

  private getRiskScoreByLevel(level: string): number {
    switch (level) {
      case 'LOW': return 0.2;
      case 'MEDIUM': return 0.5;
      case 'HIGH': return 0.8;
      case 'CRITICAL': return 0.95;
      default: return 0.2;
    }
  }

  private getRecommendationsByRiskLevel(level: string): string[] {
    switch (level) {
      case 'LOW': return ['Process normally'];
      case 'MEDIUM': return ['Consider additional verification'];
      case 'HIGH': return ['Require manual review', 'Additional verification needed'];
      case 'CRITICAL': return ['Block transaction', 'Immediate manual review required'];
      default: return ['Process normally'];
    }
  }

  reset(): void {
    this.shouldFail = false;
    this.mockDelay = 0;
    this.mockRiskLevel = 'LOW';
  }
}

export class MockCacheService {
  private cache: Map<string, any> = new Map();
  private shouldFail: boolean = false;

  setFailureMode(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.shouldFail) {
      throw new Error('Cache service unavailable');
    }
    return this.cache.get(key) || null;
  }

  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    if (this.shouldFail) {
      throw new Error('Cache service unavailable');
    }
    this.cache.set(key, value);
    return true;
  }

  async del(key: string): Promise<boolean> {
    if (this.shouldFail) {
      throw new Error('Cache service unavailable');
    }
    this.cache.delete(key);
    return true;
  }

  async exists(key: string): Promise<boolean> {
    if (this.shouldFail) {
      throw new Error('Cache service unavailable');
    }
    return this.cache.has(key);
  }

  generateKey(prefix: string, ...parts: string[]): string {
    return `${prefix}:${parts.join(':')}`;
  }

  clear(): void {
    this.cache.clear();
  }

  reset(): void {
    this.shouldFail = false;
    this.clear();
  }
}

export class MockEventPublisher {
  private events: Array<{ event: string; data: any; timestamp: Date }> = [];

  publish(event: string, data: any): void {
    this.events.push({
      event,
      data,
      timestamp: new Date()
    });
  }

  subscribe(event: string, listener: (data: any) => void): void {
    // Mock implementation - in real tests we might want to track subscriptions
  }

  getPublishedEvents(): Array<{ event: string; data: any; timestamp: Date }> {
    return [...this.events];
  }

  getEventsByType(eventType: string): Array<{ event: string; data: any; timestamp: Date }> {
    return this.events.filter(e => e.event === eventType);
  }

  clear(): void {
    this.events = [];
  }

  reset(): void {
    this.clear();
  }
}

export class MockCircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private shouldFail: boolean = false;

  setState(state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'): void {
    this.state = state;
  }

  setFailureMode(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      throw new Error('Circuit breaker is OPEN');
    }

    if (this.shouldFail) {
      this.state = 'OPEN';
      throw new Error('Operation failed, circuit breaker opened');
    }

    return await operation();
  }

  getState(): string {
    return this.state;
  }

  reset(): void {
    this.state = 'CLOSED';
    this.shouldFail = false;
  }
}

export const createMockServices = () => {
  return {
    llmService: new MockLLMService(),
    cacheService: new MockCacheService(),
    eventPublisher: new MockEventPublisher(),
    circuitBreaker: new MockCircuitBreaker()
  };
};
