import appConfig from '../app.config.js';
import modules from './modules/index.js';
import { defineApp } from './shared.js';

export default defineApp({
  ...appConfig,
  modules,
});
