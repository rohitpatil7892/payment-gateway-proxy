# Development Implementation Plan
## Mini Payment Gateway Proxy with LLM Risk Summary

### Table of Contents
1. [Prerequisites](#prerequisites)
2. [Development Environment Setup](#development-environment-setup)
3. [Phase-by-Phase Implementation](#phase-by-phase-implementation)
4. [Quality Assurance](#quality-assurance)
5. [Deployment Guide](#deployment-guide)
6. [Maintenance & Operations](#maintenance--operations)

---

## Prerequisites

### Required Tools & Technologies
- **Node.js** (v18.x or higher)
- **npm** or **yarn** package manager
- **Docker** (v20.x or higher)
- **Docker Compose** (v2.x)
- **Redis** (v7.x)
- **Git** for version control
- **VS Code** or preferred IDE with TypeScript support

### API Keys & Services
- **DeepSeek API Key** (for LLM integration)
- **Redis Cloud** instance (optional for production)

### Knowledge Requirements
- TypeScript/JavaScript (Intermediate)
- Node.js/Express.js (Intermediate)
- RESTful API design
- Docker containerization
- Basic understanding of payment systems
- JWT authentication

---

## Development Environment Setup

### Step 1: Initialize Project Structure

```bash
# Create project directory
mkdir payment-gateway-proxy
cd payment-gateway-proxy

# Initialize npm project
npm init -y

# Install production dependencies
npm install express typescript joi jsonwebtoken winston uuid redis dotenv cors helmet express-rate-limit swagger-jsdoc swagger-ui-express axios

# Install development dependencies
npm install -D @types/node @types/express @types/jsonwebtoken @types/uuid @types/cors jest ts-jest @types/jest @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint prettier nodemon concurrently

# Create directory structure
mkdir -p src/{controllers,services,middleware,models,utils,config,routes,types}
mkdir -p tests/{unit,integration,e2e}
mkdir -p docker
mkdir -p logs
```

### Step 2: Configuration Files

#### TypeScript Configuration
```bash
cat > tsconfig.json << EOF
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
EOF
```

#### Jest Configuration
```bash
cat > jest.config.js << EOF
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
EOF
```

#### ESLint Configuration
```bash
cat > .eslintrc.js << EOF
module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    '@typescript-eslint/recommended',
  ],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/explicit-function-return-type': 'warn',
  },
};
EOF
```

#### Package.json Scripts
```bash
cat > package.json << EOF
{
  "name": "payment-gateway-proxy",
  "version": "1.0.0",
  "description": "Mini Payment Gateway Proxy with LLM Risk Summary",
  "main": "dist/app.js",
  "scripts": {
    "dev": "nodemon src/app.ts",
    "build": "tsc",
    "start": "node dist/app.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    "docker:build": "docker build -t payment-gateway-proxy .",
    "docker:run": "docker-compose up",
    "docker:down": "docker-compose down"
  },
  "keywords": ["payment", "gateway", "llm", "risk-assessment"],
  "author": "Your Name",
  "license": "MIT"
}
EOF
```

### Step 3: Environment Configuration

```bash
cat > .env.example << EOF
# Server Configuration
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# Authentication
CLIENT_ID=test-client
CLIENT_SECRET=test-secret-key
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=24h

# DeepSeek API Configuration
DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_MAX_TOKENS=500
DEEPSEEK_TEMPERATURE=0.1

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Circuit Breaker Configuration
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
CIRCUIT_BREAKER_TIMEOUT=60000
CIRCUIT_BREAKER_RESET_TIMEOUT=30000

# Retry Configuration
RETRY_MAX_ATTEMPTS=3
RETRY_BASE_DELAY=1000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Security
CORS_ORIGIN=http://localhost:3000
API_PREFIX=/api/v1
EOF

# Copy to actual .env file for development
cp .env.example .env
```

---

## Phase-by-Phase Implementation

### Phase 1: Core Foundation (Days 1-3)

#### Day 1: Basic Express Setup

**Step 1.1: Create Basic Types**
```typescript
# src/types/index.ts
export interface Transaction {
  id: string;
  amount: number;
  currency: string;
  merchantId: string;
  customerId: string;
  paymentMethod: PaymentMethod;
  metadata: Record<string, any>;
  status: TransactionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentMethod {
  type: 'card' | 'bank_transfer' | 'digital_wallet';
  cardNumber?: string;
  expiryMonth?: string;
  expiryYear?: string;
  cvv?: string;
  bankAccount?: string;
  walletId?: string;
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export interface RiskAssessment {
  transactionId: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  explanation: string;
  factors: RiskFactor[];
  recommendations: string[];
  assessedAt: Date;
}

export interface RiskFactor {
  factor: string;
  weight: number;
  description: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
```

**Step 1.2: Logger Setup**
```typescript
# src/utils/logger.ts
import winston from 'winston';

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'payment-gateway-proxy' },
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}
```

**Step 1.3: Basic Express App**
```typescript
# src/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000'
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP'
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

export default app;
```

#### Day 2: Authentication & Middleware

**Step 2.1: JWT Utilities**
```typescript
# src/utils/jwt.ts
import jwt from 'jsonwebtoken';
import { logger } from './logger';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export interface JwtPayload {
  clientId: string;
  iat: number;
  exp: number;
}

export const generateToken = (clientId: string): string => {
  try {
    return jwt.sign({ clientId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  } catch (error) {
    logger.error('Error generating JWT token', error);
    throw new Error('Token generation failed');
  }
};

export const verifyToken = (token: string): JwtPayload => {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch (error) {
    logger.error('Error verifying JWT token', error);
    throw new Error('Invalid token');
  }
};
```

**Step 2.2: Authentication Middleware**
```typescript
# src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  clientId?: string;
}

export const authenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header'
      });
      return;
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    req.clientId = decoded.clientId;
    next();
  } catch (error) {
    logger.error('Authentication error', error);
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
};
```

**Step 2.3: Validation Middleware**
```typescript
# src/middleware/validation.middleware.ts
import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '../utils/logger';

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { error, value } = schema.validate(req.body);
      
      if (error) {
        logger.warn('Validation error', { error: error.details });
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.details.map(detail => detail.message)
        });
        return;
      }
      
      req.body = value;
      next();
    } catch (error) {
      logger.error('Validation middleware error', error);
      res.status(500).json({
        success: false,
        error: 'Internal validation error'
      });
    }
  };
};
```

#### Day 3: Error Handling & Utilities

**Step 3.1: Error Middleware**
```typescript
# src/middleware/error.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal server error';

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
  }

  logger.error('Error occurred', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
};

export const notFound = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found`
  });
};
```

**Step 3.2: UUID Utility**
```typescript
# src/utils/uuid.ts
import { v4 as uuidv4 } from 'uuid';

export const generateTransactionId = (): string => {
  return `txn_${uuidv4()}`;
};

export const generateAssessmentId = (): string => {
  return `risk_${uuidv4()}`;
};

export const isValidUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id.replace(/^(txn_|risk_)/, ''));
};
```

### Phase 2: Redis & Caching (Days 4-5)

#### Day 4: Redis Integration

**Step 4.1: Redis Configuration**
```typescript
# src/config/redis.ts
import Redis from 'ioredis';
import { logger } from '../utils/logger';

class RedisClient {
  private client: Redis;
  private static instance: RedisClient;

  private constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    this.client.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    this.client.on('error', (error) => {
      logger.error('Redis connection error', error);
    });
  }

  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  public getClient(): Redis {
    return this.client;
  }

  public async disconnect(): Promise<void> {
    await this.client.disconnect();
  }
}

