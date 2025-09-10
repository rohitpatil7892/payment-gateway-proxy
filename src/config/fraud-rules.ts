import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { logger } from '../utils/logger';
import { FraudRuleConfig, FraudRule, ProviderConfig, RiskThresholds } from '../types';

export class FraudRuleConfigService {
  private config!: FraudRuleConfig;
  private static instance: FraudRuleConfigService;

  private constructor() {
    this.loadConfig();
  }

  public static getInstance(): FraudRuleConfigService {
    if (!FraudRuleConfigService.instance) {
      FraudRuleConfigService.instance = new FraudRuleConfigService();
    }
    return FraudRuleConfigService.instance;
  }

  private loadConfig(): void {
    try {
      const configPath = path.join(__dirname, '../../config/fraud-rules.yml');
      const configFile = fs.readFileSync(configPath, 'utf8');
      this.config = yaml.load(configFile) as FraudRuleConfig;
      
      logger.info('Fraud rules configuration loaded successfully', {
        rulesCount: this.config.rules.length,
        providersCount: this.config.providers.length
      });
    } catch (error) {
      logger.error('Failed to load fraud rules configuration', error);
      // Load default configuration
      this.config = this.getDefaultConfig();
    }
  }

  private getDefaultConfig(): FraudRuleConfig {
    return {
      rules: [
        {
          name: 'high_amount_rule',
          enabled: true,
          weight: 0.3,
          action: 'flag',
          conditions: [{
            field: 'amount',
            operator: 'gt',
            value: 100000,
            description: 'Transaction amount exceeds $1000'
          }]
        }
      ],
      providers: [
        { name: 'paypal', priority: 1, riskTolerance: 'medium', enabled: true },
        { name: 'stripe', priority: 2, riskTolerance: 'low', enabled: true }
      ],
      thresholds: {
        low: 0.3,
        medium: 0.6,
        high: 0.8,
        critical: 0.9
      }
    };
  }

  public getRules(): FraudRule[] {
    return this.config.rules.filter(rule => rule.enabled);
  }

  public getProviders(): ProviderConfig[] {
    return this.config.providers
      .filter(provider => provider.enabled)
      .sort((a, b) => a.priority - b.priority);
  }

  public getThresholds(): RiskThresholds {
    return this.config.thresholds;
  }

  public reloadConfig(): void {
    this.loadConfig();
  }

  public evaluateRiskFromRules(transaction: any): {
    score: number;
    factors: Array<{ factor: string; weight: number; description: string }>;
    blockedRules: string[];
  } {
    let totalScore = 0;
    const factors: Array<{ factor: string; weight: number; description: string }> = [];
    const blockedRules: string[] = [];

    for (const rule of this.getRules()) {
      const ruleMatches = rule.conditions.every(condition => 
        this.evaluateCondition(condition, transaction)
      );

      if (ruleMatches) {
        totalScore += rule.weight;
        factors.push({
          factor: rule.name,
          weight: rule.weight,
          description: rule.conditions.map(c => c.description).join(', ')
        });

        if (rule.action === 'block') {
          blockedRules.push(rule.name);
        }
      }
    }

    return {
      score: Math.min(1.0, totalScore),
      factors,
      blockedRules
    };
  }

  private evaluateCondition(condition: any, transaction: any): boolean {
    const fieldValue = this.getFieldValue(condition.field, transaction);
    
    switch (condition.operator) {
      case 'gt':
        return fieldValue > condition.value;
      case 'lt':
        return fieldValue < condition.value;
      case 'eq':
        return fieldValue === condition.value;
      case 'contains':
        return String(fieldValue).includes(condition.value);
      case 'regex':
        return new RegExp(condition.value).test(String(fieldValue));
      default:
        return false;
    }
  }

  private getFieldValue(field: string, transaction: any): any {
    if (field === 'timestamp') {
      const day = new Date().getDay();
      return (day === 0 || day === 6) ? 'weekend' : 'weekday';
    }
    return transaction[field];
  }

  public selectProvider(riskScore: number): string {
    const providers = this.getProviders();
    
    for (const provider of providers) {
      const tolerance = this.getRiskToleranceThreshold(provider.riskTolerance);
      if (riskScore <= tolerance) {
        return provider.name;
      }
    }
    
    // Fallback to the most risk-tolerant provider
    return providers[providers.length - 1]?.name || 'paypal';
  }

  private getRiskToleranceThreshold(tolerance: string): number {
    switch (tolerance) {
      case 'low': return 0.3;
      case 'medium': return 0.6;
      case 'high': return 0.8;
      default: return 0.6;
    }
  }
}

export const fraudRuleConfigService = FraudRuleConfigService.getInstance();
