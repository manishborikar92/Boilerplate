import { Router } from 'express';

import * as employeeController from '../controllers/employee.controller.js';
import authenticate from '../middleware/authenticate.middleware.js';
import { authorize } from '../middleware/authorize.middleware.js';
import { uploadEmployeePhoto } from '../middleware/upload.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { ROLES } from '../utils/constants.js';
import { paginationSchema } from '../validators/common.validator.js';
import {
    addEmployeeSchema,
    employeeAvailabilityQuerySchema,
    employeeIdParamSchema,
    updateEmployeeAvailabilitySchema,
    updateEmployeeSchema,
} from '../validators/employee.validator.js';

const router = Router();

// All employee routes require authentication
router.use(authenticate);

// Routes accessible by both CUSTOMER and BARBER
router.get(
    '/:id/availability',
    authorize(ROLES.CUSTOMER, ROLES.BARBER),
    validate(employeeIdParamSchema, 'params'),
    validate(employeeAvailabilityQuerySchema, 'query'),
    employeeController.getEmployeeAvailability,
);

// All remaining routes require BARBER role
router.get('/analytics', authorize(ROLES.BARBER), employeeController.getStaffAvailability);
router.get('/', authorize(ROLES.BARBER), validate(paginationSchema, 'query'), employeeController.getEmployees);
router.get('/:id', authorize(ROLES.BARBER), validate(employeeIdParamSchema, 'params'), employeeController.getEmployeeById);
router.post('/', authorize(ROLES.BARBER), uploadEmployeePhoto, validate(addEmployeeSchema, 'body'), employeeController.addEmployee);
router.patch('/:id', authorize(ROLES.BARBER), validate(employeeIdParamSchema, 'params'), uploadEmployeePhoto, validate(updateEmployeeSchema, 'body'), employeeController.updateEmployee);
router.put('/:id/blocked-dates', authorize(ROLES.BARBER), validate(employeeIdParamSchema, 'params'), validate(updateEmployeeAvailabilitySchema, 'body'), employeeController.updateEmployeeAvailability);
router.delete('/:id', authorize(ROLES.BARBER), validate(employeeIdParamSchema, 'params'), employeeController.deleteEmployee);

export default router;
