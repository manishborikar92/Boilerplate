import { createHealthModule } from '../shared.js';
import dashboardModule from './dashboard/dashboard.module.js';

const modules = [
  createHealthModule(),
  dashboardModule,
  // __MODULE_REGISTRATIONS__
];

export default modules;
