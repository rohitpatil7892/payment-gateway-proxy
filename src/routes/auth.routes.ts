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
router.post('/token', validate(createTokenSchema), authController.createToken.bind(authController));

export default router;