export const redisClient = RedisClient.getInstance();
```

**Step 4.2: Cache Service**
```typescript
# src/services/cache.service.ts
import { redisClient } from '../config/redis';
import { logger } from '../utils/logger';

export class CacheService {
  private redis = redisClient.getClient();
  
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Cache get error', { key, error });
      return null;
    }
  }

  async set(key: string, value: any, ttl: number = 3600): Promise<boolean> {
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error('Cache set error', { key, error });
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      logger.error('Cache delete error', { key, error });
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error', { key, error });
      return false;
    }
  }

  generateKey(prefix: string, ...parts: string[]): string {
    return `${prefix}:${parts.join(':')}`;
  }
}

export const cacheService = new CacheService();
```

#### Day 5: Event System Implementation

**Step 5.1: Event Publisher**
```typescript
# src/utils/events.ts
import { logger } from './logger';

export interface EventData {
  timestamp: Date;
  source: string;
  [key: string]: any;
}

export class EventPublisher {
  private listeners: Map<string, Array<(data: EventData) => void>> = new Map();
  private static instance: EventPublisher;

  public static getInstance(): EventPublisher {
    if (!EventPublisher.instance) {
      EventPublisher.instance = new EventPublisher();
    }
    return EventPublisher.instance;
  }

  subscribe(event: string, listener: (data: EventData) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
    logger.info(`Event listener subscribed to ${event}`);
  }

  publish(event: string, data: Omit<EventData, 'timestamp'>): void {
    const eventData: EventData = {
      ...data,
      timestamp: new Date()
    };

    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => {
        try {
          listener(eventData);
        } catch (error) {
          logger.error(`Error in event listener for ${event}`, error);
        }
      });
    }

    logger.debug(`Event published: ${event}`, eventData);
  }
}

// Event constants
export const EVENTS = {
  TRANSACTION_CREATED: 'transaction.created',
  TRANSACTION_UPDATED: 'transaction.updated',
  DECISION_BLOCKED: 'decision.blocked',
  PAYMENT_PROCESSED: 'payment.processed',
  RISK_ASSESSED: 'risk.assessed',
  LLM_CALL_FAILED: 'llm.call.failed',
  CIRCUIT_BREAKER_OPENED: 'circuit.breaker.opened'
};

