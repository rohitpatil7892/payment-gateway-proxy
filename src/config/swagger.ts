import swaggerUi from 'swagger-ui-express';

// Direct swagger specification without swagger-jsdoc
const specs = {
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
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    }
  },
  paths: {
    '/auth/token': {
      post: {
        tags: ['Authentication'],
        summary: 'Generate JWT token for API access',
        description: 'Authenticate with client credentials to receive a JWT token for API access',
        operationId: 'generateToken',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['clientId', 'clientSecret'],
                properties: {
                  clientId: {
                    type: 'string',
                    example: 'testClient123',
                    description: 'Client identifier'
                  },
                  clientSecret: {
                    type: 'string',
                    example: 'secretKey987xyz',
                    description: 'Client secret key'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Token generated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true
                    },
                    data: {
                      type: 'object',
                      properties: {
                        token: {
                          type: 'string',
                          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                          description: 'JWT access token'
                        },
                        expiresIn: {
                          type: 'string',
                          example: '24h',
                          description: 'Token expiration time'
                        },
                        tokenType: {
                          type: 'string',
                          example: 'Bearer',
                          description: 'Token type'
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Invalid credentials',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: false
                    },
                    error: {
                      type: 'string',
                      example: 'Invalid client credentials'
                    }
                  }
                }
              }
            }
          },
          '500': {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: false
                    },
                    error: {
                      type: 'string',
                      example: 'Token generation failed'
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/payments/usage': {
      post: {
        tags: ['Payments'],
        summary: 'Process a new payment with risk assessment',
        description: 'Process a payment transaction with AI-powered risk assessment using DeepSeek',
        operationId: 'processPayment',
        security: [
          {
            bearerAuth: []
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['amount', 'currency', 'source', 'email'],
                properties: {
                  amount: {
                    type: 'number',
                    minimum: 1,
                    maximum: 1000000,
                    description: 'Payment amount in cents',
                    example: 1000
                  },
                  currency: {
                    type: 'string',
                    enum: ['USD', 'EUR', 'GBP', 'CAD'],
                    description: 'Payment currency',
                    example: 'USD'
                  },
                  source: {
                    type: 'string',
                    minLength: 3,
                    maxLength: 100,
                    description: 'Payment source token or identifier',
                    example: 'tok_test'
                  },
                  email: {
                    type: 'string',
                    format: 'email',
                    description: 'Customer email address',
                    example: 'donor@example.com'
                  }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Payment processed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true
                    },
                    data: {
                      type: 'object',
                      properties: {
                        transactionId: {
                          type: 'string',
                          example: 'txn_abc123-def4-5678-9012-abcdef123456',
                          description: 'Unique transaction identifier'
                        },
                        status: {
                          type: 'string',
                          enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
                          example: 'PROCESSING',
                          description: 'Current transaction status'
                        },
                        riskAssessment: {
                          type: 'object',
                          properties: {
                            riskScore: {
                              type: 'number',
                              minimum: 0,
                              maximum: 1,
                              example: 0.32,
                              description: 'Risk score from 0.0 (low risk) to 1.0 (high risk)'
                            },
                            riskLevel: {
                              type: 'string',
                              enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
                              example: 'MEDIUM',
                              description: 'Risk level category'
                            },
                            explanation: {
                              type: 'string',
                              example: 'Payment processed with moderate risk level based on transaction amount and customer profile',
                              description: 'AI-generated explanation of the risk assessment'
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Invalid request data',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: false
                    },
                    error: {
                      type: 'string',
                      example: 'Validation failed'
                    }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Unauthorized - Invalid or missing token',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: false
                    },
                    error: {
                      type: 'string',
                      example: 'Invalid or expired token'
                    }
                  }
                }
              }
            }
          },
          '500': {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: false
                    },
                    error: {
                      type: 'string',
                      example: 'Payment processing failed'
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/payments/{transactionId}': {
      get: {
        tags: ['Payments'],
        summary: 'Get payment status',
        description: 'Retrieve the current status and details of a payment transaction',
        operationId: 'getPaymentStatus',
        security: [
          {
            bearerAuth: []
          }
        ],
        parameters: [
          {
            in: 'path',
            name: 'transactionId',
            required: true,
            description: 'Unique transaction identifier',
            schema: {
              type: 'string',
              pattern: '^txn_[a-f0-9-]{36}$',
              example: 'txn_abc123-def4-5678-9012-abcdef123456'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Transaction status retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true
                    },
                    data: {
                      type: 'object',
                      properties: {
                        transactionId: {
                          type: 'string',
                          example: 'txn_abc123-def4-5678-9012-abcdef123456'
                        },
                        status: {
                          type: 'string',
                          enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
                          example: 'PROCESSING'
                        },
                        amount: {
                          type: 'number',
                          example: 1000,
                          description: 'Transaction amount in cents'
                        },
                        currency: {
                          type: 'string',
                          example: 'USD'
                        },
                        createdAt: {
                          type: 'string',
                          format: 'date-time',
                          example: '2023-10-01T12:00:00Z'
                        },
                        updatedAt: {
                          type: 'string',
                          format: 'date-time',
                          example: '2023-10-01T12:00:05Z'
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Unauthorized - Invalid or missing token',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: false
                    },
                    error: {
                      type: 'string',
                      example: 'Invalid or expired token'
                    }
                  }
                }
              }
            }
          },
          '404': {
            description: 'Transaction not found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: false
                    },
                    error: {
                      type: 'string',
                      example: 'Transaction not found'
                    }
                  }
                }
              }
            }
          },
          '500': {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: false
                    },
                    error: {
                      type: 'string',
                      example: 'Failed to retrieve payment status'
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  tags: [
    {
      name: 'Authentication',
      description: 'Authentication endpoints for API access'
    },
    {
      name: 'Payments',
      description: 'Payment processing and status endpoints'
    }
  ]
};

export { specs, swaggerUi };