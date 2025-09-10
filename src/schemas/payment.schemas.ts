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
  
  source: Joi.string().min(3).max(100).required()
    .messages({
      'string.min': 'Source must be at least 3 characters',
      'string.max': 'Source cannot exceed 100 characters'
    }),
  
  email: Joi.string().email().required()
    .messages({
      'string.email': 'Email must be a valid email address'
    })
});

export const transactionIdParam = Joi.string()
  .pattern(/^txn_[A-Za-z0-9-]{20,}$/)
  .required()
  .messages({
    'string.pattern.base': 'Invalid transaction ID format'
  });

export const assessRiskSchema = Joi.object({
  transactionId: transactionIdParam
});
