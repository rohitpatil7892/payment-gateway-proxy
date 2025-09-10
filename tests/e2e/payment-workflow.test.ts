import request from 'supertest';
import app from '../../src/app';
import { TestData, expectValidTransactionResponse, expectValidRiskAssessment, delay } from '../utils/test-helpers';

// Mock external dependencies for E2E tests
jest.mock('../../src/services/llm.service', () => ({
  llmService: {
    assessTransactionRisk: jest.fn()
  }
}));

import { llmService } from '../../src/services/llm.service';

describe('Payment Gateway E2E Workflow Tests', () => {
  let authToken: string;

  beforeAll(async () => {
    // Set up test environment
    process.env.CLIENT_ID = 'test-client';
    process.env.CLIENT_SECRET = 'test-secret-key';
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.JWT_EXPIRES_IN = '24h';
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';
  });

  beforeEach(async () => {
    // Get a fresh authentication token for each test
    const authResponse = await request(app)
      .post('/api/v1/auth/token')
      .send(TestData.validAuthCredentials)
      .expect(200);

    authToken = authResponse.body.data.token;

    // Reset LLM mock
    jest.clearAllMocks();
  });

  describe('Complete Payment Processing Workflow', () => {
    it('should complete full payment lifecycle with low risk assessment', async () => {
      // Mock LLM service to return low risk assessment
      (llmService.assessTransactionRisk as jest.Mock).mockResolvedValue({
        transactionId: 'mock-id',
        riskScore: 0.15,
        riskLevel: 'LOW',
        explanation: 'Low risk transaction based on customer history and transaction patterns.',
        factors: [
          {
            factor: 'amount_normal',
            weight: 0.1,
            description: 'Transaction amount within normal range'
          },
          {
            factor: 'customer_verified',
            weight: 0.05,
            description: 'Customer identity verified'
          }
        ],
        recommendations: ['Process normally', 'No additional verification required'],
        assessedAt: new Date()
      });

      // Step 1: Process payment
      const paymentResponse = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(TestData.validCardPayment)
        .expect(201);

      expectValidTransactionResponse(paymentResponse.body);
      const transactionId = paymentResponse.body.data.transactionId;
      
      // Verify risk assessment is included
      expect(paymentResponse.body.data.riskAssessment).toBeDefined();
      expectValidRiskAssessment(paymentResponse.body.data.riskAssessment);
      expect(paymentResponse.body.data.riskAssessment.riskLevel).toBe('LOW');

      // Step 2: Check payment status immediately
      const statusResponse = await request(app)
        .get(`/api/v1/payments/${transactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(statusResponse.body.data.transactionId).toBe(transactionId);
      expect(statusResponse.body.data.amount).toBe(TestData.validCardPayment.amount);
      expect(statusResponse.body.data.currency).toBe(TestData.validCardPayment.currency);

      // Step 3: Verify LLM service was called
      expect(llmService.assessTransactionRisk).toHaveBeenCalledTimes(1);
      const callArgs = (llmService.assessTransactionRisk as jest.Mock).mock.calls[0][0];
      expect(callArgs.amount).toBe(TestData.validCardPayment.amount);
      expect(callArgs.currency).toBe(TestData.validCardPayment.currency);
    });

    it('should handle high risk payment scenario', async () => {
      // Mock LLM service to return high risk assessment
      (llmService.assessTransactionRisk as jest.Mock).mockResolvedValue({
        transactionId: 'mock-id',
        riskScore: 0.85,
        riskLevel: 'HIGH',
        explanation: 'High risk transaction due to unusual amount and timing patterns.',
        factors: [
          {
            factor: 'amount_unusual',
            weight: 0.4,
            description: 'Transaction amount significantly higher than customer average'
          },
          {
            factor: 'timing_suspicious',
            weight: 0.3,
            description: 'Transaction occurring at unusual time'
          },
          {
            factor: 'location_anomaly',
            weight: 0.15,
            description: 'Transaction from unexpected geographic location'
          }
        ],
        recommendations: [
          'Require additional verification',
          'Contact customer to confirm transaction',
          'Consider manual review'
        ],
        assessedAt: new Date()
      });

      // Process high-risk payment
      const paymentResponse = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(TestData.highAmountPayment)
        .expect(201);

      expectValidTransactionResponse(paymentResponse.body);
      
      // Verify high risk assessment
      const riskAssessment = paymentResponse.body.data.riskAssessment;
      expect(riskAssessment.riskLevel).toBe('HIGH');
      expect(riskAssessment.riskScore).toBeGreaterThan(0.8);
      expect(riskAssessment.recommendations.length).toBeGreaterThan(0);
      expect(riskAssessment.factors.length).toBeGreaterThan(0);

      // Transaction should still be created but may be in PENDING status for review
      const transactionId = paymentResponse.body.data.transactionId;
      expect(transactionId).toMatch(/^txn_/);
    });

    it('should handle critical risk payment scenario', async () => {
      // Mock LLM service to return critical risk assessment
      (llmService.assessTransactionRisk as jest.Mock).mockResolvedValue({
        transactionId: 'mock-id',
        riskScore: 0.98,
        riskLevel: 'CRITICAL',
        explanation: 'Critical risk transaction - potential fraud detected.',
        factors: [
          {
            factor: 'fraud_pattern',
            weight: 0.5,
            description: 'Transaction matches known fraud patterns'
          },
          {
            factor: 'stolen_card_indicator',
            weight: 0.3,
            description: 'Card may be reported stolen'
          },
          {
            factor: 'velocity_check_failed',
            weight: 0.18,
            description: 'Too many transactions in short time period'
          }
        ],
        recommendations: [
          'Block transaction immediately',
          'Flag account for investigation',
          'Contact fraud prevention team',
          'Freeze customer account pending investigation'
        ],
        assessedAt: new Date()
      });

      // Process critical risk payment
      const paymentResponse = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(TestData.validCardPayment)
        .expect(201);

      // Transaction should still be created but likely failed/blocked
      const riskAssessment = paymentResponse.body.data.riskAssessment;
      expect(riskAssessment.riskLevel).toBe('CRITICAL');
      expect(riskAssessment.riskScore).toBeGreaterThan(0.9);
      
      // Critical risk should result in FAILED status
      expect(paymentResponse.body.data.status).toBe('FAILED');
    });
  });

  describe('Multiple Payment Methods Workflow', () => {
    it('should process different payment methods with appropriate risk assessments', async () => {
      const paymentMethods = [
        { data: TestData.validCardPayment, type: 'card' },
        { data: TestData.validBankTransferPayment, type: 'bank_transfer' },
        { data: TestData.validDigitalWalletPayment, type: 'digital_wallet' }
      ];

      for (const { data, type } of paymentMethods) {
        // Mock different risk levels for different payment methods
        const riskLevel = type === 'digital_wallet' ? 'MEDIUM' : 'LOW';
        const riskScore = type === 'digital_wallet' ? 0.4 : 0.2;

        (llmService.assessTransactionRisk as jest.Mock).mockResolvedValue({
          transactionId: 'mock-id',
          riskScore,
          riskLevel,
          explanation: `${riskLevel} risk for ${type} payment method`,
          factors: [
            {
              factor: 'payment_method_risk',
              weight: riskScore,
              description: `Risk associated with ${type} payment method`
            }
          ],
          recommendations: riskLevel === 'MEDIUM' ? ['Additional verification'] : ['Process normally'],
          assessedAt: new Date()
        });

        const response = await request(app)
          .post('/api/v1/payments/process')
          .set('Authorization', `Bearer ${authToken}`)
          .send(data)
          .expect(201);

        expectValidTransactionResponse(response.body);
        expect(response.body.data.riskAssessment.riskLevel).toBe(riskLevel);
      }
    });
  });

  describe('Error Recovery Workflow', () => {
    it('should handle LLM service failure gracefully', async () => {
      // Mock LLM service failure
      (llmService.assessTransactionRisk as jest.Mock).mockRejectedValue(
        new Error('OpenAI service temporarily unavailable')
      );

      const paymentResponse = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(TestData.validCardPayment)
        .expect(201);

      // Payment should still be processed with fallback risk assessment
      expectValidTransactionResponse(paymentResponse.body);
      
      // Should have fallback risk assessment
      const riskAssessment = paymentResponse.body.data.riskAssessment;
      expect(riskAssessment).toBeDefined();
      expect(riskAssessment.explanation).toContain('service temporarily unavailable');
    });

    it('should retry failed LLM calls according to retry policy', async () => {
      // Mock LLM service to fail first call, succeed on second
      let callCount = 0;
      (llmService.assessTransactionRisk as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Temporary network error');
        }
        return Promise.resolve({
          transactionId: 'mock-id',
          riskScore: 0.3,
          riskLevel: 'MEDIUM',
          explanation: 'Risk assessment completed after retry',
          factors: [],
          recommendations: ['Process with caution'],
          assessedAt: new Date()
        });
      });

      const paymentResponse = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(TestData.validCardPayment)
        .expect(201);

      expectValidTransactionResponse(paymentResponse.body);
      expect(paymentResponse.body.data.riskAssessment.riskLevel).toBe('MEDIUM');
      expect(callCount).toBe(2); // Should have retried once
    });
  });

  describe('Concurrent Processing Workflow', () => {
    it('should handle multiple concurrent payment requests', async () => {
      // Mock consistent risk assessment for all requests
      (llmService.assessTransactionRisk as jest.Mock).mockResolvedValue({
        transactionId: 'mock-id',
        riskScore: 0.25,
        riskLevel: 'LOW',
        explanation: 'Concurrent processing test - low risk',
        factors: [],
        recommendations: ['Process normally'],
        assessedAt: new Date()
      });

      // Create multiple concurrent payment requests
      const concurrentPayments = Array(5).fill(null).map((_, index) => ({
        ...TestData.validCardPayment,
        customer: {
          ...TestData.validCardPayment.customer,
          id: `customer_${index}`,
          email: `customer${index}@example.com`
        },
        metadata: {
          ...TestData.validCardPayment.metadata,
          batchId: 'concurrent_test',
          requestIndex: index
        }
      }));

      const requests = concurrentPayments.map(paymentData =>
        request(app)
          .post('/api/v1/payments/process')
          .set('Authorization', `Bearer ${authToken}`)
          .send(paymentData)
      );

      const responses = await Promise.all(requests);

      // All requests should succeed
      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expectValidTransactionResponse(response.body);
        expect(response.body.data.riskAssessment.riskLevel).toBe('LOW');
      });

      // All transaction IDs should be unique
      const transactionIds = responses.map(r => r.body.data.transactionId);
      const uniqueIds = new Set(transactionIds);
      expect(uniqueIds.size).toBe(transactionIds.length);

      // Verify all transactions can be retrieved
      for (const transactionId of transactionIds) {
        const statusResponse = await request(app)
          .get(`/api/v1/payments/${transactionId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(statusResponse.body.data.transactionId).toBe(transactionId);
      }
    });
  });

  describe('Authentication Workflow', () => {
    it('should complete authentication and payment workflow', async () => {
      // Step 1: Get new authentication token
      const authResponse = await request(app)
        .post('/api/v1/auth/token')
        .send(TestData.validAuthCredentials)
        .expect(200);

      expect(authResponse.body.success).toBe(true);
      expect(authResponse.body.data.token).toBeDefined();
      
      const newToken = authResponse.body.data.token;

      // Step 2: Use token for payment
      (llmService.assessTransactionRisk as jest.Mock).mockResolvedValue({
        transactionId: 'mock-id',
        riskScore: 0.2,
        riskLevel: 'LOW',
        explanation: 'Authentication workflow test',
        factors: [],
        recommendations: ['Process normally'],
        assessedAt: new Date()
      });

      const paymentResponse = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${newToken}`)
        .send(TestData.validCardPayment)
        .expect(201);

      expectValidTransactionResponse(paymentResponse.body);

      // Step 3: Use same token for status check
      const transactionId = paymentResponse.body.data.transactionId;
      const statusResponse = await request(app)
        .get(`/api/v1/payments/${transactionId}`)
        .set('Authorization', `Bearer ${newToken}`)
        .expect(200);

      expect(statusResponse.body.data.transactionId).toBe(transactionId);
    });

    it('should handle token expiration workflow', async () => {
      // Create a token with very short expiration for testing
      // Note: This would require modifying the JWT generation for testing
      // or waiting for actual expiration in a real scenario
      
      // For now, test with invalid token to simulate expiration
      const expiredToken = 'expired.jwt.token';

      const response = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send(TestData.validCardPayment)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid or expired token');
    });
  });

  describe('Data Persistence Workflow', () => {
    it('should persist transaction data across multiple operations', async () => {
      // Mock risk assessment
      (llmService.assessTransactionRisk as jest.Mock).mockResolvedValue({
        transactionId: 'mock-id',
        riskScore: 0.3,
        riskLevel: 'MEDIUM',
        explanation: 'Data persistence test',
        factors: [
          {
            factor: 'persistence_test',
            weight: 0.3,
            description: 'Testing data persistence'
          }
        ],
        recommendations: ['Monitor transaction'],
        assessedAt: new Date()
      });

      // Step 1: Create payment with specific metadata
      const uniqueMetadata = {
        orderId: `order_${Date.now()}`,
        customerReference: 'persistence_test_customer',
        merchantNote: 'Testing data persistence workflow'
      };

      const paymentData = {
        ...TestData.validCardPayment,
        metadata: uniqueMetadata
      };

      const paymentResponse = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData)
        .expect(201);

      const transactionId = paymentResponse.body.data.transactionId;
      expectValidTransactionResponse(paymentResponse.body);

      // Step 2: Retrieve transaction multiple times to test cache behavior
      for (let i = 0; i < 3; i++) {
        const statusResponse = await request(app)
          .get(`/api/v1/payments/${transactionId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(statusResponse.body.data.transactionId).toBe(transactionId);
        expect(statusResponse.body.data.amount).toBe(paymentData.amount);
        expect(statusResponse.body.data.currency).toBe(paymentData.currency);

        // Small delay between requests
        await delay(100);
      }

      // Step 3: Verify data consistency
      const finalStatusResponse = await request(app)
        .get(`/api/v1/payments/${transactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(finalStatusResponse.body.data.transactionId).toBe(transactionId);
      expect(new Date(finalStatusResponse.body.data.createdAt)).toBeInstanceOf(Date);
      expect(new Date(finalStatusResponse.body.data.updatedAt)).toBeInstanceOf(Date);
    });
  });

  describe('End-to-End Performance', () => {
    it('should complete payment workflow within acceptable time limits', async () => {
      // Mock fast risk assessment
      (llmService.assessTransactionRisk as jest.Mock).mockResolvedValue({
        transactionId: 'mock-id',
        riskScore: 0.2,
        riskLevel: 'LOW',
        explanation: 'Performance test - low risk',
        factors: [],
        recommendations: ['Process normally'],
        assessedAt: new Date()
      });

      const startTime = Date.now();

      const paymentResponse = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(TestData.validCardPayment)
        .expect(201);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expectValidTransactionResponse(paymentResponse.body);
      
      // Payment should complete within reasonable time (5 seconds for E2E)
      expect(processingTime).toBeLessThan(5000);

      // Quick status check should be even faster
      const transactionId = paymentResponse.body.data.transactionId;
      const statusStartTime = Date.now();

      await request(app)
        .get(`/api/v1/payments/${transactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const statusEndTime = Date.now();
      const statusTime = statusEndTime - statusStartTime;

      // Status check should be very fast (under 1 second)
      expect(statusTime).toBeLessThan(1000);
    });
  });
});
