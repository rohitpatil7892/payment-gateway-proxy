import request from 'supertest';
import app from '../../src/app';
import { generateValidToken, TestData, expectValidTransactionResponse, expectValidRiskAssessment } from '../utils/test-helpers';

// Mock the LLM service to avoid making real API calls during integration tests
jest.mock('../../src/services/llm.service', () => ({
  llmService: {
    assessTransactionRisk: jest.fn().mockResolvedValue({
      transactionId: 'mock-transaction-id',
      riskScore: 0.2,
      riskLevel: 'LOW',
      explanation: 'Mock low risk assessment for testing',
      factors: [
        {
          factor: 'mock_factor',
          weight: 0.2,
          description: 'Mock risk factor for testing'
        }
      ],
      recommendations: ['Process normally'],
      assessedAt: new Date()
    })
  }
}));

describe('Payment API Integration Tests', () => {
  let authToken: string;

  beforeAll(async () => {
    // Set up test environment variables
    process.env.CLIENT_ID = 'test-client';
    process.env.CLIENT_SECRET = 'test-secret-key';
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.JWT_EXPIRES_IN = '24h';

    // Generate a valid token for authenticated requests
    const authResponse = await request(app)
      .post('/api/v1/auth/token')
      .send(TestData.validAuthCredentials)
      .expect(200);

    authToken = authResponse.body.data.token;
  });

  describe('POST /api/v1/payments/process', () => {
    describe('Success Cases', () => {
      it('should process card payment successfully', async () => {
        const response = await request(app)
          .post('/api/v1/payments/process')
          .set('Authorization', `Bearer ${authToken}`)
          .send(TestData.validCardPayment)
          .expect(201);

        expectValidTransactionResponse(response.body);
        expect(response.body.data.riskAssessment).toBeDefined();
        expectValidRiskAssessment(response.body.data.riskAssessment);

        // Verify response structure
        expect(response.body).toMatchObject({
          success: true,
          data: {
            transactionId: expect.stringMatching(/^txn_/),
            status: expect.stringMatching(/^(PENDING|PROCESSING|SUCCESS|FAILED)$/),
            riskAssessment: expect.objectContaining({
              riskLevel: expect.stringMatching(/^(LOW|MEDIUM|HIGH|CRITICAL)$/),
              riskScore: expect.any(Number),
              explanation: expect.any(String)
            })
          }
        });
      });

      it('should handle high amount payment with appropriate risk assessment', async () => {
        const response = await request(app)
          .post('/api/v1/payments/process')
          .set('Authorization', `Bearer ${authToken}`)
          .send(TestData.highAmountPayment)
          .expect(201);

        expectValidTransactionResponse(response.body);
        // High amount payments should still be processed but with risk assessment
        expect(response.body.data.riskAssessment).toBeDefined();
      });

      it('should handle different currencies correctly', async () => {
        const currencyTests = ['USD', 'EUR', 'GBP', 'CAD'];
        
        for (const currency of currencyTests) {
          const paymentData = { ...TestData.validCardPayment, currency };
          
          const response = await request(app)
            .post('/api/v1/payments/process')
            .set('Authorization', `Bearer ${authToken}`)
            .send(paymentData)
            .expect(201);

          expectValidTransactionResponse(response.body);
        }
      });
    });

    describe('Authentication Failures', () => {
      it('should reject requests without authentication token', async () => {
        const response = await request(app)
          .post('/api/v1/payments/process')
          .send(TestData.validCardPayment)
          .expect(401);

        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('authorization')
        });
      });

      it('should reject requests with invalid authentication token', async () => {
        const response = await request(app)
          .post('/api/v1/payments/process')
          .set('Authorization', 'Bearer invalid-token')
          .send(TestData.validCardPayment)
          .expect(401);

        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('Invalid or expired token')
        });
      });

      it('should reject requests with malformed authorization header', async () => {
        const response = await request(app)
          .post('/api/v1/payments/process')
          .set('Authorization', 'InvalidFormat token-here')
          .send(TestData.validCardPayment)
          .expect(401);

        expect(response.body.success).toBe(false);
      });

      it('should reject requests with missing Bearer prefix', async () => {
        const response = await request(app)
          .post('/api/v1/payments/process')
          .set('Authorization', authToken)
          .send(TestData.validCardPayment)
          .expect(401);

        expect(response.body.success).toBe(false);
      });
    });

    describe('Validation Failures', () => {
      it('should reject payment with invalid amount', async () => {
        const response = await request(app)
          .post('/api/v1/payments/process')
          .set('Authorization', `Bearer ${authToken}`)
          .send(TestData.invalidAmountPayment)
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: 'Validation failed'
        });
      });

      it('should reject payment with invalid currency', async () => {
        const response = await request(app)
          .post('/api/v1/payments/process')
          .set('Authorization', `Bearer ${authToken}`)
          .send(TestData.invalidCurrencyPayment)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Validation failed');
      });

      it('should reject payment with zero amount', async () => {
        const response = await request(app)
          .post('/api/v1/payments/process')
          .set('Authorization', `Bearer ${authToken}`)
          .send(TestData.zeroAmountPayment)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Validation failed');
      });

      it('should reject payment with amount exceeding maximum', async () => {
        const response = await request(app)
          .post('/api/v1/payments/process')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ ...TestData.validCardPayment, amount: 1000001 })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Validation failed');
      });

      it('should validate card payment method fields correctly', async () => {
        const invalidCardPayment = {
          ...TestData.validCardPayment,
          paymentMethod: {
            type: 'card',
            cardNumber: '1234', // Invalid card number
            expiryMonth: '13', // Invalid month
            expiryYear: '2020', // Past year
            cvv: '12' // Invalid CVV length
          }
        };

        const response = await request(app)
          .post('/api/v1/payments/process')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidCardPayment)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Validation failed');
      });
    });

    describe('Content Type and Request Format', () => {
      it('should handle proper JSON content type', async () => {
        const response = await request(app)
          .post('/api/v1/payments/process')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .send(TestData.validCardPayment)
          .expect(201);

        expectValidTransactionResponse(response.body);
      });

      it('should reject malformed JSON', async () => {
        const response = await request(app)
          .post('/api/v1/payments/process')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .send('{"invalid": json}')
          .expect(400);

        // Express JSON parser should handle this
      });

      it('should handle empty request body', async () => {
        const response = await request(app)
          .post('/api/v1/payments/process')
          .set('Authorization', `Bearer ${authToken}`)
          .send({})
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Validation failed');
      });
    });
  });

  describe('GET /api/v1/payments/:transactionId', () => {
    let createdTransactionId: string;

    beforeEach(async () => {
      // Create a transaction to test retrieval
      const createResponse = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(TestData.validCardPayment)
        .expect(201);

      createdTransactionId = createResponse.body.data.transactionId;
    });

    describe('Success Cases', () => {
      it('should retrieve payment status successfully', async () => {
        const response = await request(app)
          .get(`/api/v1/payments/${createdTransactionId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            transactionId: createdTransactionId,
            status: expect.stringMatching(/^(PENDING|PROCESSING|SUCCESS|FAILED)$/),
            amount: expect.any(Number),
            currency: expect.any(String),
            createdAt: expect.any(String),
            updatedAt: expect.any(String)
          }
        });

        // Verify date formats
        expect(new Date(response.body.data.createdAt)).toBeInstanceOf(Date);
        expect(new Date(response.body.data.updatedAt)).toBeInstanceOf(Date);
      });

      it('should return consistent data format', async () => {
        const response = await request(app)
          .get(`/api/v1/payments/${createdTransactionId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const { data } = response.body;
        expect(typeof data.transactionId).toBe('string');
        expect(typeof data.status).toBe('string');
        expect(typeof data.amount).toBe('number');
        expect(typeof data.currency).toBe('string');
        expect(typeof data.createdAt).toBe('string');
        expect(typeof data.updatedAt).toBe('string');
      });
    });

    describe('Authentication Failures', () => {
      it('should reject requests without authentication token', async () => {
        const response = await request(app)
          .get(`/api/v1/payments/${createdTransactionId}`)
          .expect(401);

        expect(response.body.success).toBe(false);
      });

      it('should reject requests with invalid authentication token', async () => {
        const response = await request(app)
          .get(`/api/v1/payments/${createdTransactionId}`)
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);

        expect(response.body.success).toBe(false);
      });
    });

    describe('Not Found Cases', () => {
      it('should return 404 for non-existent transaction', async () => {
        const response = await request(app)
          .get('/api/v1/payments/txn_nonexistent-transaction-id')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);

        expect(response.body).toMatchObject({
          success: false,
          error: 'Transaction not found'
        });
      });

      it('should return 404 for malformed transaction ID', async () => {
        const response = await request(app)
          .get('/api/v1/payments/invalid-transaction-id-format')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Transaction not found');
      });

      it('should handle empty transaction ID', async () => {
        const response = await request(app)
          .get('/api/v1/payments/')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);

        // Should hit the 404 middleware since this route doesn't exist
      });
    });

    describe('Parameter Handling', () => {
      it('should handle URL encoding in transaction ID', async () => {
        const encodedId = encodeURIComponent(createdTransactionId);
        
        const response = await request(app)
          .get(`/api/v1/payments/${encodedId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.data.transactionId).toBe(createdTransactionId);
      });

      it('should handle special characters in transaction ID gracefully', async () => {
        const response = await request(app)
          .get('/api/v1/payments/txn_special-chars-@#$%')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);

        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should handle multiple concurrent payment requests', async () => {
      const concurrentRequests = Array(5).fill(null).map(() =>
        request(app)
          .post('/api/v1/payments/process')
          .set('Authorization', `Bearer ${authToken}`)
          .send(TestData.validCardPayment)
      );

      const responses = await Promise.all(concurrentRequests);
      
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      // Verify all transactions have unique IDs
      const transactionIds = responses.map(r => r.body.data.transactionId);
      const uniqueIds = new Set(transactionIds);
      expect(uniqueIds.size).toBe(transactionIds.length);
    });
  });

  describe('Response Headers', () => {
    it('should include appropriate security headers', async () => {
      const response = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(TestData.validCardPayment)
        .expect(201);

      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.headers['x-content-type-options']).toBeDefined();
    });

    it('should set correct status codes for different scenarios', async () => {
      // Success case
      const successResponse = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(TestData.validCardPayment);
      expect(successResponse.status).toBe(201);

      // Validation error
      const validationResponse = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(TestData.invalidAmountPayment);
      expect(validationResponse.status).toBe(400);

      // Auth error
      const authResponse = await request(app)
        .post('/api/v1/payments/process')
        .send(TestData.validCardPayment);
      expect(authResponse.status).toBe(401);
    });
  });
});
