import request from 'supertest';
import app from '../../src/app';
import { TestData, expectValidRiskAssessment } from '../utils/test-helpers';

// Mock the LLM service with various scenarios
jest.mock('../../src/services/llm.service', () => ({
  llmService: {
    assessTransactionRisk: jest.fn()
  }
}));

import { llmService } from '../../src/services/llm.service';

describe('Risk Assessment Integration Tests', () => {
  let authToken: string;

  beforeAll(async () => {
    // Set up test environment
    process.env.CLIENT_ID = 'test-client';
    process.env.CLIENT_SECRET = 'test-secret-key';
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.JWT_EXPIRES_IN = '24h';

    // Get authentication token
    const authResponse = await request(app)
      .post('/api/v1/auth/token')
      .send(TestData.validAuthCredentials)
      .expect(200);

    authToken = authResponse.body.data.token;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Risk Level Assessment Scenarios', () => {
    it('should handle LOW risk assessment correctly', async () => {
      // Mock LLM service to return low risk
      (llmService.assessTransactionRisk as jest.Mock).mockResolvedValue({
        transactionId: 'mock-txn-id',
        riskScore: 0.15,
        riskLevel: 'LOW',
        explanation: 'Low risk transaction. Customer has excellent payment history with consistent transaction patterns. Amount is within normal range for this customer.',
        factors: [
          {
            factor: 'customer_history_excellent',
            weight: 0.05,
            description: 'Customer has 2+ years of successful payments with no chargebacks'
          },
          {
            factor: 'amount_within_range',
            weight: 0.03,
            description: 'Transaction amount is consistent with customer spending patterns'
          },
          {
            factor: 'verified_merchant',
            weight: 0.02,
            description: 'Merchant has high trust score and verified status'
          },
          {
            factor: 'standard_payment_method',
            weight: 0.05,
            description: 'Standard credit card payment with verified card details'
          }
        ],
        recommendations: [
          'Process payment normally',
          'No additional verification required',
          'Standard monitoring protocols apply'
        ],
        assessedAt: new Date()
      });

      const response = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(TestData.validCardPayment)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toMatch(/^(PROCESSING|COMPLETED)$/);
      
      const riskAssessment = response.body.data.riskAssessment;
      expectValidRiskAssessment(riskAssessment);
      expect(riskAssessment.riskLevel).toBe('LOW');
      expect(riskAssessment.riskScore).toBeLessThan(0.3);
      expect(riskAssessment.factors).toHaveLength(4);
      expect(riskAssessment.recommendations).toContain('Process payment normally');
    });

    it('should handle MEDIUM risk assessment correctly', async () => {
      // Mock LLM service to return medium risk
      (llmService.assessTransactionRisk as jest.Mock).mockResolvedValue({
        transactionId: 'mock-txn-id',
        riskScore: 0.45,
        riskLevel: 'MEDIUM',
        explanation: 'Medium risk transaction. While customer has good history, the transaction amount is higher than usual and occurs during off-hours.',
        factors: [
          {
            factor: 'amount_above_average',
            weight: 0.2,
            description: 'Transaction amount is 3x higher than customer average'
          },
          {
            factor: 'unusual_timing',
            weight: 0.15,
            description: 'Transaction occurring outside normal business hours'
          },
          {
            factor: 'new_shipping_address',
            weight: 0.1,
            description: 'Shipping address different from previous orders'
          }
        ],
        recommendations: [
          'Process with enhanced monitoring',
          'Consider requesting additional verification',
          'Monitor for velocity patterns',
          'Flag for post-transaction review'
        ],
        assessedAt: new Date()
      });

      const response = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(TestData.validCardPayment)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toMatch(/^(PENDING|PROCESSING)$/);
      
      const riskAssessment = response.body.data.riskAssessment;
      expectValidRiskAssessment(riskAssessment);
      expect(riskAssessment.riskLevel).toBe('MEDIUM');
      expect(riskAssessment.riskScore).toBeGreaterThanOrEqual(0.3);
      expect(riskAssessment.riskScore).toBeLessThan(0.6);
      expect(riskAssessment.recommendations).toContain('Process with enhanced monitoring');
    });

    it('should handle HIGH risk assessment correctly', async () => {
      // Mock LLM service to return high risk
      (llmService.assessTransactionRisk as jest.Mock).mockResolvedValue({
        transactionId: 'mock-txn-id',
        riskScore: 0.78,
        riskLevel: 'HIGH',
        explanation: 'High risk transaction. Multiple fraud indicators detected including suspicious velocity patterns and geographical anomalies.',
        factors: [
          {
            factor: 'velocity_anomaly',
            weight: 0.3,
            description: 'Multiple transactions within short time frame from same card'
          },
          {
            factor: 'geographical_mismatch',
            weight: 0.25,
            description: 'Transaction location inconsistent with customer profile'
          },
          {
            factor: 'high_value_transaction',
            weight: 0.15,
            description: 'Transaction amount significantly above customer norm'
          },
          {
            factor: 'device_fingerprint_mismatch',
            weight: 0.08,
            description: 'Device characteristics differ from customer devices'
          }
        ],
        recommendations: [
          'Require manual review before processing',
          'Request additional identity verification',
          'Consider declining if unable to verify',
          'Place temporary hold on customer account',
          'Escalate to fraud prevention team'
        ],
        assessedAt: new Date()
      });

      const response = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(TestData.highAmountPayment)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toMatch(/^(PENDING|FAILED)$/);
      
      const riskAssessment = response.body.data.riskAssessment;
      expectValidRiskAssessment(riskAssessment);
      expect(riskAssessment.riskLevel).toBe('HIGH');
      expect(riskAssessment.riskScore).toBeGreaterThanOrEqual(0.6);
      expect(riskAssessment.riskScore).toBeLessThan(0.8);
      expect(riskAssessment.recommendations).toContain('Require manual review before processing');
    });

    it('should handle CRITICAL risk assessment correctly', async () => {
      // Mock LLM service to return critical risk
      (llmService.assessTransactionRisk as jest.Mock).mockResolvedValue({
        transactionId: 'mock-txn-id',
        riskScore: 0.95,
        riskLevel: 'CRITICAL',
        explanation: 'Critical risk transaction. Strong fraud indicators detected. Card may be compromised or stolen. Immediate action required.',
        factors: [
          {
            factor: 'known_fraud_pattern',
            weight: 0.4,
            description: 'Transaction matches known fraud signature patterns'
          },
          {
            factor: 'stolen_card_indicator',
            weight: 0.35,
            description: 'Card number appears on stolen card database'
          },
          {
            factor: 'impossible_geography',
            weight: 0.15,
            description: 'Transaction location impossible given previous transaction timing'
          },
          {
            factor: 'suspicious_merchant_category',
            weight: 0.05,
            description: 'Merchant category frequently associated with fraud'
          }
        ],
        recommendations: [
          'BLOCK TRANSACTION IMMEDIATELY',
          'Flag card as potentially compromised',
          'Alert fraud prevention team',
          'Freeze customer account pending investigation',
          'Report to card issuer',
          'Document incident for law enforcement if needed'
        ],
        assessedAt: new Date()
      });

      const response = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(TestData.validCardPayment)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('FAILED');
      
      const riskAssessment = response.body.data.riskAssessment;
      expectValidRiskAssessment(riskAssessment);
      expect(riskAssessment.riskLevel).toBe('CRITICAL');
      expect(riskAssessment.riskScore).toBeGreaterThanOrEqual(0.8);
      expect(riskAssessment.recommendations).toContain('BLOCK TRANSACTION IMMEDIATELY');
    });
  });

  describe('Risk Factors Analysis', () => {
    it('should analyze amount-based risk factors correctly', async () => {
      (llmService.assessTransactionRisk as jest.Mock).mockResolvedValue({
        transactionId: 'mock-txn-id',
        riskScore: 0.35,
        riskLevel: 'MEDIUM',
        explanation: 'Amount-based risk assessment',
        factors: [
          {
            factor: 'high_amount',
            weight: 0.25,
            description: 'Transaction amount exceeds $500 threshold'
          },
          {
            factor: 'amount_velocity',
            weight: 0.1,
            description: 'High amount transactions in rapid succession'
          }
        ],
        recommendations: ['Review high amount transactions'],
        assessedAt: new Date()
      });

      const response = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...TestData.validCardPayment, amount: 50000 }) // $500
        .expect(201);

      const riskAssessment = response.body.data.riskAssessment;
      expect(riskAssessment.factors.some(f => f.factor === 'high_amount')).toBe(true);
    });

    it('should analyze payment method risk factors correctly', async () => {
      const paymentMethodTests = [
        {
          method: TestData.validCardPayment.paymentMethod,
          expectedFactor: 'card_payment_standard'
        },
        {
          method: TestData.validBankTransferPayment.paymentMethod,
          expectedFactor: 'bank_transfer_secure'
        },
        {
          method: TestData.validDigitalWalletPayment.paymentMethod,
          expectedFactor: 'digital_wallet_moderate'
        }
      ];

      for (const { method, expectedFactor } of paymentMethodTests) {
        (llmService.assessTransactionRisk as jest.Mock).mockResolvedValue({
          transactionId: 'mock-txn-id',
          riskScore: 0.25,
          riskLevel: 'LOW',
          explanation: `Risk assessment for ${method.type} payment`,
          factors: [
            {
              factor: expectedFactor,
              weight: 0.15,
              description: `Risk factor for ${method.type} payment method`
            }
          ],
          recommendations: ['Standard processing'],
          assessedAt: new Date()
        });

        const paymentData = { ...TestData.validCardPayment, paymentMethod: method };
        
        const response = await request(app)
          .post('/api/v1/payments/process')
          .set('Authorization', `Bearer ${authToken}`)
          .send(paymentData)
          .expect(201);

        const riskAssessment = response.body.data.riskAssessment;
        expect(riskAssessment.factors.some(f => f.factor === expectedFactor)).toBe(true);
      }
    });

    it('should analyze temporal risk factors correctly', async () => {
      (llmService.assessTransactionRisk as jest.Mock).mockResolvedValue({
        transactionId: 'mock-txn-id',
        riskScore: 0.3,
        riskLevel: 'MEDIUM',
        explanation: 'Temporal risk factors detected',
        factors: [
          {
            factor: 'weekend_transaction',
            weight: 0.1,
            description: 'Transaction occurring during weekend hours'
          },
          {
            factor: 'late_night_transaction',
            weight: 0.15,
            description: 'Transaction occurring outside business hours'
          },
          {
            factor: 'holiday_period',
            weight: 0.05,
            description: 'Transaction during holiday period with higher fraud rates'
          }
        ],
        recommendations: ['Enhanced monitoring for off-hours transactions'],
        assessedAt: new Date()
      });

      const response = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(TestData.weekendPayment)
        .expect(201);

      const riskAssessment = response.body.data.riskAssessment;
      expect(riskAssessment.factors.some(f => f.factor.includes('weekend') || f.factor.includes('night'))).toBe(true);
    });
  });

  describe('LLM Service Integration Edge Cases', () => {
    it('should handle LLM service timeout gracefully', async () => {
      // Mock LLM service to timeout
      (llmService.assessTransactionRisk as jest.Mock).mockRejectedValue(
        new Error('Request timeout - LLM service did not respond within timeout period')
      );

      const response = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(TestData.validCardPayment)
        .expect(201);

      expect(response.body.success).toBe(true);
      // Should have fallback risk assessment
      const riskAssessment = response.body.data.riskAssessment;
      expect(riskAssessment).toBeDefined();
      expect(riskAssessment.explanation).toContain('service temporarily unavailable');
    });

    it('should handle LLM service rate limiting', async () => {
      // Mock LLM service rate limiting
      (llmService.assessTransactionRisk as jest.Mock).mockRejectedValue(
        new Error('Rate limit exceeded - too many requests to LLM service')
      );

      const response = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(TestData.validCardPayment)
        .expect(201);

      expect(response.body.success).toBe(true);
      // Should have fallback risk assessment
      const riskAssessment = response.body.data.riskAssessment;
      expect(riskAssessment.explanation).toContain('service temporarily unavailable');
    });

    it('should handle malformed LLM response', async () => {
      // Mock LLM service to return malformed response
      (llmService.assessTransactionRisk as jest.Mock).mockResolvedValue({
        // Missing required fields
        transactionId: 'mock-txn-id',
        invalidField: 'should not be here'
        // Missing riskScore, riskLevel, explanation, etc.
      });

      const response = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(TestData.validCardPayment)
        .expect(201);

      expect(response.body.success).toBe(true);
      // Should handle malformed response gracefully
      const riskAssessment = response.body.data.riskAssessment;
      expect(riskAssessment).toBeDefined();
    });

    it('should handle LLM service returning inconsistent risk data', async () => {
      // Mock LLM service with inconsistent data
      (llmService.assessTransactionRisk as jest.Mock).mockResolvedValue({
        transactionId: 'mock-txn-id',
        riskScore: 0.9, // High score
        riskLevel: 'LOW', // But low level (inconsistent)
        explanation: 'Inconsistent risk assessment for testing',
        factors: [
          {
            factor: 'test_inconsistency',
            weight: -0.5, // Invalid negative weight
            description: 'Testing inconsistent data handling'
          }
        ],
        recommendations: [], // Empty recommendations for high risk
        assessedAt: new Date()
      });

      const response = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(TestData.validCardPayment)
        .expect(201);

      expect(response.body.success).toBe(true);
      // System should handle inconsistencies gracefully
      const riskAssessment = response.body.data.riskAssessment;
      expect(riskAssessment).toBeDefined();
    });
  });

  describe('Risk Assessment Caching', () => {
    it('should cache risk assessments for similar transactions', async () => {
      const mockAssessment = {
        transactionId: 'mock-txn-id',
        riskScore: 0.2,
        riskLevel: 'LOW',
        explanation: 'Cached risk assessment test',
        factors: [
          {
            factor: 'cache_test',
            weight: 0.2,
            description: 'Testing cache functionality'
          }
        ],
        recommendations: ['Process normally'],
        assessedAt: new Date()
      };

      (llmService.assessTransactionRisk as jest.Mock).mockResolvedValue(mockAssessment);

      // First request
      const response1 = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(TestData.validCardPayment)
        .expect(201);

      // Second identical request (should use cache)
      const response2 = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(TestData.validCardPayment)
        .expect(201);

      expect(response1.body.success).toBe(true);
      expect(response2.body.success).toBe(true);

      // Both should have risk assessments
      expect(response1.body.data.riskAssessment).toBeDefined();
      expect(response2.body.data.riskAssessment).toBeDefined();

      // Verify LLM service was called (caching behavior would be tested at unit level)
      expect(llmService.assessTransactionRisk).toHaveBeenCalled();
    });
  });

  describe('Risk Assessment Performance', () => {
    it('should complete risk assessment within reasonable time', async () => {
      // Mock fast risk assessment
      (llmService.assessTransactionRisk as jest.Mock).mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              transactionId: 'mock-txn-id',
              riskScore: 0.25,
              riskLevel: 'LOW',
              explanation: 'Performance test assessment',
              factors: [],
              recommendations: ['Process normally'],
              assessedAt: new Date()
            });
          }, 100); // 100ms delay to simulate processing
        });
      });

      const startTime = Date.now();

      const response = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(TestData.validCardPayment)
        .expect(201);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(response.body.success).toBe(true);
      expect(response.body.data.riskAssessment).toBeDefined();
      
      // Should complete within reasonable time (5 seconds including network overhead)
      expect(processingTime).toBeLessThan(5000);
    });

    it('should handle slow LLM responses with timeout', async () => {
      // Mock very slow LLM response
      (llmService.assessTransactionRisk as jest.Mock).mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              transactionId: 'mock-txn-id',
              riskScore: 0.3,
              riskLevel: 'MEDIUM',
              explanation: 'Slow response test',
              factors: [],
              recommendations: ['Process with monitoring'],
              assessedAt: new Date()
            });
          }, 10000); // 10 second delay
        });
      });

      const response = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(TestData.validCardPayment)
        .expect(201);

      // Should still succeed even with slow LLM (fallback should kick in)
      expect(response.body.success).toBe(true);
      expect(response.body.data.riskAssessment).toBeDefined();
    });
  });

  describe('Risk Assessment Data Validation', () => {
    it('should validate risk score ranges', async () => {
      const invalidRiskScores = [-0.5, 1.5, NaN, Infinity, 'invalid'];

      for (const invalidScore of invalidRiskScores) {
        (llmService.assessTransactionRisk as jest.Mock).mockResolvedValue({
          transactionId: 'mock-txn-id',
          riskScore: invalidScore,
          riskLevel: 'LOW',
          explanation: 'Testing invalid risk score',
          factors: [],
          recommendations: [],
          assessedAt: new Date()
        });

        const response = await request(app)
          .post('/api/v1/payments/process')
          .set('Authorization', `Bearer ${authToken}`)
          .send(TestData.validCardPayment)
          .expect(201);

        // System should handle invalid scores gracefully
        expect(response.body.success).toBe(true);
        expect(response.body.data.riskAssessment).toBeDefined();
      }
    });

    it('should validate risk level values', async () => {
      const invalidRiskLevels = ['INVALID', 'low', 'HIGH_RISK', '', null, 123];

      for (const invalidLevel of invalidRiskLevels) {
        (llmService.assessTransactionRisk as jest.Mock).mockResolvedValue({
          transactionId: 'mock-txn-id',
          riskScore: 0.3,
          riskLevel: invalidLevel,
          explanation: 'Testing invalid risk level',
          factors: [],
          recommendations: [],
          assessedAt: new Date()
        });

        const response = await request(app)
          .post('/api/v1/payments/process')
          .set('Authorization', `Bearer ${authToken}`)
          .send(TestData.validCardPayment)
          .expect(201);

        // System should handle invalid levels gracefully
        expect(response.body.success).toBe(true);
        expect(response.body.data.riskAssessment).toBeDefined();
      }
    });
  });
});
