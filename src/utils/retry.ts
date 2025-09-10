import { logger } from './logger';

export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  jitter: boolean;
}

export class RetryService {
  private defaultOptions: RetryOptions = {
    maxAttempts: parseInt(process.env.RETRY_MAX_ATTEMPTS || '3'),
    baseDelay: parseInt(process.env.RETRY_BASE_DELAY || '1000'),
    maxDelay: 30000,
    backoffFactor: 2,
    jitter: true
  };

  async execute<T>(
    operation: () => Promise<T>,
    options?: Partial<RetryOptions>
  ): Promise<T> {
    const opts = { ...this.defaultOptions, ...options };
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
      try {
        const result = await operation();
        
        if (attempt > 1) {
          logger.info(`Operation succeeded on attempt ${attempt}`);
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        
        logger.warn(`Operation failed on attempt ${attempt}/${opts.maxAttempts}`, {
          error: (error as Error).message,
          attempt
        });
        
        if (attempt === opts.maxAttempts) {
          break;
        }
        
        const delay = this.calculateDelay(attempt, opts);
        await this.delay(delay);
      }
    }
    
    logger.error(`Operation failed after ${opts.maxAttempts} attempts`, {
      error: lastError?.message || 'Unknown error'
    });
    
    throw lastError!;
  }

  private calculateDelay(attempt: number, options: RetryOptions): number {
    const exponentialDelay = Math.min(
      options.baseDelay * Math.pow(options.backoffFactor, attempt - 1),
      options.maxDelay
    );

    if (options.jitter) {
      return exponentialDelay * (0.5 + Math.random() * 0.5);
    }

    return exponentialDelay;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const retryService = new RetryService();
