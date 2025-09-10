import { Request, Response } from 'express';
import { AuthController } from '../../src/controllers/auth.controller';
import { generateToken, verifyToken } from '../../src/utils/jwt';
import { createValidAuthRequest, expectValidErrorResponse } from '../utils/test-helpers';

// Mock the JWT utility functions
jest.mock('../../src/utils/jwt');
const mockGenerateToken = generateToken as jest.MockedFunction<typeof generateToken>;
const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;

// Mock the logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('AuthController', () => {
  let authController: AuthController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    authController = new AuthController();
    
    mockJson = jest.fn().mockReturnValue({});
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    
    mockRequest = {
      body: {}
    };
    
    mockResponse = {
      status: mockStatus,
      json: mockJson
    };

    // Set up environment variables for testing
    process.env.CLIENT_ID = 'test-client';
    process.env.CLIENT_SECRET = 'test-secret-key';
    process.env.JWT_EXPIRES_IN = '24h';

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createToken', () => {
    describe('Success Cases', () => {
      it('should generate token successfully with valid credentials', async () => {
        const validRequest = createValidAuthRequest();
        mockRequest.body = validRequest;
        
        const mockToken = 'mock-jwt-token';
        mockGenerateToken.mockReturnValue(mockToken);

        await authController.createToken(mockRequest as Request, mockResponse as Response);

        expect(mockGenerateToken).toHaveBeenCalledWith(validRequest.clientId);
        expect(mockStatus).toHaveBeenCalledWith(200);
        expect(mockJson).toHaveBeenCalledWith({
          success: true,
          data: {
            token: mockToken,
            expiresIn: '24h',
            tokenType: 'Bearer'
          }
        });
      });

      it('should use default expiration time when JWT_EXPIRES_IN is not set', async () => {
        delete process.env.JWT_EXPIRES_IN;
        
        const validRequest = createValidAuthRequest();
        mockRequest.body = validRequest;
        
        const mockToken = 'mock-jwt-token';
        mockGenerateToken.mockReturnValue(mockToken);

        await authController.createToken(mockRequest as Request, mockResponse as Response);

        expect(mockJson).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.objectContaining({
              expiresIn: '24h'
            })
          })
        );
      });
    });

    describe('Validation Failures', () => {
      it('should return 401 for invalid client ID', async () => {
        mockRequest.body = createValidAuthRequest({ clientId: 'invalid-client' });

        await authController.createToken(mockRequest as Request, mockResponse as Response);

        expect(mockStatus).toHaveBeenCalledWith(401);
        expect(mockJson).toHaveBeenCalledWith({
          success: false,
          error: 'Invalid client credentials'
        });
        expect(mockGenerateToken).not.toHaveBeenCalled();
      });

      it('should return 401 for invalid client secret', async () => {
        mockRequest.body = createValidAuthRequest({ clientSecret: 'invalid-secret' });

        await authController.createToken(mockRequest as Request, mockResponse as Response);

        expect(mockStatus).toHaveBeenCalledWith(401);
        expect(mockJson).toHaveBeenCalledWith({
          success: false,
          error: 'Invalid client credentials'
        });
        expect(mockGenerateToken).not.toHaveBeenCalled();
      });

      it('should return 401 for missing credentials', async () => {
        mockRequest.body = { clientId: '', clientSecret: '' };

        await authController.createToken(mockRequest as Request, mockResponse as Response);

        expect(mockStatus).toHaveBeenCalledWith(401);
        expect(mockJson).toHaveBeenCalledWith({
          success: false,
          error: 'Invalid client credentials'
        });
        expect(mockGenerateToken).not.toHaveBeenCalled();
      });

      it('should return 401 when environment variables are not set', async () => {
        delete process.env.CLIENT_ID;
        delete process.env.CLIENT_SECRET;
        
        mockRequest.body = createValidAuthRequest();

        await authController.createToken(mockRequest as Request, mockResponse as Response);

        expect(mockStatus).toHaveBeenCalledWith(401);
        expect(mockJson).toHaveBeenCalledWith({
          success: false,
          error: 'Invalid client credentials'
        });
      });
    });

    describe('Error Handling', () => {
      it('should handle token generation failure', async () => {
        const validRequest = createValidAuthRequest();
        mockRequest.body = validRequest;
        
        mockGenerateToken.mockImplementation(() => {
          throw new Error('Token generation failed');
        });

        await authController.createToken(mockRequest as Request, mockResponse as Response);

        expect(mockStatus).toHaveBeenCalledWith(500);
        expect(mockJson).toHaveBeenCalledWith({
          success: false,
          error: 'Token generation failed'
        });
      });

      it('should handle unexpected errors gracefully', async () => {
        const validRequest = createValidAuthRequest();
        mockRequest.body = validRequest;
        
        // Simulate an unexpected error
        mockGenerateToken.mockImplementation(() => {
          throw new Error('Unexpected error');
        });

        await authController.createToken(mockRequest as Request, mockResponse as Response);

        expect(mockStatus).toHaveBeenCalledWith(500);
        expect(mockJson).toHaveBeenCalledWith({
          success: false,
          error: 'Token generation failed'
        });
      });
    });
  });

  describe('validateClientCredentials (private method)', () => {
    it('should validate credentials correctly', () => {
      const validRequest = createValidAuthRequest();
      
      // Access private method through reflection for testing
      const validateMethod = (authController as any).validateClientCredentials;
      
      expect(validateMethod(validRequest.clientId, validRequest.clientSecret)).toBe(true);
      expect(validateMethod('invalid-client', validRequest.clientSecret)).toBe(false);
      expect(validateMethod(validRequest.clientId, 'invalid-secret')).toBe(false);
      expect(validateMethod('invalid-client', 'invalid-secret')).toBe(false);
    });

    it('should handle missing environment variables', () => {
      delete process.env.CLIENT_ID;
      delete process.env.CLIENT_SECRET;
      
      const validateMethod = (authController as any).validateClientCredentials;
      
      expect(validateMethod('any-client', 'any-secret')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string credentials', async () => {
      mockRequest.body = { clientId: '', clientSecret: '' };

      await authController.createToken(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid client credentials'
      });
    });

    it('should handle null credentials', async () => {
      mockRequest.body = { clientId: null, clientSecret: null };

      await authController.createToken(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid client credentials'
      });
    });

    it('should handle undefined credentials', async () => {
      mockRequest.body = {};

      await authController.createToken(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid client credentials'
      });
    });

    it('should be case sensitive for credentials', async () => {
      mockRequest.body = {
        clientId: (process.env.CLIENT_ID || '').toUpperCase(),
        clientSecret: process.env.CLIENT_SECRET
      };

      await authController.createToken(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid client credentials'
      });
    });
  });
});
