import { Response } from 'express';
import { PaymentController } from '../../src/controllers/payment.controller';
import { AuthenticatedRequest } from '../../src/middleware/auth.middleware';
import { TransactionStatus } from '../../src/types';
import { createValidPaymentRequest, createMockTransaction, TestData } from '../utils/test-helpers';
import { MockCacheService, MockEventPublisher } from '../utils/mock-services';

// Mock dependencies
jest.mock('../../src/services/payment.service');
jest.mock('../../src/services/cache.service');
jest.mock('../../src/utils/events');
jest.mock('../../src/utils/uuid', () => ({
  generateTransactionId: jest.fn(() => 'txn_mock-uuid-1234')
}));

// Mock the logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

import { paymentService } from '../../src/services/payment.service';
import { cacheService } from '../../src/services/cache.service';
import { eventPublisher } from '../../src/utils/events';

describe('PaymentController', () => {
  let paymentController: PaymentController;
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockCacheService: MockCacheService;
  let mockEventPublisher: MockEventPublisher;

  beforeEach(() => {
    paymentController = new PaymentController();
    
    mockJson = jest.fn().mockReturnValue({});
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    
    mockRequest = {
      body: {},
      params: {},
      query: {},
      clientId: 'test-client'
    };
    
    mockResponse = {
      status: mockStatus,
      json: mockJson
    };

    mockCacheService = new MockCacheService();
    mockEventPublisher = new MockEventPublisher();

    // Mock the service instances
    (cacheService as any) = mockCacheService;
    (eventPublisher as any) = mockEventPublisher;

    // Spy on cache service methods
    jest.spyOn(mockCacheService, 'set');
    jest.spyOn(mockCacheService, 'get');

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockCacheService.reset();
    mockEventPublisher.reset();
  });

  describe('processPayment', () => {
    describe('Success Cases', () => {
      it('should process payment successfully', async () => {
        const paymentRequest = createValidPaymentRequest();
        mockRequest.body = paymentRequest;

        const mockProcessedTransaction = createMockTransaction({
          id: 'txn_mock-uuid-1234',
          status: TransactionStatus.PROCESSING,
          amount: paymentRequest.amount,
          currency: paymentRequest.currency
        });

        (paymentService.processTransaction as jest.Mock).mockResolvedValue(mockProcessedTransaction);

        await paymentController.processPayment(mockRequest as AuthenticatedRequest, mockResponse as Response);

        expect(mockStatus).toHaveBeenCalledWith(201);
        expect(mockJson).toHaveBeenCalledWith({
          transactionId: 'txn_mock-uuid-1234',
          provider: expect.any(String),
          status: expect.any(String),
          riskScore: expect.any(Number),
          explanation: expect.any(String)
        });
      });

      it('should cache transaction after processing', async () => {
        const paymentRequest = createValidPaymentRequest();
        mockRequest.body = paymentRequest;

        const mockProcessedTransaction = createMockTransaction({
          id: 'txn_mock-uuid-1234',
          status: TransactionStatus.PROCESSING
        });

        (paymentService.processTransaction as jest.Mock).mockResolvedValue(mockProcessedTransaction);

        await paymentController.processPayment(mockRequest as AuthenticatedRequest, mockResponse as Response);

        // Verify cache was called with correct parameters
        expect(mockCacheService.set).toHaveBeenCalled();
        expect(mockStatus).toHaveBeenCalledWith(201);
      });

      it('should publish transaction created event', async () => {
        const paymentRequest = createValidPaymentRequest();
        mockRequest.body = paymentRequest;

        const mockProcessedTransaction = createMockTransaction({
          id: 'txn_mock-uuid-1234',
          status: TransactionStatus.PROCESSING
        });

        (paymentService.processTransaction as jest.Mock).mockResolvedValue(mockProcessedTransaction);

        await paymentController.processPayment(mockRequest as AuthenticatedRequest, mockResponse as Response);

        const publishedEvents = mockEventPublisher.getPublishedEvents();
        expect(publishedEvents).toHaveLength(1);
        expect(publishedEvents[0].event).toBe('transaction.created');
        expect(publishedEvents[0].data.transactionId).toBe('txn_mock-uuid-1234');
      });
    });

    describe('Error Handling', () => {
      it('should handle payment service failure', async () => {
        const paymentRequest = createValidPaymentRequest();
        mockRequest.body = paymentRequest;

        (paymentService.processTransaction as jest.Mock).mockRejectedValue(
          new Error('Payment service unavailable')
        );

        await paymentController.processPayment(mockRequest as AuthenticatedRequest, mockResponse as Response);

        expect(mockStatus).toHaveBeenCalledWith(500);
        expect(mockJson).toHaveBeenCalledWith({
          error: 'Payment processing failed'
        });
      });

      it('should handle cache service failure gracefully', async () => {
        const paymentRequest = createValidPaymentRequest();
        mockRequest.body = paymentRequest;

        // Mock cache service to fail on set operations
        jest.spyOn(mockCacheService, 'set').mockRejectedValue(new Error('Cache service unavailable'));

        // Cache failure should cause the entire operation to fail since it's in the try-catch
        await paymentController.processPayment(mockRequest as AuthenticatedRequest, mockResponse as Response);

        expect(mockStatus).toHaveBeenCalledWith(500);
        expect(mockJson).toHaveBeenCalledWith({
          error: 'Payment processing failed'
        });
      });

      it('should handle unexpected errors', async () => {
        const paymentRequest = createValidPaymentRequest();
        mockRequest.body = paymentRequest;

        // Simulate an unexpected error during processing
        (paymentService.processTransaction as jest.Mock).mockImplementation(() => {
          throw new Error('Unexpected error');
        });

        await paymentController.processPayment(mockRequest as AuthenticatedRequest, mockResponse as Response);

        expect(mockStatus).toHaveBeenCalledWith(500);
        expect(mockJson).toHaveBeenCalledWith({
          error: 'Payment processing failed'
        });
      });
    });
  });

  describe('getPaymentStatus', () => {
    describe('Success Cases', () => {
      it('should retrieve payment status from memory', async () => {
        const transactionId = 'txn_test-123';
        mockRequest.params = { transactionId };

        const mockTransaction = createMockTransaction({
          id: transactionId,
          status: TransactionStatus.SUCCESS
        });

        // Set up the transaction in controller's memory
        (paymentController as any).transactions.set(transactionId, mockTransaction);

        await paymentController.getPaymentStatus(mockRequest as AuthenticatedRequest, mockResponse as Response);

        expect(mockStatus).toHaveBeenCalledWith(200);
        expect(mockJson).toHaveBeenCalledWith({
          success: true,
          data: {
            transactionId: transactionId,
            status: TransactionStatus.SUCCESS,
            amount: mockTransaction.amount,
            currency: mockTransaction.currency,
            createdAt: mockTransaction.createdAt,
            updatedAt: mockTransaction.updatedAt
          }
        });
      });

      it('should retrieve payment status from cache when not in memory', async () => {
        const transactionId = 'txn_test-123';
        mockRequest.params = { transactionId };

        const mockTransaction = createMockTransaction({
          id: transactionId,
          status: TransactionStatus.SUCCESS
        });

        // Set up cache to return the transaction
        mockCacheService.set(`transaction:${transactionId}`, mockTransaction);

        await paymentController.getPaymentStatus(mockRequest as AuthenticatedRequest, mockResponse as Response);

        expect(mockStatus).toHaveBeenCalledWith(200);
        expect(mockJson).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.objectContaining({
              transactionId: transactionId,
              status: TransactionStatus.SUCCESS
            })
          })
        );
      });
    });

    describe('Not Found Cases', () => {
      it('should return 404 when transaction is not found', async () => {
        const transactionId = 'txn_not-found';
        mockRequest.params = { transactionId };

        await paymentController.getPaymentStatus(mockRequest as AuthenticatedRequest, mockResponse as Response);

        expect(mockStatus).toHaveBeenCalledWith(404);
        expect(mockJson).toHaveBeenCalledWith({
          success: false,
          error: 'Transaction not found'
        });
      });

      it('should return 404 when cache returns null', async () => {
        const transactionId = 'txn_not-found';
        mockRequest.params = { transactionId };

        // Ensure cache returns null
        mockCacheService.clear();

        await paymentController.getPaymentStatus(mockRequest as AuthenticatedRequest, mockResponse as Response);

        expect(mockStatus).toHaveBeenCalledWith(404);
        expect(mockJson).toHaveBeenCalledWith({
          success: false,
          error: 'Transaction not found'
        });
      });
    });

    describe('Error Handling', () => {
      it('should handle cache service errors', async () => {
        const transactionId = 'txn_test-123';
        mockRequest.params = { transactionId };

        mockCacheService.setFailureMode(true);

        await paymentController.getPaymentStatus(mockRequest as AuthenticatedRequest, mockResponse as Response);

        expect(mockStatus).toHaveBeenCalledWith(500);
        expect(mockJson).toHaveBeenCalledWith({
          success: false,
          error: 'Failed to retrieve payment status'
        });
      });
    });
  });

});
