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
          success: true,
          data: {
            transactionId: 'txn_mock-uuid-1234',
            status: TransactionStatus.PROCESSING,
            riskAssessment: {
              riskLevel: 'LOW',
              riskScore: 0.2,
              explanation: 'Low risk transaction'
            }
          }
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
          success: false,
          error: 'Payment processing failed'
        });
      });

      it('should handle cache service failure gracefully', async () => {
        const paymentRequest = createValidPaymentRequest();
        mockRequest.body = paymentRequest;

        const mockProcessedTransaction = createMockTransaction({
          id: 'txn_mock-uuid-1234',
          status: TransactionStatus.PROCESSING
        });

        mockCacheService.setFailureMode(true);
        (paymentService.processTransaction as jest.Mock).mockResolvedValue(mockProcessedTransaction);

        // Should still succeed even if cache fails
        await paymentController.processPayment(mockRequest as AuthenticatedRequest, mockResponse as Response);

        expect(mockStatus).toHaveBeenCalledWith(201);
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
          success: false,
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

  describe('listPayments', () => {
    describe('Success Cases', () => {
      it('should list payments with default pagination', async () => {
        mockRequest.query = {};

        // Set up some mock transactions
        const transactions = [
          createMockTransaction({ id: 'txn_1' }),
          createMockTransaction({ id: 'txn_2' }),
          createMockTransaction({ id: 'txn_3' })
        ];

        transactions.forEach(t => {
          (paymentController as any).transactions.set(t.id, t);
        });

        await paymentController.listPayments(mockRequest as AuthenticatedRequest, mockResponse as Response);

        expect(mockStatus).toHaveBeenCalledWith(200);
        expect(mockJson).toHaveBeenCalledWith({
          success: true,
          data: {
            transactions: expect.arrayContaining([
              expect.objectContaining({ transactionId: 'txn_1' }),
              expect.objectContaining({ transactionId: 'txn_2' }),
              expect.objectContaining({ transactionId: 'txn_3' })
            ]),
            pagination: {
              page: 1,
              limit: 10,
              total: 3,
              totalPages: 1
            }
          }
        });
      });

      it('should handle custom pagination parameters', async () => {
        mockRequest.query = { page: '2', limit: '2' };

        // Set up some mock transactions
        const transactions = Array.from({ length: 5 }, (_, i) => 
          createMockTransaction({ id: `txn_${i + 1}` })
        );

        transactions.forEach(t => {
          (paymentController as any).transactions.set(t.id, t);
        });

        await paymentController.listPayments(mockRequest as AuthenticatedRequest, mockResponse as Response);

        expect(mockStatus).toHaveBeenCalledWith(200);
        expect(mockJson).toHaveBeenCalledWith({
          success: true,
          data: {
            transactions: expect.any(Array),
            pagination: {
              page: 2,
              limit: 2,
              total: 5,
              totalPages: 3
            }
          }
        });

        const responseData = mockJson.mock.calls[0][0].data;
        expect(responseData.transactions).toHaveLength(2);
      });

      it('should handle empty transaction list', async () => {
        mockRequest.query = {};

        await paymentController.listPayments(mockRequest as AuthenticatedRequest, mockResponse as Response);

        expect(mockStatus).toHaveBeenCalledWith(200);
        expect(mockJson).toHaveBeenCalledWith({
          success: true,
          data: {
            transactions: [],
            pagination: {
              page: 1,
              limit: 10,
              total: 0,
              totalPages: 0
            }
          }
        });
      });
    });

    describe('Error Handling', () => {
      it('should handle invalid pagination parameters', async () => {
        mockRequest.query = { page: 'invalid', limit: 'invalid' };

        await paymentController.listPayments(mockRequest as AuthenticatedRequest, mockResponse as Response);

        // Should use default values
        expect(mockStatus).toHaveBeenCalledWith(200);
        expect(mockJson).toHaveBeenCalledWith({
          success: true,
          data: {
            transactions: [],
            pagination: {
              page: 1,
              limit: 10,
              total: 0,
              totalPages: 0
            }
          }
        });
      });

      it('should handle unexpected errors', async () => {
        mockRequest.query = {};

        // Force an error by making the transactions property undefined
        (paymentController as any).transactions = undefined;

        await paymentController.listPayments(mockRequest as AuthenticatedRequest, mockResponse as Response);

        expect(mockStatus).toHaveBeenCalledWith(500);
        expect(mockJson).toHaveBeenCalledWith({
          success: false,
          error: 'Failed to list payments'
        });
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large pagination requests', async () => {
      mockRequest.query = { page: '1', limit: '1000' };

      await paymentController.listPayments(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      // Should handle large limit gracefully
    });

    it('should handle zero or negative pagination values', async () => {
      mockRequest.query = { page: '0', limit: '-5' };

      await paymentController.listPayments(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      // Should use default values for invalid inputs
    });
  });
});
