import { LLMService } from '../../src/services/llm.service';
import { createMockTransaction, createMockRiskAssessment } from '../utils/test-helpers';
import { MockCacheService, MockCircuitBreaker } from '../utils/mock-services';
import { RiskAssessment } from '../../src/types';

// Mock axios
jest.mock('axios');
import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock dependencies
jest.mock('../../src/services/cache.service');
jest.mock('../../src/utils/circuit-breaker');
jest.mock('../../src/utils/retry');
jest.mock('../../src/utils/events');

// Mock the logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

import { cacheService } from '../../src/services/cache.service';
import { eventPublisher } from '../../src/utils/events';

describe('LLMService', () => {
  let llmService: LLMService;
  let mockCacheService: MockCacheService;
  let mockCircuitBreaker: MockCircuitBreaker;

  beforeEach(() => {
    mockCacheService = new MockCacheService();
    mockCircuitBreaker = new MockCircuitBreaker();

    // Mock the service instances
    (cacheService as any) = mockCacheService;

    // Set up environment variables
    process.env.OPENAI_API_KEY = 'test-api-key';
    process.env.OPENAI_MODEL = 'gpt-4';
    process.env.OPENAI_MAX_TOKENS = '500';
    process.env.OPENAI_TEMPERATURE = '0.1';

    llmService = new LLMService();

    // Replace the circuit breaker with our mock
    (llmService as any).circuitBreaker = mockCircuitBreaker;

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockCacheService.reset();
    mockCircuitBreaker.reset();
  });

  describe('assessTransactionRisk', () => {
    describe('Success Cases', () => {
      it('should return cached risk assessment when available', async () => {
        const transaction = createMockTransaction();
        const cachedAssessment = createMockRiskAssessment(transaction.id);
        
        // Set up cache to return the assessment
        const cacheKey = `risk_assessment:${transaction.id}`;
        mockCacheService.set(cacheKey, cachedAssessment);

        const result = await llmService.assessTransactionRisk(transaction);

        expect(result).toEqual(cachedAssessment);
        expect(mockedAxios.post).not.toHaveBeenCalled();
      });

      it('should call OpenAI API when no cached result exists', async () => {
        const transaction = createMockTransaction();
        const mockOpenAIResponse = {
          data: {
            choices: [{
              message: {
                content: JSON.stringify({
                  riskScore: 0.3,
                  riskLevel: 'MEDIUM',
                  explanation: 'Medium risk transaction',
                  factors: [
                    {
                      factor: 'amount_moderate',
                      weight: 0.3,
                      description: 'Transaction amount is moderate'
                    }
                  ],
                  recommendations: ['Consider additional verification']
                })
              }
            }]
          }
        };

        mockedAxios.post.mockResolvedValue(mockOpenAIResponse);

        const result = await llmService.assessTransactionRisk(transaction);

        expect(mockedAxios.post).toHaveBeenCalledWith('/chat/completions', {
          model: 'gpt-4',
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user' })
          ]),
          max_tokens: 500,
          temperature: 0.1
        });

        expect(result.transactionId).toBe(transaction.id);
        expect(result.riskLevel).toBe('MEDIUM');
        expect(result.riskScore).toBe(0.3);
      });

      it('should cache the assessment result after successful API call', async () => {
        const transaction = createMockTransaction();
        const mockOpenAIResponse = {
          data: {
            choices: [{
              message: {
                content: JSON.stringify({
                  riskScore: 0.2,
                  riskLevel: 'LOW',
                  explanation: 'Low risk transaction',
                  factors: [],
                  recommendations: ['Process normally']
                })
              }
            }]
          }
        };

        mockedAxios.post.mockResolvedValue(mockOpenAIResponse);

        await llmService.assessTransactionRisk(transaction);

        // Verify that cache.set was called
        const cacheKey = `risk_assessment:${transaction.id}`;
        const cachedResult = await mockCacheService.get(cacheKey);
        expect(cachedResult).toBeDefined();
        expect(cachedResult.riskLevel).toBe('LOW');
      });

      it('should publish risk assessed event', async () => {
        const transaction = createMockTransaction();
        const mockOpenAIResponse = {
          data: {
            choices: [{
              message: {
                content: JSON.stringify({
                  riskScore: 0.2,
                  riskLevel: 'LOW',
                  explanation: 'Low risk transaction',
                  factors: [],
                  recommendations: ['Process normally']
                })
              }
            }]
          }
        };

        mockedAxios.post.mockResolvedValue(mockOpenAIResponse);

        // Mock event publisher
        const mockPublish = jest.fn();
        (eventPublisher as any).publish = mockPublish;

        await llmService.assessTransactionRisk(transaction);

        expect(mockPublish).toHaveBeenCalledWith('risk.assessed', {
          source: 'LLMService',
          transactionId: transaction.id,
          riskLevel: 'LOW'
        });
      });
    });

    describe('Circuit Breaker Integration', () => {
      it('should use circuit breaker for API calls', async () => {
        const transaction = createMockTransaction();
        
        // Set circuit breaker to open state
        mockCircuitBreaker.setState('OPEN');

        const result = await llmService.assessTransactionRisk(transaction);

        // Should return fallback response
        expect(result.explanation).toContain('Risk assessment service temporarily unavailable');
        expect(result.riskLevel).toBe('MEDIUM');
        expect(result.recommendations).toContain('Manual review recommended');
      });

      it('should handle circuit breaker failures gracefully', async () => {
        const transaction = createMockTransaction();
        
        mockCircuitBreaker.setFailureMode(true);

        const result = await llmService.assessTransactionRisk(transaction);

        // Should return fallback response
        expect(result.transactionId).toBe(transaction.id);
        expect(result.explanation).toContain('Risk assessment service temporarily unavailable');
      });
    });

    describe('Error Handling', () => {
      it('should handle OpenAI API errors', async () => {
        const transaction = createMockTransaction();
        
        mockedAxios.post.mockRejectedValue(new Error('OpenAI API error'));

        const result = await llmService.assessTransactionRisk(transaction);

        expect(result.explanation).toContain('Risk assessment service temporarily unavailable');
        expect(result.riskLevel).toBe('MEDIUM');
      });

      it('should handle invalid JSON response from OpenAI', async () => {
        const transaction = createMockTransaction();
        const mockOpenAIResponse = {
          data: {
            choices: [{
              message: {
                content: 'Invalid JSON response'
              }
            }]
          }
        };

        mockedAxios.post.mockResolvedValue(mockOpenAIResponse);

        const result = await llmService.assessTransactionRisk(transaction);

        expect(result.explanation).toContain('Risk assessment service temporarily unavailable');
      });

      it('should handle missing choices in OpenAI response', async () => {
        const transaction = createMockTransaction();
        const mockOpenAIResponse = {
          data: {
            choices: []
          }
        };

        mockedAxios.post.mockResolvedValue(mockOpenAIResponse);

        await expect(llmService.assessTransactionRisk(transaction)).rejects.toThrow();
      });

      it('should publish LLM call failed event on error', async () => {
        const transaction = createMockTransaction();
        
        mockedAxios.post.mockRejectedValue(new Error('API Error'));

        // Mock event publisher
        const mockPublish = jest.fn();
        (eventPublisher as any).publish = mockPublish;

        await llmService.assessTransactionRisk(transaction);

        expect(mockPublish).toHaveBeenCalledWith('llm.call.failed', {
          source: 'LLMService',
          transactionId: transaction.id,
          error: 'API Error'
        });
      });
    });

    describe('Prompt Building', () => {
      it('should build comprehensive risk assessment prompt', async () => {
        const transaction = createMockTransaction({
          amount: 50000, // $500
          currency: 'EUR',
          paymentMethod: {
            type: 'digital_wallet',
            walletId: 'wallet_test123'
          },
          metadata: {
            orderId: 'order_12345',
            ipAddress: '192.168.1.1'
          }
        });

        const mockOpenAIResponse = {
          data: {
            choices: [{
              message: {
                content: JSON.stringify({
                  riskScore: 0.4,
                  riskLevel: 'MEDIUM',
                  explanation: 'Medium risk transaction',
                  factors: [],
                  recommendations: []
                })
              }
            }]
          }
        };

        mockedAxios.post.mockResolvedValue(mockOpenAIResponse);

        await llmService.assessTransactionRisk(transaction);

        expect(mockedAxios.post).toHaveBeenCalledWith('/chat/completions', 
          expect.objectContaining({
            messages: expect.arrayContaining([
              expect.objectContaining({
                role: 'user',
                content: expect.stringContaining('50000 EUR')
              }),
              expect.objectContaining({
                role: 'user',
                content: expect.stringContaining('digital_wallet')
              }),
              expect.objectContaining({
                role: 'user',
                content: expect.stringContaining('order_12345')
              })
            ])
          })
        );
      });
    });

    describe('Cache Integration', () => {
      it('should handle cache service failures gracefully', async () => {
        const transaction = createMockTransaction();
        
        mockCacheService.setFailureMode(true);
        
        const mockOpenAIResponse = {
          data: {
            choices: [{
              message: {
                content: JSON.stringify({
                  riskScore: 0.2,
                  riskLevel: 'LOW',
                  explanation: 'Low risk transaction',
                  factors: [],
                  recommendations: ['Process normally']
                })
              }
            }]
          }
        };

        mockedAxios.post.mockResolvedValue(mockOpenAIResponse);

        const result = await llmService.assessTransactionRisk(transaction);

        // Should still work even if cache fails
        expect(result.riskLevel).toBe('LOW');
        expect(result.transactionId).toBe(transaction.id);
      });

      it('should skip cache when cache returns null', async () => {
        const transaction = createMockTransaction();
        
        // Ensure cache returns null
        mockCacheService.clear();

        const mockOpenAIResponse = {
          data: {
            choices: [{
              message: {
                content: JSON.stringify({
                  riskScore: 0.3,
                  riskLevel: 'MEDIUM',
                  explanation: 'Medium risk transaction',
                  factors: [],
                  recommendations: []
                })
              }
            }]
          }
        };

        mockedAxios.post.mockResolvedValue(mockOpenAIResponse);

        await llmService.assessTransactionRisk(transaction);

        expect(mockedAxios.post).toHaveBeenCalled();
      });
    });
  });

  describe('Fallback Response', () => {
    it('should provide consistent fallback response structure', async () => {
      const transaction = createMockTransaction();
      
      // Force circuit breaker to open
      mockCircuitBreaker.setState('OPEN');

      const result = await llmService.assessTransactionRisk(transaction);

      expect(result).toMatchObject({
        transactionId: transaction.id,
        riskScore: 0.5,
        riskLevel: 'MEDIUM',
        explanation: expect.stringContaining('Risk assessment service temporarily unavailable'),
        factors: expect.arrayContaining([
          expect.objectContaining({
            factor: 'service_unavailable',
            weight: 0.5,
            description: expect.stringContaining('LLM risk assessment service is currently unavailable')
          })
        ]),
        recommendations: expect.arrayContaining([
          'Manual review required',
          'Consider declining if high value'
        ]),
        assessedAt: expect.any(Date)
      });
    });
  });
});
