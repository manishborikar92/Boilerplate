import { defineModule } from '../../shared.js';
import { createDashboardRoutes } from './dashboard.routes.js';

const dashboardModule = defineModule({
  name: 'dashboard',
  basePath: '/dashboard',
  createRouter: (context) => createDashboardRoutes(context),
});

export default dashboardModule;
