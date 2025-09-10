import axios, { AxiosInstance } from 'axios';
import { CircuitBreaker } from '../utils/circuit-breaker';
import { retryService } from '../utils/retry';
import { Transaction, RiskAssessment } from '../types';
import { logger } from '../utils/logger';
import { eventPublisher, EVENTS } from '../utils/events';
import { cacheService } from './cache.service';

export class LLMService {
  private client: AxiosInstance;
  private circuitBreaker: CircuitBreaker;

  constructor() {
    // Determine LM-Studio base URL (no trailing slash, no /v1 suffix)
    let baseURL = process.env.LM_STUDIO_URL || 'http://localhost:1234';
    // Replace localhost with 127.0.0.1 to avoid IPv6 (::1) resolution issues
    if (baseURL.startsWith('http://localhost')) {
      baseURL = baseURL.replace('http://localhost', 'http://127.0.0.1');
    }

    // strip any trailing slash
    baseURL = baseURL.replace(/\/$/, '');
    // strip a trailing /v1 if the user already added it
    baseURL = baseURL.replace(/\/v1$/i, '');

    logger.info(`LLMService using LM Studio endpoint at ${baseURL}`);
    
    this.client = axios.create({
      // Append single /v1 API prefix
      baseURL: `${baseURL}/v1`,
      headers: {
        'Content-Type': 'application/json'
        // LM Studio doesn't require authentication for local usage
      },
      // Allow longer timeout for local LM Studio; configurable via env
      timeout: parseInt(process.env.LM_STUDIO_TIMEOUT || '90000')
    });

    this.circuitBreaker = new CircuitBreaker('LLMService', {
      failureThreshold: parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || '5'),
      resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || '30000'),
      monitoringPeriod: 60000
    });
  }

  async assessTransactionRisk(transaction: Transaction): Promise<RiskAssessment> {
    // Allow disabling LLM integration (useful for local dev without LM Studio running)
    if (process.env.LLM_DISABLED === 'true') {
      logger.warn('LLM integration disabled via LLM_DISABLED=true env var');
      return this.getFallbackResponse(transaction);
    }

    const cacheKey = cacheService.generateKey('risk_assessment', transaction.id);
    
    // Check cache first
    const cachedResult = await cacheService.get<RiskAssessment>(cacheKey);
    if (cachedResult) {
      logger.debug('Risk assessment retrieved from cache', { transactionId: transaction.id });
      return cachedResult;
    }

    try {
      const assessment = await this.circuitBreaker.execute(async () => {
        return await retryService.execute(() => this.callLMStudio(transaction));
      });

      // Cache the result
      await cacheService.set(cacheKey, assessment, 3600); // 1 hour cache

      eventPublisher.publish(EVENTS.RISK_ASSESSED, {
        source: 'LLMService',
        transactionId: transaction.id,
        riskLevel: assessment.riskLevel
      });

      return assessment;
    } catch (error) {
      logger.error('LLM risk assessment failed', { 
        transactionId: transaction.id, 
        error: (error as Error).message 
      });

      eventPublisher.publish(EVENTS.LLM_CALL_FAILED, {
        source: 'LLMService',
        transactionId: transaction.id,
        error: (error as Error).message
      });

      return this.getFallbackResponse(transaction);
    }
  }

  private async callLMStudio(transaction: Transaction): Promise<RiskAssessment> {
    const prompt = this.buildRiskAssessmentPrompt(transaction);
    
    try {
      const response = await this.client.post('/chat/completions', {
        model: process.env.LM_STUDIO_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a financial risk assessment expert. Analyze the transaction and provide a detailed risk assessment in JSON format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: parseInt(process.env.LM_STUDIO_MAX_TOKENS || '500'),
        temperature: parseFloat(process.env.LM_STUDIO_TEMPERATURE || '0.7'),
        stream: false
      });

      return this.parseLMStudioResponse(response.data.choices[0].message.content, transaction);
    } catch (error: any) {
      // Enhanced error handling for LM Studio API
      if (error.code === 'ECONNREFUSED') {
        const baseURL = process.env.LM_STUDIO_URL || 'http://localhost:1234';
        logger.error('LM Studio connection refused', { 
          message: `Cannot connect to LM Studio at ${baseURL}.\n` +
                   '• Ensure LM Studio is running (default port 1234).\n' +
                   '• Open LM Studio, load a model (e.g. "qwen2.5-coder-1.5b-instruct"), then click "Open Web API".',
          transactionId: transaction.id 
        });
        throw new Error('LM Studio server is not running. Please start LM Studio and load a model.');
      }
      
      if (error.response?.data?.error) {
        const apiError = error.response.data.error;
        logger.error('LM Studio API error details', { 
          message: apiError.message,
          type: apiError.type,
          code: apiError.code,
          transactionId: transaction.id 
        });
      }
      throw error;
    }
  }

  private buildRiskAssessmentPrompt(transaction: Transaction): string {
    return `
      Analyze this payment transaction for fraud risk:
      
      Transaction Details:
      - Amount: ${transaction.amount} ${transaction.currency}
      - Payment Source: ${transaction.source}
      - Customer Email: ${transaction.email}
      - Transaction Time: ${transaction.createdAt.toISOString()}
      
      Please provide a risk assessment with:
      1. Risk score (0.0 to 1.0)
      2. Risk level (LOW, MEDIUM, HIGH, CRITICAL)
      3. Explanation of the assessment
      4. Key risk factors identified
      5. Recommendations for handling this transaction
      
      Consider factors like:
      - Transaction amount relative to normal patterns
      - Email domain legitimacy
      - Payment source token patterns
      - Time-based patterns
      
      Respond only with valid JSON in this format:
      {
        "riskScore": 0.15,
        "riskLevel": "LOW",
        "explanation": "Low risk transaction based on normal amount and legitimate email domain",
        "factors": [
          {
            "factor": "amount_normal",
            "weight": 0.1,
            "description": "Transaction amount within normal range"
          }
        ],
        "recommendations": ["Process normally"]
      }
    `;
  }

  private parseLMStudioResponse(content: string, transaction: Transaction): RiskAssessment {
    try {
      // Some models wrap JSON in markdown fences ```json ... ``` – strip them
      const cleaned = content
        .trim()
        .replace(/^```(?:json)?/i, '')
        .replace(/```$/i, '')
        .trim();
      const parsed = JSON.parse(cleaned);
      
      return {
        transactionId: transaction.id,
        riskScore: parsed.riskScore,
        riskLevel: parsed.riskLevel,
        explanation: parsed.explanation,
        factors: parsed.factors || [],
        recommendations: parsed.recommendations || [],
        assessedAt: new Date()
      };
    } catch (error) {
      logger.error('Failed to parse LM Studio response', { error, content });
      return this.getFallbackResponse(transaction);
    }
  }

  private getFallbackResponse(transaction: Transaction): RiskAssessment {
    logger.warn('Using fallback risk assessment', { 
      transactionId: transaction.id,
      reason: 'LLM service unavailable' 
    });
    
    return {
      transactionId: transaction.id,
      riskScore: 0.5,
      riskLevel: 'MEDIUM',
      explanation: 'Risk assessment service temporarily unavailable. Using rule-based fallback assessment.',
      factors: [
        {
          factor: 'service_unavailable',
          weight: 0.5,
          description: 'LLM risk assessment service is currently unavailable (check API credits/connectivity)'
        }
      ],
      recommendations: ['Manual review required', 'Check LLM service configuration', 'Consider declining if high value'],
      assessedAt: new Date()
    };
  }
}

export const llmService = new LLMService();
