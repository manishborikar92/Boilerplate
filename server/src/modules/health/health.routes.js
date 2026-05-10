import { Router } from 'express';
import mongoose from 'mongoose';

import { ApiResponse } from '../../utils/api-response.js';

const databaseStatus = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  return {
    state: states[mongoose.connection.readyState] || 'unknown',
    name: mongoose.connection.name || null,
    host: mongoose.connection.host || null,
  };
};

export const createHealthRouter = ({ startedAt = new Date(), config } = {}) => {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json(ApiResponse.success({
      status: 'ok',
      service: config?.app?.name || 'api',
      environment: config?.env || process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      startedAt: startedAt.toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      process: {
        nodeVersion: process.version,
        pid: process.pid,
        memoryMb: Math.round((process.memoryUsage().rss / 1024 / 1024) * 100) / 100,
      },
      database: databaseStatus(),
    }));
  });

  router.get('/live', (_req, res) => {
    res.json(ApiResponse.success({ status: 'alive' }));
  });

  router.get('/ready', (_req, res) => {
    const dbRequired = Boolean(config?.database?.enabled);
    const dbReady = !dbRequired || mongoose.connection.readyState === 1;
    const statusCode = dbReady ? 200 : 503;

    res.status(statusCode).json(ApiResponse.success({
      status: dbReady ? 'ready' : 'not_ready',
      database: databaseStatus(),
    }));
  });

  return router;
};
