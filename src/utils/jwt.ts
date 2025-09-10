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
    return jwt.sign({ clientId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
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