export const eventPublisher = EventPublisher.getInstance();
```

### Phase 3: Circuit Breaker & Retry Logic (Days 6-7)

#### Day 6: Circuit Breaker Implementation

**Step 6.1: Circuit Breaker Utility**
```typescript
# src/utils/circuit-breaker.ts
import { logger } from './logger';
import { eventPublisher, EVENTS } from './events';

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
  fallbackFunction?: () => any;
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: Date;
  private nextAttempt?: Date;

  constructor(
    private name: string,
    private options: CircuitBreakerOptions
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitBreakerState.HALF_OPEN;
        logger.info(`Circuit breaker ${this.name} moved to HALF_OPEN state`);
      } else {
        return this.callFallback();
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private shouldAttemptReset(): boolean {
    return this.nextAttempt ? new Date() >= this.nextAttempt : false;
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.successCount++;
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.CLOSED;
      logger.info(`Circuit breaker ${this.name} reset to CLOSED state`);
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.failureCount >= this.options.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
      this.nextAttempt = new Date(Date.now() + this.options.resetTimeout);
      
      logger.warn(`Circuit breaker ${this.name} opened due to ${this.failureCount} failures`);
      
      eventPublisher.publish(EVENTS.CIRCUIT_BREAKER_OPENED, {
        source: 'CircuitBreaker',
        name: this.name,
        failureCount: this.failureCount
      });
    }
  }

  private callFallback<T>(): T {
    if (this.options.fallbackFunction) {
      return this.options.fallbackFunction();
    }
    throw new Error(`Circuit breaker ${this.name} is OPEN - service unavailable`);
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getStats(): object {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}
```

#### Day 7: Retry Logic Implementation

**Step 7.1: Retry Service**
```typescript
# src/utils/retry.ts
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
    let lastError: Error;
    
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
          error: error.message,
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
      error: lastError.message
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
```

### Phase 4: LLM Integration (Days 8-10)

#### Day 8: OpenAI Service Setup

**Step 8.1: LLM Service**
```typescript
# src/services/llm.service.ts
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
    this.client = axios.create({
      baseURL: 'https://api.openai.com/v1',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    this.circuitBreaker = new CircuitBreaker('LLMService', {
      failureThreshold: parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || '5'),
      resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || '30000'),
      monitoringPeriod: 60000,
      fallbackFunction: this.getFallbackResponse
    });
  }

  async assessTransactionRisk(transaction: Transaction): Promise<RiskAssessment> {
    const cacheKey = cacheService.generateKey('risk_assessment', transaction.id);
    
    // Check cache first
    const cachedResult = await cacheService.get<RiskAssessment>(cacheKey);
    if (cachedResult) {
      logger.debug('Risk assessment retrieved from cache', { transactionId: transaction.id });
      return cachedResult;
    }

    try {
      const assessment = await this.circuitBreaker.execute(async () => {
        return await retryService.execute(() => this.callOpenAI(transaction));
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
        error: error.message 
      });

      eventPublisher.publish(EVENTS.LLM_CALL_FAILED, {
        source: 'LLMService',
        transactionId: transaction.id,
        error: error.message
      });

      return this.getFallbackResponse(transaction);
    }
  }

  private async callOpenAI(transaction: Transaction): Promise<RiskAssessment> {
    const prompt = this.buildRiskAssessmentPrompt(transaction);
    
    const response = await this.client.post('/chat/completions', {
      model: process.env.OPENAI_MODEL || 'gpt-4',
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
      max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || '500'),
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.1')
    });

    return this.parseOpenAIResponse(response.data.choices[0].message.content, transaction);
  }

  private buildRiskAssessmentPrompt(transaction: Transaction): string {
    return `
      Analyze this payment transaction for fraud risk:
      
      Transaction Details:
      - Amount: ${transaction.amount} ${transaction.currency}
      - Payment Method: ${transaction.paymentMethod.type}
      - Customer ID: ${transaction.customerId}
      - Merchant ID: ${transaction.merchantId}
      - Metadata: ${JSON.stringify(transaction.metadata)}
      
      Please provide a risk assessment with:
      1. Risk score (0.0 to 1.0)
      2. Risk level (LOW, MEDIUM, HIGH, CRITICAL)
      3. Explanation of the assessment
      4. Key risk factors identified
      5. Recommendations for handling this transaction
      
      Respond only with valid JSON in this format:
      {
        "riskScore": 0.15,
        "riskLevel": "LOW",
        "explanation": "Low risk transaction...",
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

  private parseOpenAIResponse(content: string, transaction: Transaction): RiskAssessment {
    try {
      const parsed = JSON.parse(content);
      
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
      logger.error('Failed to parse OpenAI response', { error, content });
      return this.getFallbackResponse(transaction);
    }
  }

  private getFallbackResponse(transaction: Transaction): RiskAssessment {
    return {
      transactionId: transaction.id,
      riskScore: 0.5,
      riskLevel: 'MEDIUM',
      explanation: 'Risk assessment service temporarily unavailable. Manual review recommended.',
      factors: [
        {
          factor: 'service_unavailable',
          weight: 0.5,
          description: 'LLM risk assessment service is currently unavailable'
        }
      ],
      recommendations: ['Manual review required', 'Consider declining if high value'],
      assessedAt: new Date()
    };
  }
}

export const llmService = new LLMService();
```

#### Day 9: Risk Assessment Service

**Step 9.1: Risk Assessment Business Logic**
```typescript
# src/services/risk-assessment.service.ts
import { Transaction, RiskAssessment } from '../types';
import { llmService } from './llm.service';
import { logger } from '../utils/logger';
import { eventPublisher, EVENTS } from '../utils/events';

export class RiskAssessmentService {
  private riskThresholds = {
    LOW: 0.3,
    MEDIUM: 0.6,
    HIGH: 0.8
  };

  async assessTransaction(transaction: Transaction): Promise<RiskAssessment> {
    logger.info('Starting risk assessment', { transactionId: transaction.id });

    try {
      // Get LLM-based risk assessment
      const llmAssessment = await llmService.assessTransactionRisk(transaction);
      
      // Apply business rules enhancement
      const enhancedAssessment = await this.enhanceWithBusinessRules(
        llmAssessment, 
        transaction
      );

      // Determine final decision
      const finalAssessment = this.makeFinalDecision(enhancedAssessment, transaction);

      logger.info('Risk assessment completed', { 
        transactionId: transaction.id,
        riskLevel: finalAssessment.riskLevel,
        riskScore: finalAssessment.riskScore
      });

      return finalAssessment;
    } catch (error) {
      logger.error('Risk assessment failed', { 
        transactionId: transaction.id, 
        error: error.message 
      });

      // Return conservative fallback
      return {
        transactionId: transaction.id,
        riskScore: 0.8,
        riskLevel: 'HIGH',
        explanation: 'Risk assessment failed - defaulting to high risk for safety',
        factors: [
          {
            factor: 'assessment_failure',
            weight: 0.8,
            description: 'Risk assessment system failure'
          }
        ],
        recommendations: ['Decline transaction', 'Manual review required'],
        assessedAt: new Date()
      };
    }
  }

  private async enhanceWithBusinessRules(
    llmAssessment: RiskAssessment,
    transaction: Transaction
  ): Promise<RiskAssessment> {
    const enhancedFactors = [...llmAssessment.factors];
    let adjustedScore = llmAssessment.riskScore;

    // Business rule: High amount transactions
    if (transaction.amount > 100000) { // $1000+
      enhancedFactors.push({
        factor: 'high_amount',
        weight: 0.2,
        description: 'Transaction amount exceeds high-value threshold'
      });
      adjustedScore = Math.min(1.0, adjustedScore + 0.2);
    }

    // Business rule: New payment method patterns
    if (transaction.paymentMethod.type === 'digital_wallet') {
      enhancedFactors.push({
        factor: 'digital_wallet',
        weight: 0.1,
        description: 'Digital wallet transactions require additional scrutiny'
      });
      adjustedScore = Math.min(1.0, adjustedScore + 0.1);
    }

    // Business rule: Weekend transactions
    const transactionDay = new Date().getDay();
    if (transactionDay === 0 || transactionDay === 6) {
      enhancedFactors.push({
        factor: 'weekend_transaction',
        weight: 0.05,
        description: 'Weekend transactions have slightly higher risk'
      });
      adjustedScore = Math.min(1.0, adjustedScore + 0.05);
    }

    return {
      ...llmAssessment,
      riskScore: adjustedScore,
      riskLevel: this.determineRiskLevel(adjustedScore),
      factors: enhancedFactors
    };
  }

  private makeFinalDecision(
    assessment: RiskAssessment,
    transaction: Transaction
  ): RiskAssessment {
    const { riskLevel, riskScore } = assessment;
    let shouldBlock = false;
    let additionalRecommendations: string[] = [];

    // Decision logic based on risk level
    switch (riskLevel) {
      case 'CRITICAL':
        shouldBlock = true;
        additionalRecommendations = ['Block transaction immediately', 'Flag account for review'];
        break;
      case 'HIGH':
        shouldBlock = transaction.amount > 50000; // Block high-value high-risk transactions
        additionalRecommendations = ['Require additional verification', 'Monitor closely'];
        break;
      case 'MEDIUM':
        additionalRecommendations = ['Consider additional verification for high amounts'];
        break;
      case 'LOW':
        additionalRecommendations = ['Process normally'];
        break;
    }

    if (shouldBlock) {
      eventPublisher.publish(EVENTS.DECISION_BLOCKED, {
        source: 'RiskAssessmentService',
        transactionId: transaction.id,
        riskLevel,
        riskScore,
        reason: 'High risk transaction blocked by assessment engine'
      });
    }

    return {
      ...assessment,
      recommendations: [...assessment.recommendations, ...additionalRecommendations]
    };
  }

  private determineRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (score >= this.riskThresholds.HIGH) return 'CRITICAL';
    if (score >= this.riskThresholds.MEDIUM) return 'HIGH';
    if (score >= this.riskThresholds.LOW) return 'MEDIUM';
    return 'LOW';
  }
}

export const riskAssessmentService = new RiskAssessmentService();
```

#### Day 10: Fraud Rule Configuration & Validation Schemas

**Step 10.1: YAML Fraud Rule Configuration**
```yaml
# config/fraud-rules.yml
# Risk thresholds for scoring
thresholds:
  low: 0.3
  medium: 0.6
  high: 0.8
  critical: 0.9

# Payment provider configurations
providers:
  - name: "paypal"
    priority: 1
    riskTolerance: "medium"
    enabled: true
  - name: "stripe"
    priority: 2
    riskTolerance: "low"
    enabled: true

# Fraud detection rules
rules:
  - name: "high_amount_rule"
    enabled: true
    weight: 0.3
    action: "flag"
    conditions:
      - field: "amount"
        operator: "gt"
        value: 100000
        description: "Transaction amount exceeds $1000"

  - name: "suspicious_email_domain"
    enabled: true
    weight: 0.4
    action: "block"
    conditions:
      - field: "email"
        operator: "contains"
        value: "@tempmail."
        description: "Email from temporary mail service"
```

**Step 10.2: Request Validation Schemas**
```typescript
# src/schemas/payment.schemas.ts
import Joi from 'joi';

export const processPaymentSchema = Joi.object({
  amount: Joi.number().positive().max(1000000).required()
    .messages({
      'number.positive': 'Amount must be positive',
      'number.max': 'Amount cannot exceed $10,000'
    }),
  
  currency: Joi.string().length(3).uppercase().required()
    .valid('USD', 'EUR', 'GBP', 'CAD')
    .messages({
      'string.length': 'Currency must be 3 characters',
      'any.only': 'Currency must be one of USD, EUR, GBP, CAD'
    }),
  
  paymentMethod: Joi.object({
    type: Joi.string().valid('card', 'bank_transfer', 'digital_wallet').required(),
    cardNumber: Joi.when('type', {
      is: 'card',
      then: Joi.string().creditCard().required(),
      otherwise: Joi.forbidden()
    }),
    expiryMonth: Joi.when('type', {
      is: 'card',
      then: Joi.string().pattern(/^(0[1-9]|1[0-2])$/).required(),
      otherwise: Joi.forbidden()
    }),
    expiryYear: Joi.when('type', {
      is: 'card',
      then: Joi.string().pattern(/^20[2-9][0-9]$/).required(),
      otherwise: Joi.forbidden()
    }),
    cvv: Joi.when('type', {
      is: 'card',
      then: Joi.string().pattern(/^[0-9]{3,4}$/).required(),
      otherwise: Joi.forbidden()
    }),
    bankAccount: Joi.when('type', {
      is: 'bank_transfer',
      then: Joi.string().min(8).max(20).required(),
      otherwise: Joi.forbidden()
    }),
    walletId: Joi.when('type', {
      is: 'digital_wallet',
      then: Joi.string().min(5).max(50).required(),
      otherwise: Joi.forbidden()
    })
  }).required(),
  
  customer: Joi.object({
    id: Joi.string().min(3).max(50).required(),
    email: Joi.string().email().required()
  }).required(),
  
  merchant: Joi.object({
    id: Joi.string().min(3).max(50).required()
  }).required(),
  
  metadata: Joi.object().pattern(Joi.string(), Joi.any()).optional()
});
```

### Phase 5: API Development & Controllers (Days 11-14)

#### Day 11: Authentication Controllers

**Step 11.1: Auth Controller**
```typescript
# src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import { generateToken } from '../utils/jwt';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types';

export class AuthController {
  async createToken(req: Request, res: Response): Promise<void> {
    try {
      const { clientId, clientSecret } = req.body;

      // In production, validate against database
      if (!this.validateClientCredentials(clientId, clientSecret)) {
        res.status(401).json({
          success: false,
          error: 'Invalid client credentials'
        } as ApiResponse<never>);
        return;
      }

      const token = generateToken(clientId);

      logger.info('Token generated successfully', { clientId });

      res.status(200).json({
        success: true,
        data: {
          token,
          expiresIn: process.env.JWT_EXPIRES_IN || '24h',
          tokenType: 'Bearer'
        }
      } as ApiResponse<any>);
    } catch (error) {
      logger.error('Token generation failed', error);
      res.status(500).json({
        success: false,
        error: 'Token generation failed'
      } as ApiResponse<never>);
    }
  }

  private validateClientCredentials(clientId: string, clientSecret: string): boolean {
    // Validate against environment variables
    const validClientId = process.env.CLIENT_ID;
    const validClientSecret = process.env.CLIENT_SECRET;
    
    return clientId === validClientId && clientSecret === validClientSecret;
  }
}

export const authController = new AuthController();
```

**Step 11.2: Auth Routes**
```typescript
# src/routes/auth.routes.ts
import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middleware/validation.middleware';
import Joi from 'joi';

const router = Router();

const createTokenSchema = Joi.object({
  clientId: Joi.string().min(3).max(50).required(),
  clientSecret: Joi.string().min(6).max(100).required()
});

/**
 * @swagger
 * /auth/token:
 *   post:
 *     summary: Generate JWT token for API access
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               clientId:
 *                 type: string
 *                 example: "test-client"
 *               clientSecret:
 *                 type: string
 *                 example: "test-secret"
 *     responses:
 *       200:
 *         description: Token generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                     expiresIn:
 *                       type: string
 *                     tokenType:
 *                       type: string
 */
router.post('/token', validate(createTokenSchema), authController.createToken);

export default router;
```

#### Day 12: Payment Controllers

**Step 12.1: Payment Controller**
```typescript
# src/controllers/payment.controller.ts
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { Transaction, TransactionStatus, ApiResponse } from '../types';
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
      
      const transaction: Transaction = {
        id: transactionId,
        amount: req.body.amount,
        currency: req.body.currency,
        merchantId: req.body.merchant.id,
        customerId: req.body.customer.id,
        paymentMethod: req.body.paymentMethod,
        metadata: req.body.metadata || {},
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
        currency: transaction.currency
      });

      // Process payment with integrated risk assessment
      const processedTransaction = await paymentService.processTransaction(transaction);
      
      this.transactions.set(transactionId, processedTransaction);

      logger.info('Payment processed', {
        transactionId,
        amount: processedTransaction.amount,
        status: processedTransaction.status
      });

      res.status(201).json({
        success: true,
        data: {
          transactionId,
          status: processedTransaction.status,
          riskAssessment: processedTransaction.metadata.riskAssessment
        }
      } as ApiResponse<any>);

    } catch (error) {
      logger.error('Payment processing failed', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Payment processing failed'
      } as ApiResponse<never>);
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
        );
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
      logger.error('Failed to get payment status', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve payment status'
      } as ApiResponse<never>);
    }
  }

  async listPayments(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;

      const allTransactions = Array.from(this.transactions.values());
      const paginatedTransactions = allTransactions.slice(offset, offset + limit);

      res.status(200).json({
        success: true,
        data: {
          transactions: paginatedTransactions.map(t => ({
            transactionId: t.id,
            amount: t.amount,
            currency: t.currency,
            status: t.status,
            createdAt: t.createdAt
          })),
          pagination: {
            page,
            limit,
            total: allTransactions.length,
            totalPages: Math.ceil(allTransactions.length / limit)
          }
        }
      } as ApiResponse<any>);

    } catch (error) {
      logger.error('Failed to list payments', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to list payments'
      } as ApiResponse<never>);
    }
  }
}

export const paymentController = new PaymentController();
```

#### Day 13: Simplify Payment Service

**Step 13.1: Enhanced Payment Service**
```typescript
# src/services/payment.service.ts
import { Transaction, TransactionStatus } from '../types';
import { llmService } from './llm.service';
import { logger } from '../utils/logger';
import { eventPublisher, EVENTS } from '../utils/events';

export class PaymentService {
  async processTransaction(transaction: Transaction): Promise<Transaction> {
    try {
      logger.info('Processing transaction', { transactionId: transaction.id });

      // Perform LLM risk assessment as part of payment processing
      const riskAssessment = await llmService.assessTransactionRisk(transaction);
      
      // Update transaction status based on risk level
      transaction.status = this.determineTransactionStatus(riskAssessment.riskLevel);
      transaction.updatedAt = new Date();

      // Store risk assessment in transaction metadata
      transaction.metadata.riskAssessment = riskAssessment;

      // Publish events
      eventPublisher.publish(EVENTS.PAYMENT_PROCESSED, {
        source: 'PaymentService',
        transactionId: transaction.id,
        status: transaction.status,
        riskLevel: riskAssessment.riskLevel
      });

      logger.info('Transaction processed successfully', {
        transactionId: transaction.id,
        status: transaction.status,
        riskLevel: riskAssessment.riskLevel
      });

      return transaction;
    } catch (error) {
      logger.error('Transaction processing failed', {
        transactionId: transaction.id,
        error: error.message
      });
      
      transaction.status = TransactionStatus.FAILED;
      transaction.updatedAt = new Date();
      
      return transaction;
    }
  }

  private determineTransactionStatus(riskLevel: string): TransactionStatus {
    switch (riskLevel) {
      case 'CRITICAL':
        return TransactionStatus.FAILED;
      case 'HIGH':
        return TransactionStatus.PENDING; // Requires manual review
      case 'MEDIUM':
      case 'LOW':
        return TransactionStatus.PROCESSING;
      default:
        return TransactionStatus.PENDING;
    }
  }
}

export const paymentService = new PaymentService();
```

#### Day 14: Complete API Routes

**Step 14.1: Payment Routes**
```typescript
# src/routes/payment.routes.ts
import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { processPaymentSchema } from '../schemas/payment.schemas';

const router = Router();

// All payment routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /payments/usage:
 *   post:
 *     summary: Process a new payment with integrated risk assessment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProcessPaymentRequest'
 *     responses:
 *       201:
 *         description: Payment initiated successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 */
router.post('/usage', validate(processPaymentSchema), paymentController.processPayment);

/**
 * @swagger
 * /payments/{transactionId}:
 *   get:
 *     summary: Get payment status with risk assessment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment status retrieved
 *       404:
 *         description: Transaction not found
 */
router.get('/:transactionId', paymentController.getPaymentStatus);

export default router;
```

### Phase 6: Testing Implementation (Days 15-18)

#### Day 15: Unit Testing Setup

**Step 15.1: Test Utilities**
```typescript
# tests/utils/test-helpers.ts
import { Transaction, TransactionStatus } from '../../src/types';
import { generateTransactionId } from '../../src/utils/uuid';

export const createMockTransaction = (overrides?: Partial<Transaction>): Transaction => {
  return {
    id: generateTransactionId(),
    amount: 10000,
    currency: 'USD',
    merchantId: 'merchant_123',
    customerId: 'customer_456',
    paymentMethod: {
      type: 'card',
      cardNumber: '4111111111111111',
      expiryMonth: '12',
      expiryYear: '2025',
      cvv: '123'
    },
    metadata: {},
    status: TransactionStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
};

export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};
```

**Step 15.2: Circuit Breaker Tests**
```typescript
# tests/unit/circuit-breaker.test.ts
import { CircuitBreaker, CircuitBreakerState } from '../../src/utils/circuit-breaker';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker('TestBreaker', {
      failureThreshold: 3,
      resetTimeout: 1000,
      monitoringPeriod: 5000,
      fallbackFunction: () => 'fallback response'
    });
  });

  describe('execute', () => {
    it('should execute operation successfully when circuit is closed', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      const result = await circuitBreaker.execute(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should open circuit after failure threshold is reached', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('operation failed'));
      
      // Trigger failures to reach threshold
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(operation);
        } catch (error) {
          // Expected to fail
        }
      }
      
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
    });

    it('should return fallback when circuit is open', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('operation failed'));
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(operation);
        } catch (error) {
          // Expected to fail
        }
      }
      
      // Now operation should return fallback
      const result = await circuitBreaker.execute(operation);
      expect(result).toBe('fallback response');
    });
  });
});
```

#### Day 16: Service Testing

**Step 16.1: Risk Assessment Service Tests**
```typescript
# tests/unit/risk-assessment.service.test.ts
import { RiskAssessmentService } from '../../src/services/risk-assessment.service';
import { llmService } from '../../src/services/llm.service';
import { createMockTransaction } from '../utils/test-helpers';
import { RiskAssessment } from '../../src/types';

jest.mock('../../src/services/llm.service');
const mockLLMService = llmService as jest.Mocked<typeof llmService>;

describe('RiskAssessmentService', () => {
  let riskAssessmentService: RiskAssessmentService;

  beforeEach(() => {
    riskAssessmentService = new RiskAssessmentService();
    jest.clearAllMocks();
  });

  describe('assessTransaction', () => {
    it('should assess low risk transaction correctly', async () => {
      const transaction = createMockTransaction({ amount: 5000 });
      const mockLLMResponse: RiskAssessment = {
        transactionId: transaction.id,
        riskScore: 0.2,
        riskLevel: 'LOW',
        explanation: 'Low risk transaction',
        factors: [],
        recommendations: ['Process normally'],
        assessedAt: new Date()
      };

      mockLLMService.assessTransactionRisk.mockResolvedValue(mockLLMResponse);

      const result = await riskAssessmentService.assessTransaction(transaction);

      expect(result.riskLevel).toBe('LOW');
      expect(result.riskScore).toBeLessThanOrEqual(0.3);
      expect(mockLLMService.assessTransactionRisk).toHaveBeenCalledWith(transaction);
    });

    it('should enhance assessment with business rules for high amount', async () => {
      const transaction = createMockTransaction({ amount: 150000 }); // $1500
      const mockLLMResponse: RiskAssessment = {
        transactionId: transaction.id,
        riskScore: 0.3,
        riskLevel: 'MEDIUM',
        explanation: 'Medium risk transaction',
        factors: [],
        recommendations: [],
        assessedAt: new Date()
      };

      mockLLMService.assessTransactionRisk.mockResolvedValue(mockLLMResponse);

      const result = await riskAssessmentService.assessTransaction(transaction);

      expect(result.riskScore).toBeGreaterThan(0.3); // Should be enhanced
      expect(result.factors.some(f => f.factor === 'high_amount')).toBe(true);
    });

    it('should handle LLM service failure gracefully', async () => {
      const transaction = createMockTransaction();
      mockLLMService.assessTransactionRisk.mockRejectedValue(new Error('LLM service failed'));

      const result = await riskAssessmentService.assessTransaction(transaction);

      expect(result.riskLevel).toBe('HIGH');
      expect(result.explanation).toContain('assessment failed');
      expect(result.recommendations).toContain('Decline transaction');
    });
  });
});
```

#### Day 17: Integration Testing

**Step 17.1: API Integration Tests**
```typescript
# tests/integration/payment-api.test.ts
import request from 'supertest';
import app from '../../src/app';
import { generateToken } from '../../src/utils/jwt';

describe('Payment API Integration', () => {
  let authToken: string;

  beforeAll(async () => {
    authToken = generateToken('test-client');
  });

  describe('POST /api/v1/payments/usage', () => {
    it('should process payment successfully', async () => {
      const paymentData = {
        amount: 1000,
        currency: 'USD',
        source: 'tok_test',
        email: 'donor@example.com'
      };

      const response = await request(app)
        .post('/api/v1/payments/usage')
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData)
        .expect(201);

      expect(response.body.transactionId).toMatch(/^txn_/);
      expect(response.body.provider).toBeDefined();
      expect(response.body.status).toBeDefined();
      expect(response.body.riskScore).toBeDefined();
      expect(response.body.explanation).toBeDefined();
    });

    it('should reject invalid payment data', async () => {
      const invalidPaymentData = {
        amount: -100, // Invalid negative amount
        currency: 'INVALID',
        source: 'tok_test',
        email: 'invalid-email'
      };

      const response = await request(app)
        .post('/api/v1/payments/usage')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidPaymentData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should reject unauthorized requests', async () => {
      const paymentData = {
        amount: 1000,
        currency: 'USD',
        source: 'tok_test',
        email: 'donor@example.com'
      };

      await request(app)
        .post('/api/v1/payments/usage')
        .send(paymentData)
        .expect(401);
    });
  });

  describe('GET /api/v1/payments/:transactionId', () => {
    let transactionId: string;

    beforeEach(async () => {
      // Create a transaction first
      const paymentData = {
        amount: 5000,
        currency: 'USD',
        source: 'tok_test',
        email: 'test@example.com'
      };

      const response = await request(app)
        .post('/api/v1/payments/usage')
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData);

      transactionId = response.body.transactionId;
    });

    it('should get payment status successfully', async () => {
      const response = await request(app)
        .get(`/api/v1/payments/${transactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactionId).toBe(transactionId);
      expect(response.body.data.status).toBeDefined();
    });

    it('should return 404 for non-existent transaction', async () => {
      await request(app)
        .get('/api/v1/payments/txn_nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
```

#### Day 18: End-to-End Testing

**Step 18.1: E2E Test Setup**
```typescript
# tests/e2e/payment-flow.test.ts
import request from 'supertest';
import app from '../../src/app';

describe('Payment Flow E2E', () => {
  let authToken: string;

  beforeAll(async () => {
    // Get authentication token
    const authResponse = await request(app)
      .post('/api/v1/auth/token')
      .send({
        clientId: 'test-client',
        clientSecret: 'test-secret'
      })
      .expect(200);

    authToken = authResponse.body.data.token;
  });

  it('should complete full payment and risk assessment flow', async () => {
    // Step 1: Process payment
    const paymentData = {
      amount: 25000,
      currency: 'USD',
      source: 'tok_e2e_test',
      email: 'e2e@example.com'
    };

    const paymentResponse = await request(app)
      .post('/api/v1/payments/usage')
      .set('Authorization', `Bearer ${authToken}`)
      .send(paymentData)
      .expect(201);

    const { transactionId } = paymentResponse.body;
    expect(transactionId).toMatch(/^txn_/);

    // Step 2: Check payment status
    const statusResponse = await request(app)
      .get(`/api/v1/payments/${transactionId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(statusResponse.body.data.amount).toBe(paymentData.amount);
    expect(statusResponse.body.data.currency).toBe(paymentData.currency);

    // Step 3: Get detailed risk assessment
    const riskResponse = await request(app)
      .get(`/api/v1/risk/${transactionId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(riskResponse.body.data.transactionId).toBe(transactionId);
    expect(riskResponse.body.data.riskLevel).toMatch(/^(LOW|MEDIUM|HIGH|CRITICAL)$/);
    expect(riskResponse.body.data.explanation).toBeDefined();

    // Step 4: List payments and verify our transaction is there
    const listResponse = await request(app)
      .get('/api/v1/payments?page=1&limit=10')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const transactions = listResponse.body.data.transactions;
    expect(transactions.some((t: any) => t.transactionId === transactionId)).toBe(true);
  });
});
```

### Phase 7: Documentation & Deployment (Days 19-24)

#### Day 19: Swagger Documentation

**Step 19.1: Complete Swagger Setup**
```typescript
# src/config/swagger.ts
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Payment Gateway Proxy API',
      version: '1.0.0',
      description: 'Mini Payment Gateway Proxy with LLM Risk Summary',
      contact: {
        name: 'API Support',
        email: 'support@paymentgateway.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000/api/v1',
        description: 'Development server'
      },
      {
        url: 'https://api.paymentgateway.com/v1',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        ProcessPaymentRequest: {
          type: 'object',
          required: ['amount', 'currency', 'paymentMethod', 'customer', 'merchant'],
          properties: {
            amount: {
              type: 'integer',
              minimum: 1,
              maximum: 1000000,
              description: 'Amount in cents',
              example: 10000
            },
            currency: {
              type: 'string',
              enum: ['USD', 'EUR', 'GBP', 'CAD'],
              example: 'USD'
            },
            paymentMethod: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['card', 'bank_transfer', 'digital_wallet']
                }
              }
            },
            customer: {
              type: 'object',
              properties: {
                id: { type: 'string', example: 'customer_123' },
                email: { type: 'string', format: 'email', example: 'customer@example.com' }
              }
            },
            merchant: {
              type: 'object',
              properties: {
                id: { type: 'string', example: 'merchant_456' }
              }
            },
            metadata: {
              type: 'object',
              additionalProperties: true
            }
          }
        },
        Transaction: {
          type: 'object',
          properties: {
            transactionId: { type: 'string', example: 'txn_12345678-1234-4321-abcd-123456789012' },
            amount: { type: 'integer', example: 10000 },
            currency: { type: 'string', example: 'USD' },
            status: { 
              type: 'string',
              enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        RiskAssessment: {
          type: 'object',
          properties: {
            transactionId: { type: 'string' },
            riskScore: { type: 'number', minimum: 0, maximum: 1 },
            riskLevel: { 
              type: 'string',
              enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
            },
            explanation: { type: 'string' },
            factors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  factor: { type: 'string' },
                  weight: { type: 'number' },
                  description: { type: 'string' }
                }
              }
            },
            recommendations: {
              type: 'array',
              items: { type: 'string' }
            },
            assessedAt: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  },
  apis: ['./src/routes/*.ts']
};

export const specs = swaggerJsdoc(options);
export { swaggerUi };
```

#### Day 20: Docker Configuration

**Step 20.1: Dockerfile**
```dockerfile
# Dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies first (for better caching)
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built application
COPY dist/ ./dist/
COPY logs/ ./logs/

# Set ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["node", "dist/app.js"]
```

**Step 20.2: Docker Compose**
```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
      - LOG_LEVEL=info
    env_file:
      - .env.production
    depends_on:
      redis:
        condition: service_healthy
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
    networks:
      - payment_network

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - payment_network

  redis-commander:
    image: rediscommander/redis-commander:latest
    environment:
      - REDIS_HOSTS=local:redis:6379
    ports:
      - "8081:8081"
    depends_on:
      - redis
    profiles:
      - dev
    networks:
      - payment_network

volumes:
  redis_data:

networks:
  payment_network:
    driver: bridge
```

#### Day 21: Production Configuration

**Step 21.1: Production Environment**
```bash
# .env.production
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Authentication (Use strong values in production)
CLIENT_ID=production-client
CLIENT_SECRET=super-secret-client-key-change-this
JWT_SECRET=super-secret-production-key-change-this
JWT_EXPIRES_IN=24h

# OpenAI Configuration
OPENAI_API_KEY=your-production-openai-api-key
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=500
OPENAI_TEMPERATURE=0.1

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Circuit Breaker Configuration
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
CIRCUIT_BREAKER_TIMEOUT=60000
CIRCUIT_BREAKER_RESET_TIMEOUT=30000

# Retry Configuration
RETRY_MAX_ATTEMPTS=3
RETRY_BASE_DELAY=1000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000

# Security
CORS_ORIGIN=https://yourdomain.com
API_PREFIX=/api/v1
```

**Step 21.2: Production Build Script**
```bash
# scripts/build.sh
#!/bin/bash

echo "Building Payment Gateway Proxy..."

# Clean previous build
rm -rf dist/

# Build TypeScript
npm run build

# Copy static files
cp -r src/config/swagger.json dist/config/ 2>/dev/null || true

# Create logs directory
mkdir -p logs

echo "Build completed successfully!"
```

#### Day 22: Monitoring & Logging Setup

**Step 22.1: Enhanced Logging Configuration**
```typescript
# src/utils/monitoring.ts
import { logger } from './logger';
import { eventPublisher, EVENTS } from './events';

export interface MetricsData {
  transactionCount: number;
  successfulTransactions: number;
  failedTransactions: number;
  averageResponseTime: number;
  riskAssessmentCount: number;
  circuitBreakerTrips: number;
}

export class MonitoringService {
  private metrics: MetricsData = {
    transactionCount: 0,
    successfulTransactions: 0,
    failedTransactions: 0,
    averageResponseTime: 0,
    riskAssessmentCount: 0,
    circuitBreakerTrips: 0
  };

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    eventPublisher.subscribe(EVENTS.TRANSACTION_CREATED, (data) => {
      this.metrics.transactionCount++;
      logger.info('Transaction created metric', { 
        total: this.metrics.transactionCount,
        transactionId: data.transactionId 
      });
    });

    eventPublisher.subscribe(EVENTS.DECISION_BLOCKED, (data) => {
      this.metrics.failedTransactions++;
      logger.warn('Transaction blocked', {
        transactionId: data.transactionId,
        reason: data.reason
      });
    });

    eventPublisher.subscribe(EVENTS.RISK_ASSESSED, (data) => {
      this.metrics.riskAssessmentCount++;
      logger.info('Risk assessment completed', {
        transactionId: data.transactionId,
        riskLevel: data.riskLevel
      });
    });

    eventPublisher.subscribe(EVENTS.CIRCUIT_BREAKER_OPENED, (data) => {
      this.metrics.circuitBreakerTrips++;
      logger.error('Circuit breaker opened', {
        service: data.name,
        failureCount: data.failureCount
      });
    });
  }

  getMetrics(): MetricsData {
    return { ...this.metrics };
  }

  logMetrics(): void {
    logger.info('System metrics', this.metrics);
  }
}

export const monitoringService = new MonitoringService();

// Log metrics every 5 minutes
setInterval(() => {
  monitoringService.logMetrics();
}, 5 * 60 * 1000);
```

#### Day 23: Final Integration & Testing

**Step 23.1: Complete App Integration**
```typescript
# src/app.ts (Final Version)
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { specs, swaggerUi } from './config/swagger';
import { logger } from './utils/logger';
import { errorHandler, notFound } from './middleware/error.middleware';
import { monitoringService } from './utils/monitoring';

// Routes
import authRoutes from './routes/auth.routes';
import paymentRoutes from './routes/payment.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_PREFIX = process.env.API_PREFIX || '/api/v1';

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API Documentation
app.use('/docs', swaggerUi.serve, swaggerUi.setup(specs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }'
}));

