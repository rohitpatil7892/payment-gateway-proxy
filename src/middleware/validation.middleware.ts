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
