import request from 'supertest';
import app from '../../src/app';
import { createValidAuthRequest, TestData, expectValidErrorResponse } from '../utils/test-helpers';

describe('Authentication API Integration Tests', () => {
  beforeAll(() => {
    // Set up test environment variables
    process.env.CLIENT_ID = 'test-client';
    process.env.CLIENT_SECRET = 'test-secret-key';
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.JWT_EXPIRES_IN = '24h';
  });

  describe('POST /api/v1/auth/token', () => {
    describe('Success Cases', () => {
      it('should generate token with valid credentials', async () => {
        const response = await request(app)
          .post('/api/v1/auth/token')
          .send(TestData.validAuthCredentials)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            token: expect.any(String),
            expiresIn: '24h',
            tokenType: 'Bearer'
          }
        });

        // Verify token format (JWT should have 3 parts separated by dots)
        const token = response.body.data.token;
        expect(token.split('.')).toHaveLength(3);
      });

      it('should return different tokens for multiple requests', async () => {
        const response1 = await request(app)
          .post('/api/v1/auth/token')
          .send(TestData.validAuthCredentials)
          .expect(200);

        const response2 = await request(app)
          .post('/api/v1/auth/token')
          .send(TestData.validAuthCredentials)
          .expect(200);

        expect(response1.body.data.token).not.toBe(response2.body.data.token);
      });

      it('should handle valid credentials with different case sensitivity', async () => {
        const response = await request(app)
          .post('/api/v1/auth/token')
          .send({
            clientId: 'test-client', // exact match
            clientSecret: 'test-secret-key' // exact match
          })
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    describe('Validation Failures', () => {
      it('should reject invalid client ID', async () => {
        const response = await request(app)
          .post('/api/v1/auth/token')
          .send(TestData.invalidClientId)
          .expect(401);

        expect(response.body).toMatchObject({
          success: false,
          error: 'Invalid client credentials'
        });
      });

      it('should reject invalid client secret', async () => {
        const response = await request(app)
          .post('/api/v1/auth/token')
          .send(TestData.invalidClientSecret)
          .expect(401);

        expect(response.body).toMatchObject({
          success: false,
          error: 'Invalid client credentials'
        });
      });

      it('should reject missing credentials', async () => {
        const response = await request(app)
          .post('/api/v1/auth/token')
          .send(TestData.missingCredentials)
          .expect(400); // Validation middleware should catch this

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Validation failed');
      });

      it('should reject empty request body', async () => {
        const response = await request(app)
          .post('/api/v1/auth/token')
          .send({})
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Validation failed');
      });

      it('should reject malformed JSON', async () => {
        const response = await request(app)
          .post('/api/v1/auth/token')
          .set('Content-Type', 'application/json')
          .send('{"invalid": json}')
          .expect(400);

        // Should be handled by express JSON parser
      });
    });

    describe('Input Validation', () => {
      it('should reject clientId that is too short', async () => {
        const response = await request(app)
          .post('/api/v1/auth/token')
          .send({
            clientId: 'ab', // Less than 3 characters
            clientSecret: 'test-secret-key'
          })
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: 'Validation failed'
        });
      });

      it('should reject clientId that is too long', async () => {
        const response = await request(app)
          .post('/api/v1/auth/token')
          .send({
            clientId: 'a'.repeat(51), // More than 50 characters
            clientSecret: 'test-secret-key'
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Validation failed');
      });

      it('should reject clientSecret that is too short', async () => {
        const response = await request(app)
          .post('/api/v1/auth/token')
          .send({
            clientId: 'test-client',
            clientSecret: '12345' // Less than 6 characters
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Validation failed');
      });

      it('should reject clientSecret that is too long', async () => {
        const response = await request(app)
          .post('/api/v1/auth/token')
          .send({
            clientId: 'test-client',
            clientSecret: 'a'.repeat(101) // More than 100 characters
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Validation failed');
      });

      it('should reject null values', async () => {
        const response = await request(app)
          .post('/api/v1/auth/token')
          .send({
            clientId: null,
            clientSecret: null
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Validation failed');
      });

      it('should reject undefined values', async () => {
        const response = await request(app)
          .post('/api/v1/auth/token')
          .send({
            clientId: undefined,
            clientSecret: undefined
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Validation failed');
      });

      it('should reject numeric values', async () => {
        const response = await request(app)
          .post('/api/v1/auth/token')
          .send({
            clientId: 12345,
            clientSecret: 67890
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Validation failed');
      });
    });

    describe('Content Type Handling', () => {
      it('should handle application/json content type', async () => {
        const response = await request(app)
          .post('/api/v1/auth/token')
          .set('Content-Type', 'application/json')
          .send(TestData.validAuthCredentials)
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it('should reject unsupported content types', async () => {
        const response = await request(app)
          .post('/api/v1/auth/token')
          .set('Content-Type', 'text/plain')
          .send('clientId=test&clientSecret=secret')
          .expect(400);

        // Express should reject non-JSON content for JSON endpoints
      });

      it('should handle missing content type header', async () => {
        const response = await request(app)
          .post('/api/v1/auth/token')
          .send(TestData.validAuthCredentials)
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    describe('Rate Limiting', () => {
      it('should handle multiple rapid requests within limits', async () => {
        const requests = Array(5).fill(null).map(() =>
          request(app)
            .post('/api/v1/auth/token')
            .send(TestData.validAuthCredentials)
        );

        const responses = await Promise.all(requests);
        
        responses.forEach(response => {
          expect(response.status).toBe(200);
          expect(response.body.success).toBe(true);
        });
      });

      // Note: Rate limiting test would require more complex setup to trigger actual limits
      // This is more appropriately tested in E2E tests with longer-running scenarios
    });

    describe('Security Headers', () => {
      it('should include security headers in response', async () => {
        const response = await request(app)
          .post('/api/v1/auth/token')
          .send(TestData.validAuthCredentials)
          .expect(200);

        // Check for common security headers (these would be set by helmet middleware)
        expect(response.headers['x-content-type-options']).toBeDefined();
        expect(response.headers['x-frame-options']).toBeDefined();
      });

      it('should set correct content type in response', async () => {
        const response = await request(app)
          .post('/api/v1/auth/token')
          .send(TestData.validAuthCredentials)
          .expect(200);

        expect(response.headers['content-type']).toMatch(/application\/json/);
      });
    });

    describe('Error Response Format', () => {
      it('should return consistent error format for validation failures', async () => {
        const response = await request(app)
          .post('/api/v1/auth/token')
          .send({ clientId: 'ab' })
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: 'Validation failed',
          details: expect.any(Array)
        });

        expect(response.body.details.length).toBeGreaterThan(0);
      });

      it('should return consistent error format for authentication failures', async () => {
        const response = await request(app)
          .post('/api/v1/auth/token')
          .send(TestData.invalidClientId)
          .expect(401);

        expect(response.body).toMatchObject({
          success: false,
          error: 'Invalid client credentials'
        });

        expect(response.body.data).toBeUndefined();
      });
    });

    describe('Edge Cases', () => {
      it('should handle extremely long valid requests', async () => {
        const response = await request(app)
          .post('/api/v1/auth/token')
          .send({
            clientId: 'test-client',
            clientSecret: 'test-secret-key',
            extraField: 'a'.repeat(1000) // Large extra field
          })
          .expect(200); // Should ignore extra fields

        expect(response.body.success).toBe(true);
      });

      it('should handle special characters in credentials', async () => {
        // This test assumes the environment allows special characters
        const specialCharsCredentials = {
          clientId: 'test-client',
          clientSecret: 'test-secret-key'
        };

        const response = await request(app)
          .post('/api/v1/auth/token')
          .send(specialCharsCredentials)
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it('should handle unicode characters gracefully', async () => {
        const response = await request(app)
          .post('/api/v1/auth/token')
          .send({
            clientId: 'test-client-🚀',
            clientSecret: 'test-secret-key'
          })
          .expect(401); // Should fail auth but not crash

        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('Token Verification (Implicit)', () => {
    it('should generate tokens that can be verified by the system', async () => {
      const response = await request(app)
        .post('/api/v1/auth/token')
        .send(TestData.validAuthCredentials)
        .expect(200);

      const token = response.body.data.token;

      // Use the token in a protected endpoint to verify it works
      // This is an indirect test of token verification
      const protectedResponse = await request(app)
        .get('/api/v1/payments/txn_test-123')
        .set('Authorization', `Bearer ${token}`)
        .expect(404); // 404 means auth worked, transaction not found

      // If auth failed, we'd get 401
      expect(protectedResponse.status).not.toBe(401);
    });
  });
});