// Health check
app.get('/health', (req, res) => {
  const metrics = monitoringService.getMetrics();
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    metrics
  });
});

// API Routes
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/payments`, paymentRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(`🚀 Payment Gateway Proxy server running on port ${PORT}`);
  logger.info(`📚 API Documentation available at http://localhost:${PORT}/docs`);
  logger.info(`🔍 Health check at http://localhost:${PORT}/health`);
});

export default app;
```

#### Day 24: Deployment Scripts & Documentation

**Step 24.1: Deployment Scripts**
```bash
# scripts/deploy.sh
#!/bin/bash

set -e

echo "🚀 Deploying Payment Gateway Proxy..."

# Build the application
echo "📦 Building application..."
npm run build

# Build Docker image
echo "🐳 Building Docker image..."
docker build -t payment-gateway-proxy:latest .

# Run tests
echo "🧪 Running tests..."
npm run test

# Deploy with Docker Compose
echo "🚀 Starting services..."
docker-compose -f docker-compose.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 10

# Health check
echo "🔍 Performing health check..."
curl -f http://localhost:3000/health || exit 1

echo "✅ Deployment completed successfully!"
echo "📚 API Documentation: http://localhost:3000/docs"
echo "🔍 Health Check: http://localhost:3000/health"
```

**Step 24.2: README Documentation**
```markdown
# README.md
# Payment Gateway Proxy with LLM Risk Summary

