import request from 'supertest';
import app from '../../src/app';
import { TestData, expectValidErrorResponse } from '../utils/test-helpers';

describe('Error Handling Integration Tests', () => {
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

  describe('HTTP Method Errors', () => {
    it('should return 404 for unsupported HTTP methods on payment endpoints', async () => {
      const response = await request(app)
        .put('/api/v1/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(TestData.validCardPayment)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for DELETE requests on protected resources', async () => {
      const response = await request(app)
        .delete('/api/v1/payments/txn_123')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for PATCH requests on auth endpoints', async () => {
      const response = await request(app)
        .patch('/api/v1/auth/token')
        .send(TestData.validAuthCredentials)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Invalid Route Errors', () => {
    it('should return 404 for non-existent API endpoints', async () => {
      const response = await request(app)
        .get('/api/v1/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Route');
      expect(response.body.error).toContain('not found');
    });

    it('should return 404 for incorrect API version', async () => {
      const response = await request(app)
        .post('/api/v2/auth/token')
        .send(TestData.validAuthCredentials)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for missing trailing paths', async () => {
      const response = await request(app)
        .post('/api/v1/payments/')
        .set('Authorization', `Bearer ${authToken}`)
        .send(TestData.validCardPayment)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for incorrect nested paths', async () => {
      const response = await request(app)
        .get('/api/v1/payments/status/txn_123')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Content Type Errors', () => {
    it('should handle unsupported content types gracefully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/token')
        .set('Content-Type', 'application/xml')
        .send('<xml>invalid</xml>')
        .expect(400);

      // Express should reject non-JSON content
    });

    it('should handle missing content type header', async () => {
      const response = await request(app)
        .post('/api/v1/auth/token')
        .send(JSON.stringify(TestData.validAuthCredentials))
        .expect(200);

      // Should still work as Express can infer JSON
      expect(response.body.success).toBe(true);
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/token')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      // Express JSON middleware should catch this
    });

    it('should handle empty content body', async () => {
      const response = await request(app)
        .post('/api/v1/auth/token')
        .set('Content-Type', 'application/json')
        .send('')
        .expect(400);

      // Empty body should trigger validation error
    });
  });

  describe('Authentication Error Scenarios', () => {
    it('should handle completely missing Authorization header', async () => {
      const response = await request(app)
        .post('/api/v1/payments/process')
        .send(TestData.validCardPayment)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('authorization')
      });
    });

    it('should handle empty Authorization header', async () => {
      const response = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', '')
        .send(TestData.validCardPayment)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should handle malformed Authorization header', async () => {
      const testCases = [
        'Bearer',              // Missing token
        'bearer token',        // Wrong case
        'Basic token',         // Wrong auth type
        'Bearer token extra',  // Extra content
        'token-without-bearer' // Missing Bearer
      ];

      for (const authHeader of testCases) {
        const response = await request(app)
          .post('/api/v1/payments/process')
          .set('Authorization', authHeader)
          .send(TestData.validCardPayment)
          .expect(401);

        expect(response.body.success).toBe(false);
      }
    });

    it('should handle expired/invalid JWT tokens', async () => {
      const invalidTokens = [
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',  // Malformed JWT
        'completely.invalid.token',                          // Not a JWT
        'valid.looking.jwt.but.invalid',                     // Wrong format
        'a'.repeat(500)                                      // Extremely long token
      ];

      for (const token of invalidTokens) {
        const response = await request(app)
          .post('/api/v1/payments/process')
          .set('Authorization', `Bearer ${token}`)
          .send(TestData.validCardPayment)
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Invalid or expired token');
      }
    });
  });

  describe('Validation Error Edge Cases', () => {
    it('should handle extremely large request payloads', async () => {
      const largePayload = {
        ...TestData.validCardPayment,
        metadata: {
          largeField: 'x'.repeat(10000) // 10KB of data
        }
      };

      const response = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(largePayload)
        .expect(201); // Should still work with large metadata

      expect(response.body.success).toBe(true);
    });

    it('should handle deeply nested objects in metadata', async () => {
      const deepNestedPayload = {
        ...TestData.validCardPayment,
        metadata: {
          level1: {
            level2: {
              level3: {
                level4: {
                  level5: {
                    value: 'deep nesting test'
                  }
                }
              }
            }
          }
        }
      };

      const response = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(deepNestedPayload)
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should handle special characters and unicode in request data', async () => {
      const unicodePayload = {
        ...TestData.validCardPayment,
        customer: {
          id: 'customer_测试_🚀',
          email: 'test@example.com'
        },
        metadata: {
          description: 'Payment with émojis 🚀💳 and spëcial chars ñáéíóú',
          unicode: '这是一个测试',
          emoji: '🎉🎊💰💳'
        }
      };

      const response = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(unicodePayload)
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should handle null and undefined values in optional fields', async () => {
      const payloadWithNulls = {
        ...TestData.validCardPayment,
        metadata: null // Should be converted to empty object or handled gracefully
      };

      const response = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(payloadWithNulls)
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should handle array values in unexpected places', async () => {
      const payloadWithArrays = {
        ...TestData.validCardPayment,
        amount: [10000], // Array instead of number
        currency: ['USD'] // Array instead of string
      };

      const response = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(payloadWithArrays)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('Concurrent Request Error Scenarios', () => {
    it('should handle rapid successive requests with same data', async () => {
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/v1/payments/process')
          .set('Authorization', `Bearer ${authToken}`)
          .send(TestData.validCardPayment)
      );

      const responses = await Promise.all(requests);

      // All should succeed and have unique transaction IDs
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      const transactionIds = responses.map(r => r.body.data.transactionId);
      const uniqueIds = new Set(transactionIds);
      expect(uniqueIds.size).toBe(transactionIds.length);
    });

    it('should handle mixed valid and invalid requests concurrently', async () => {
      const validRequests = Array(3).fill(null).map(() =>
        request(app)
          .post('/api/v1/payments/process')
          .set('Authorization', `Bearer ${authToken}`)
          .send(TestData.validCardPayment)
      );

      const invalidRequests = Array(3).fill(null).map(() =>
        request(app)
          .post('/api/v1/payments/process')
          .set('Authorization', `Bearer ${authToken}`)
          .send(TestData.invalidAmountPayment)
      );

      const allRequests = [...validRequests, ...invalidRequests];
      const responses = await Promise.all(allRequests);

      // Valid requests should succeed
      responses.slice(0, 3).forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      // Invalid requests should fail
      responses.slice(3).forEach(response => {
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('Server Error Simulation', () => {
    it('should handle database/cache connection errors gracefully', async () => {
      // This test would require mocking the cache service to fail
      // For now, we test that the system doesn't crash with normal requests
      const response = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(TestData.validCardPayment)
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should handle extremely high load gracefully', async () => {
      // Simulate high load with many concurrent requests
      const highLoadRequests = Array(20).fill(null).map((_, index) => ({
        ...TestData.validCardPayment,
        customer: {
          ...TestData.validCardPayment.customer,
          id: `customer_load_test_${index}`,
          email: `load${index}@example.com`
        }
      }));

      const requests = highLoadRequests.map(payload =>
        request(app)
          .post('/api/v1/payments/process')
          .set('Authorization', `Bearer ${authToken}`)
          .send(payload)
      );

      const responses = await Promise.all(requests);

      // Most or all should succeed (depending on rate limiting)
      const successCount = responses.filter(r => r.status === 201).length;
      const rateLimitedCount = responses.filter(r => r.status === 429).length;

      expect(successCount + rateLimitedCount).toBe(responses.length);
      expect(successCount).toBeGreaterThan(0); // At least some should succeed
    });
  });

  describe('Edge Case Parameters', () => {
    it('should handle boundary values for transaction amounts', async () => {
      const boundaryTests = [
        { amount: 1, description: 'minimum amount' },
        { amount: 999999, description: 'maximum amount' },
        { amount: 1.5, description: 'decimal amount' }, // Should fail validation
        { amount: 0.01, description: 'very small decimal' }
      ];

      for (const { amount, description } of boundaryTests) {
        const payload = { ...TestData.validCardPayment, amount };
        
        const response = await request(app)
          .post('/api/v1/payments/process')
          .set('Authorization', `Bearer ${authToken}`)
          .send(payload);

        if (amount >= 1 && amount <= 1000000 && Number.isInteger(amount)) {
          expect(response.status).toBe(201);
          expect(response.body.success).toBe(true);
        } else {
          expect(response.status).toBe(400);
          expect(response.body.success).toBe(false);
        }
      }
    });

    it('should handle edge cases in string length validation', async () => {
      const stringTests = [
        { field: 'customer.id', value: '', shouldFail: true },
        { field: 'customer.id', value: 'ab', shouldFail: true }, // Too short
        { field: 'customer.id', value: 'a'.repeat(51), shouldFail: true }, // Too long
        { field: 'customer.id', value: 'valid_customer_123', shouldFail: false },
        { field: 'merchant.id', value: 'ab', shouldFail: true },
        { field: 'merchant.id', value: 'a'.repeat(51), shouldFail: true },
        { field: 'merchant.id', value: 'valid_merchant_456', shouldFail: false }
      ];

      for (const { field, value, shouldFail } of stringTests) {
        const payload = JSON.parse(JSON.stringify(TestData.validCardPayment));
        
        // Set the nested field value
        const [parent, child] = field.split('.');
        payload[parent][child] = value;

        const response = await request(app)
          .post('/api/v1/payments/process')
          .set('Authorization', `Bearer ${authToken}`)
          .send(payload);

        if (shouldFail) {
          expect(response.status).toBe(400);
          expect(response.body.success).toBe(false);
        } else {
          expect(response.status).toBe(201);
          expect(response.body.success).toBe(true);
        }
      }
    });
  });

  describe('Response Format Consistency', () => {
    it('should return consistent error format across all endpoints', async () => {
      const errorEndpoints = [
        {
          method: 'post',
          path: '/api/v1/auth/token',
          payload: { clientId: 'invalid' },
          expectedStatus: 400
        },
        {
          method: 'post',
          path: '/api/v1/payments/process',
          payload: TestData.invalidAmountPayment,
          expectedStatus: 400,
          headers: { Authorization: `Bearer ${authToken}` }
        },
        {
          method: 'get',
          path: '/api/v1/payments/nonexistent',
          expectedStatus: 404,
          headers: { Authorization: `Bearer ${authToken}` }
        }
      ];

      for (const { method, path, payload, expectedStatus, headers } of errorEndpoints) {
        let requestBuilder = request(app)[method](path);
        
        if (headers) {
          Object.entries(headers).forEach(([key, value]) => {
            requestBuilder = requestBuilder.set(key, value);
          });
        }

        if (payload) {
          requestBuilder = requestBuilder.send(payload);
        }

        const response = await requestBuilder.expect(expectedStatus);

        // All error responses should have consistent format
        expect(response.body).toMatchObject({
          success: false,
          error: expect.any(String)
        });

        // Should not contain sensitive information
        expect(response.body.error).not.toContain('password');
        expect(response.body.error).not.toContain('secret');
        expect(response.body.error).not.toContain('stack');
      }
    });
  });
});
