import { Transaction, TransactionStatus } from '../types';
import { llmService } from './llm.service';
import { logger } from '../utils/logger';
import { eventPublisher, EVENTS } from '../utils/events';
import { fraudRuleConfigService } from '../config/fraud-rules';

export class PaymentService {
  async processTransaction(transaction: Transaction): Promise<Transaction> {
    try {
      logger.info('Processing transaction', { transactionId: transaction.id });

      // Apply fraud rule-based assessment
      const fraudAssessment = fraudRuleConfigService.evaluateRiskFromRules(transaction);
      
      // Check if transaction should be blocked by fraud rules
      if (fraudAssessment.blockedRules.length > 0) {
        transaction.status = TransactionStatus.FAILED;
        transaction.riskScore = 1.0;
        transaction.explanation = `Transaction blocked by fraud rules: ${fraudAssessment.blockedRules.join(', ')}`;
        transaction.provider = 'blocked';
        transaction.updatedAt = new Date();
        
        logger.warn('Transaction blocked by fraud rules', {
          transactionId: transaction.id,
          blockedRules: fraudAssessment.blockedRules
        });
        
        return transaction;
      }

      // Perform LLM risk assessment
      let finalRiskScore = fraudAssessment.score;
      let explanation = 'Transaction assessed using configurable fraud rules';

      try {
        const riskAssessment = await llmService.assessTransactionRisk(transaction);
        // Combine fraud rule score with LLM assessment
        finalRiskScore = Math.max(fraudAssessment.score, riskAssessment.riskScore);
        explanation = riskAssessment.explanation;
      } catch (error) {
        logger.warn('LLM assessment failed, using fraud rules only', {
          transactionId: transaction.id,
          error: (error as Error).message
        });
      }

      // Select provider based on risk score
      const selectedProvider = fraudRuleConfigService.selectProvider(finalRiskScore);
      
      // Update transaction with results
      transaction.riskScore = finalRiskScore;
      transaction.explanation = explanation;
      transaction.provider = selectedProvider;
      transaction.status = this.determineTransactionStatus(finalRiskScore);
      transaction.updatedAt = new Date();

      // Publish events
      eventPublisher.publish(EVENTS.PAYMENT_PROCESSED, {
        source: 'PaymentService',
        transactionId: transaction.id,
        status: transaction.status,
        provider: selectedProvider,
        riskScore: finalRiskScore
      });

      logger.info('Transaction processed successfully', {
        transactionId: transaction.id,
        status: transaction.status,
        provider: selectedProvider,
        riskScore: finalRiskScore
      });

      return transaction;
    } catch (error) {
      logger.error('Transaction processing failed', {
        transactionId: transaction.id,
        error: (error as Error).message
      });
      
      transaction.status = TransactionStatus.FAILED;
      transaction.riskScore = 1.0;
      transaction.explanation = 'Transaction processing failed due to system error';
      transaction.provider = 'error';
      transaction.updatedAt = new Date();
      
      return transaction;
    }
  }

  private determineTransactionStatus(riskScore: number): TransactionStatus {
    const thresholds = fraudRuleConfigService.getThresholds();
    
    if (riskScore >= thresholds.critical) {
      return TransactionStatus.FAILED;
    } else if (riskScore >= thresholds.high) {
      return TransactionStatus.PENDING; // Requires manual review
    } else if (riskScore >= thresholds.medium) {
      return TransactionStatus.PROCESSING;
    } else {
      return TransactionStatus.SUCCESS;
    }
  }
}

export const paymentService = new PaymentService();
