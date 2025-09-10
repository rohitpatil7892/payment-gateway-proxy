export interface PaymentRequest {
  amount: number;
  currency: string;
  source: string;
  email: string;
}

export interface PaymentResponse {
  transactionId: string;
  provider: string;
  status: string;
  riskScore: number;
  explanation: string;
}

export interface Transaction {
  id: string;
  amount: number;
  currency: string;
  source: string;
  email: string;
  provider?: string;
  status: TransactionStatus;
  riskScore?: number;
  explanation?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum TransactionStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  PENDING = 'pending',
  PROCESSING = 'processing'
}

export interface RiskAssessment {
  transactionId: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  explanation: string;
  factors: RiskFactor[];
  recommendations: string[];
  assessedAt: Date;
}

export interface RiskFactor {
  factor: string;
  weight: number;
  description: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface FraudRule {
  name: string;
  enabled: boolean;
  weight: number;
  conditions: FraudCondition[];
  action: 'flag' | 'block' | 'review';
}

export interface FraudCondition {
  field: string;
  operator: 'gt' | 'lt' | 'eq' | 'contains' | 'regex';
  value: any;
  description: string;
}

export interface FraudRuleConfig {
  rules: FraudRule[];
  providers: ProviderConfig[];
  thresholds: RiskThresholds;
}

export interface ProviderConfig {
  name: string;
  priority: number;
  riskTolerance: 'low' | 'medium' | 'high';
  enabled: boolean;
}

export interface RiskThresholds {
  low: number;
  medium: number;
  high: number;
  critical: number;
}
