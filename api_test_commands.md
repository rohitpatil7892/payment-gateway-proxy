## API Testing Commands

# 1. Test Authentication
curl -X POST http://localhost:3000/api/v1/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "testClient123",
    "clientSecret": "secretKey987xyz"
  }'

# 2. Test Payment Processing (replace TOKEN with actual token)
curl -X POST http://localhost:3000/api/v1/payments/usage \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "amount": 1000,
    "currency": "USD",
    "source": "tok_test",
    "email": "donor@example.com"
  }'

# 3. Test Transaction Status (replace TRANSACTION_ID)
curl -X GET http://localhost:3000/api/v1/payments/TRANSACTION_ID \
  -H "Authorization: Bearer TOKEN"

