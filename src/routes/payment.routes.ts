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
 *             type: object
 *             required: [amount, currency, source, email]
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 1000000
 *                 example: 1000
 *               currency:
 *                 type: string
 *                 enum: [USD, EUR, GBP, CAD]
 *                 example: "USD"
 *               source:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 100
 *                 example: "tok_test"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "donor@example.com"
 *     responses:
 *       201:
 *         description: Payment initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transactionId:
 *                   type: string
 *                   example: "txn_abc123"
 *                 provider:
 *                   type: string
 *                   example: "paypal"
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 riskScore:
 *                   type: number
 *                   example: 0.32
 *                 explanation:
 *                   type: string
 *                   example: "This payment was routed to PayPal due to a moderately high low score based on a large amount and a suspicious email domain."
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 */
router.post('/usage', validate(processPaymentSchema), paymentController.processPayment.bind(paymentController));

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
router.get('/:transactionId', paymentController.getPaymentStatus.bind(paymentController));

export default router;
