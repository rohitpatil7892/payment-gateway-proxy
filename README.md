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

## Tested Implementation Steps

The following steps have been verified and tested:

### 1. Build and Start the Service

```bash
# Install dependencies with compatible versions
npm install uuid@9.0.1 --save

# Build the application
npm run build

# Start the service
npm start
```

### 2. Verify Service Health

```bash
curl -s http://localhost:3000/health
```

Expected: `{"status":"OK","timestamp":"...","service":"payment-gateway-proxy"}`

### 3. Test Authentication Flow

```bash
# Get JWT token
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "testClient123",
    "clientSecret": "secretKey987xyz"
  }' | jq -r '.data.token')

echo "Token: $TOKEN"
```

### 4. Test Payment Processing

```bash
# Process a payment
curl -s -X POST http://localhost:3000/api/v1/payments/process \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "amount": 10000,
    "currency": "USD",
    "paymentMethod": {
      "type": "card",
      "cardNumber": "4111111111111111",
      "expiryMonth": "12",
      "expiryYear": "2025",
      "cvv": "123"
    },
    "customer": {
      "id": "customer_123",
      "email": "test@example.com"
    },
    "merchant": {
      "id": "merchant_456"
    }
  }' | jq .
```

### 5. Verify Payment Status

```bash
# Replace with actual transaction ID from step 4
curl -s -X GET http://localhost:3000/api/v1/payments/txn_your-transaction-id \
  -H "Authorization: Bearer $TOKEN" | jq .
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

## API Usage Examples

### 1. Get Authentication Token

```bash
curl -X POST http://localhost:3000/api/v1/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "testClient123",
    "clientSecret": "secretKey987xyz"
  }'
```

Expected Response:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "24h",
    "tokenType": "Bearer"
  }
}
```

### 2. Process Payment

```bash
curl -X POST http://localhost:3000/api/v1/payments/process \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "amount": 10000,
    "currency": "USD",
    "paymentMethod": {
      "type": "card",
      "cardNumber": "4111111111111111",
      "expiryMonth": "12",
      "expiryYear": "2025",
      "cvv": "123"
    },
    "customer": {
      "id": "customer_123",
      "email": "test@example.com"
    },
    "merchant": {
      "id": "merchant_456"
    },
    "metadata": {
      "orderId": "order_789"
    }
  }'
```

Expected Response:
```json
{
  "success": true,
  "data": {
    "transactionId": "txn_e4453be5-15a1-4fb5-bf81-81cfc157cee8",
    "status": "PROCESSING",
    "riskAssessment": {
      "transactionId": "txn_e4453be5-15a1-4fb5-bf81-81cfc157cee8",
      "riskScore": 0.5,
      "riskLevel": "MEDIUM",
      "explanation": "Risk assessment completed with LLM analysis",
      "factors": [...],
      "recommendations": [...],
      "assessedAt": "2025-09-10T13:01:15.584Z"
    }
  }
}
```

### 3. Get Payment Status

```bash
curl -X GET http://localhost:3000/api/v1/payments/{transactionId} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Expected Response:
```json
{
  "success": true,
  "data": {
    "transactionId": "txn_e4453be5-15a1-4fb5-bf81-81cfc157cee8",
    "status": "PROCESSING",
    "amount": 10000,
    "currency": "USD",
    "createdAt": "2025-09-10T13:01:10.736Z",
    "updatedAt": "2025-09-10T13:01:15.584Z"
  }
}
```

## Environment Variables

### Required Configuration

```env
# Authentication
CLIENT_ID=testClient123
CLIENT_SECRET=secretKey987xyz
JWT_SECRET=111b3cf4-da76-471f-8126-b00fa7b3e202

# LLM Configuration (DeepSeek API)
OPENAI_API_KEY=sk-314bf8549e3c413193cfaa3f8ecd2272
OPENAI_MODEL=deepseek-chat
```

### Optional Configuration

```env
# Server
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Circuit Breaker
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
CIRCUIT_BREAKER_TIMEOUT=60000

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=100
```

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm test -- tests/unit/
```

## Test Results Summary

✅ **Authentication Endpoint**: Working with JWT token generation  
✅ **Payment Processing**: Working with risk assessment fallback  
✅ **Payment Status**: Working with transaction lookup  
✅ **Health Check**: Working  
✅ **Error Handling**: Working (graceful fallback when LLM unavailable)  
✅ **Redis Integration**: Working  
✅ **Circuit Breaker**: Working (falls back when DeepSeek API fails)  
✅ **Retry Logic**: Working (3 attempts with exponential backoff)  

## Architecture

The system follows a modular architecture with clear separation of concerns:

- **Controllers**: Handle HTTP requests and responses
- **Services**: Contain business logic
- **Utils**: Provide utility functions and patterns
- **Middleware**: Handle cross-cutting concerns
- **Models**: Define data structures

### Risk Assessment Flow

1. Transaction received via API
2. LLM service analyzes transaction data
3. Business rules applied for enhancement
4. Final risk score calculated
5. Transaction status determined
6. Response sent with risk assessment

## Development

### Build the application
```bash
npm run build
```

### Start production server
```bash
npm start
```

### Linting
```bash
npm run lint
npm run lint:fix
```

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

## Security Features

- JWT token authentication
- Input validation with Joi schemas
- Rate limiting
- CORS protection
- Helmet security headers
- Environment variable protection

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License
