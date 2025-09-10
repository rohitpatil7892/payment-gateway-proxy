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
