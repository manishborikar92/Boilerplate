import { Router } from 'express';
import authRoutes from './auth.routes.js';
import bookingsRoutes from './bookings.routes.js';
import customersRoutes from './customers.routes.js';
import earningsRoutes from './earnings.routes.js';
import employeesRoutes from './employees.routes.js';
import onboardingRoutes from './onboarding.routes.js';
import paymentRoutes from './payment.routes.js';
import photosRoutes from './photos.routes.js';
import payoutRoutes from './payout.routes.js';
import ratingsRoutes from './ratings.routes.js';
import servicesRoutes from './services.routes.js';
import shopsRoutes from './shops.routes.js';
import accountRoutes from './account.routes.js';
import notificationsRoutes from './notifications.routes.js';
import { ApiResponse } from '../utils/api-response.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/onboarding', onboardingRoutes);
router.use('/account', accountRoutes);
router.use('/customers', customersRoutes);
router.use('/shops', shopsRoutes);
router.use('/employees', employeesRoutes);
router.use('/services', servicesRoutes);
router.use('/bookings', bookingsRoutes);
router.use('/photos', photosRoutes);
router.use('/ratings', ratingsRoutes);
router.use('/earnings', earningsRoutes);
router.use('/payments', paymentRoutes);
router.use('/payouts', payoutRoutes);
router.use('/notifications', notificationsRoutes);

// Health check
router.get('/health', (_req, res) => {
    res.status(200).json(
        ApiResponse.success(
            { timestamp: new Date().toISOString() },
            'EverCut API is running',
        ),
    );
});

export default router;
