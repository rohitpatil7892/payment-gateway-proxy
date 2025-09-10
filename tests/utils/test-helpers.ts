import { Transaction, TransactionStatus, RiskAssessment } from '../../src/types';
import { generateTransactionId } from '../../src/utils/uuid';
import { generateToken } from '../../src/utils/jwt';

export const createMockTransaction = (overrides?: Partial<Transaction>): Transaction => {
  return {
    id: generateTransactionId(),
    amount: 10000, // $100.00
    currency: 'USD',
    source: 'test-source',
    email: 'test@example.com',
    status: TransactionStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
};

export const createMockRiskAssessment = (transactionId: string, overrides?: Partial<RiskAssessment>): RiskAssessment => {
  return {
    transactionId,
    riskScore: 0.2,
    riskLevel: 'LOW',
    explanation: 'Low risk transaction based on customer history and transaction patterns.',
    factors: [
      {
        factor: 'amount_normal',
        weight: 0.1,
        description: 'Transaction amount within normal range'
      },
      {
        factor: 'customer_history',
        weight: 0.1,
        description: 'Customer has good transaction history'
      }
    ],
    recommendations: ['Process normally'],
    assessedAt: new Date(),
    ...overrides
  };
};

export const createValidPaymentRequest = (overrides?: any) => {
  return {
    amount: 10000,
    currency: 'USD',
    source: 'test-source',
    email: 'test@example.com',
    ...overrides
  };
};

export const createValidAuthRequest = (overrides?: any) => {
  return {
    clientId: process.env.CLIENT_ID || 'test-client',
    clientSecret: process.env.CLIENT_SECRET || 'test-secret-key',
    ...overrides
  };
};

export const generateValidToken = (clientId: string = 'test-client'): string => {
  return generateToken(clientId);
};

export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const expectValidTransactionResponse = (response: any) => {
  expect(response.success).toBe(true);
  expect(response.data.transactionId).toMatch(/^txn_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(response.data.status).toMatch(/^(PENDING|PROCESSING|SUCCESS|FAILED)$/);
};

export const expectValidRiskAssessment = (riskAssessment: any) => {
  expect(riskAssessment).toBeDefined();
  expect(riskAssessment.riskLevel).toMatch(/^(LOW|MEDIUM|HIGH|CRITICAL)$/);
  expect(typeof riskAssessment.riskScore).toBe('number');
  expect(riskAssessment.explanation).toBeDefined();
  expect(Array.isArray(riskAssessment.factors)).toBe(true);
  expect(Array.isArray(riskAssessment.recommendations)).toBe(true);
};

export const expectValidErrorResponse = (response: any, expectedStatus?: number) => {
  expect(response.success).toBe(false);
  expect(response.error).toBeDefined();
  if (expectedStatus) {
    expect(response.status).toBe(expectedStatus);
  }
};

// Test data generators for various scenarios
export const TestData = {
  // Valid test cases
  validCardPayment: createValidPaymentRequest(),
  
  // High risk scenarios
  highAmountPayment: createValidPaymentRequest({ amount: 500000 }), // $5000
  weekendPayment: createValidPaymentRequest({ source: 'weekend' }),
  
  // Invalid test cases
  invalidAmountPayment: createValidPaymentRequest({ amount: -100 }),
  invalidCurrencyPayment: createValidPaymentRequest({ currency: 'INVALID' }),
  missingSourcePayment: { ...createValidPaymentRequest(), source: undefined },
  invalidEmailPayment: createValidPaymentRequest({ email: 'invalid-email' }),
  
  // Edge cases
  zeroAmountPayment: createValidPaymentRequest({ amount: 0 }),
  maxAmountPayment: createValidPaymentRequest({ amount: 1000000 }),
  
  // Authentication test cases
  validAuthCredentials: createValidAuthRequest(),
  invalidClientId: createValidAuthRequest({ clientId: 'invalid-client' }),
  invalidClientSecret: createValidAuthRequest({ clientSecret: 'invalid-secret' }),
  missingCredentials: { clientId: '', clientSecret: '' }
};
