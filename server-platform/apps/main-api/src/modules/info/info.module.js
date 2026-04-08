import { defineModule } from '../../shared.js';
import { createInfoRoutes } from './info.routes.js';

const infoModule = defineModule({
  name: 'info',
  basePath: '/info',
  createRouter: (context) => createInfoRoutes(context),
});

export default infoModule;