A robust, scalable payment gateway proxy service that integrates with OpenAI for intelligent risk assessment.

## Features

- 🔐 JWT-based authentication
- 💳 Payment processing with multiple payment methods
- 🤖 AI-powered risk assessment using OpenAI
- 🔄 Circuit breaker pattern for resilience
- 🔁 Retry mechanism with exponential backoff
- 📊 Real-time event publishing and monitoring
- 🗄️ Redis caching for performance
- 📋 Comprehensive API documentation
- 🐳 Docker containerization
- 🧪 Comprehensive testing suite

## Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- Redis
- OpenAI API Key

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd payment-gateway-proxy
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start development server:
```bash
npm run dev
```

### Docker Deployment

```bash
# Build and start all services
docker-compose up -d

# Check logs
docker-compose logs -f app

# Stop services
docker-compose down
```

## API Documentation

Visit `http://localhost:3000/docs` for interactive API documentation.

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm test -- tests/unit/
```

## Architecture

The system follows a modular architecture with clear separation of concerns:

- **Controllers**: Handle HTTP requests and responses
- **Services**: Contain business logic
- **Utils**: Provide utility functions and patterns
- **Middleware**: Handle cross-cutting concerns
- **Models**: Define data structures

## Environment Variables

See `.env.example` for all configuration options.

## Production Deployment

1. Set up production environment variables
2. Build the application: `npm run build`
3. Deploy using Docker: `docker-compose -f docker-compose.yml up -d`

## Monitoring

The application provides:
- Health check endpoint: `/health`
- Structured logging with Winston
- Metrics collection and reporting
- Event-driven monitoring

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License
```

