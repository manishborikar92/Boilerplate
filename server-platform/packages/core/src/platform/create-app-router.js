import express from 'express';

const validateUniqueModules = (app) => {
  const seenNames = new Set();
  const seenPaths = new Set();

  for (const moduleDefinition of app.modules) {
    if (seenNames.has(moduleDefinition.name)) {
      throw new Error(`Duplicate module name "${moduleDefinition.name}" in app "${app.name}"`);
    }

    if (seenPaths.has(moduleDefinition.basePath)) {
      throw new Error(`Duplicate module basePath "${moduleDefinition.basePath}" in app "${app.name}"`);
    }

    seenNames.add(moduleDefinition.name);
    seenPaths.add(moduleDefinition.basePath);
  }
};

export const createAppRouter = ({ env, logger, registration }) => {
  const router = express.Router();
  const appLogger = logger.child({
    appName: registration.app.name,
    mountPath: registration.mountPath,
  });

  validateUniqueModules(registration.app);

  const appMetadata = {
    name: registration.app.name,
    version: registration.app.version,
    description: registration.app.description,
    meta: registration.app.meta,
    mountPath: registration.mountPath,
    modules: registration.app.modules.map((moduleDefinition) => ({
      name: moduleDefinition.name,
      basePath: moduleDefinition.basePath,
    })),
  };

  for (const middleware of registration.app.middlewares) {
    router.use(middleware);
  }

  for (const moduleDefinition of registration.app.modules) {
    const moduleLogger = appLogger.child({
      moduleName: moduleDefinition.name,
      modulePath: moduleDefinition.basePath,
    });

    const moduleRouter = moduleDefinition.createRouter({
      env,
      logger: moduleLogger,
      app: appMetadata,
      module: {
        name: moduleDefinition.name,
        basePath: moduleDefinition.basePath,
      },
    });

    router.use(moduleDefinition.basePath, ...moduleDefinition.middlewares, moduleRouter);
  }

  return {
    router,
    metadata: appMetadata,
  };
};
