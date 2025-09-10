import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { Transaction, TransactionStatus, PaymentRequest, PaymentResponse, ApiResponse } from '../types';
import { generateTransactionId } from '../utils/uuid';
import { paymentService } from '../services/payment.service';
import { logger } from '../utils/logger';
import { eventPublisher, EVENTS } from '../utils/events';
import { cacheService } from '../services/cache.service';

export class PaymentController {
  private transactions: Map<string, Transaction> = new Map();

  async processPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const transactionId = generateTransactionId();
      const paymentRequest: PaymentRequest = req.body;
      
      const transaction: Transaction = {
        id: transactionId,
        amount: paymentRequest.amount,
        currency: paymentRequest.currency,
        source: paymentRequest.source,
        email: paymentRequest.email,
        status: TransactionStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store transaction
      this.transactions.set(transactionId, transaction);
      await cacheService.set(
        cacheService.generateKey('transaction', transactionId),
        transaction,
        7200 // 2 hours
      );

      // Publish transaction created event
      eventPublisher.publish(EVENTS.TRANSACTION_CREATED, {
        source: 'PaymentController',
        transactionId,
        amount: transaction.amount,
        currency: transaction.currency,
        email: transaction.email
      });

      // Process payment with integrated risk assessment
      const processedTransaction = await paymentService.processTransaction(transaction);
      
      this.transactions.set(transactionId, processedTransaction);

      logger.info('Payment processed', {
        transactionId,
        amount: processedTransaction.amount,
        status: processedTransaction.status,
        provider: processedTransaction.provider,
        riskScore: processedTransaction.riskScore
      });

      const response: PaymentResponse = {
        transactionId,
        provider: processedTransaction.provider || 'paypal',
        status: processedTransaction.status,
        riskScore: processedTransaction.riskScore || 0.5,
        explanation: processedTransaction.explanation || 'Transaction processed with standard risk assessment'
      };

      res.status(201).json(response);

    } catch (error) {
      logger.error('Payment processing failed', { error: (error as Error).message });
      res.status(500).json({
        error: 'Payment processing failed'
      });
    }
  }

  async getPaymentStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { transactionId } = req.params;

      let transaction = this.transactions.get(transactionId);
      
      if (!transaction) {
        // Try to get from cache
        transaction = await cacheService.get<Transaction>(
          cacheService.generateKey('transaction', transactionId)
        ) || undefined;
      }

      if (!transaction) {
        res.status(404).json({
          success: false,
          error: 'Transaction not found'
        } as ApiResponse<never>);
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          transactionId: transaction.id,
          status: transaction.status,
          amount: transaction.amount,
          currency: transaction.currency,
          createdAt: transaction.createdAt,
          updatedAt: transaction.updatedAt
        }
      } as ApiResponse<any>);

    } catch (error) {
      logger.error('Failed to get payment status', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve payment status'
      } as ApiResponse<never>);
    }
  }

}

export const paymentController = new PaymentController();