---

## Quality Assurance

### Code Quality Checklist
- [ ] TypeScript strict mode enabled
- [ ] ESLint configuration
- [ ] Prettier code formatting
- [ ] Pre-commit hooks
- [ ] Test coverage > 80%
- [ ] API documentation complete
- [ ] Error handling comprehensive
- [ ] Security best practices followed
- [ ] Performance optimizations applied

### Security Checklist
- [ ] Input validation with Joi
- [ ] JWT token security
- [ ] Rate limiting implemented
- [ ] CORS configuration
- [ ] Helmet security headers
- [ ] Environment variables secured
- [ ] SQL injection prevention
- [ ] XSS protection

### Performance Checklist
- [ ] Redis caching implemented
- [ ] Circuit breaker pattern
- [ ] Retry with exponential backoff
- [ ] Database query optimization
- [ ] Response compression
- [ ] Connection pooling
- [ ] Load testing completed

---

This comprehensive implementation plan provides detailed, step-by-step instructions for developing the Mini Payment Gateway Proxy with LLM Risk Summary. Each phase builds upon the previous one, ensuring a solid foundation and progressive enhancement of features.

The plan includes:
- ✅ Complete 24-day development timeline
- ✅ Simplified and modular architecture
- ✅ Basic authentication using environment variables
- ✅ Integrated risk assessment within payment processing
- ✅ Circuit breaker and retry patterns for LLM resilience
- ✅ Observer pattern for event-driven monitoring
- ✅ Docker containerization with Node Alpine
- ✅ Swagger API documentation
- ✅ Redis caching for performance
- ✅ Comprehensive error handling and logging

The implementation follows industry best practices and provides a production-ready solution that can handle real-world payment processing scenarios with intelligent risk assessment capabilities.
