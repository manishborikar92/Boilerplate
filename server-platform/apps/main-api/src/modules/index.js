import { createHealthModule } from '../shared.js';
import infoModule from './info/info.module.js';

const modules = [
  createHealthModule(),
  infoModule,
  // __MODULE_REGISTRATIONS__
];

export default modules;
