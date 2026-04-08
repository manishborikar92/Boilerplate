const validateMiddlewares = (middlewares, owner) => {
  if (!Array.isArray(middlewares)) {
    throw new Error(`${owner} middlewares must be an array`);
  }

  for (const middleware of middlewares) {
    if (typeof middleware !== 'function') {
      throw new Error(`${owner} middlewares must contain only functions`);
    }
  }
};

export const defineModule = ({
  name,
  basePath,
  middlewares = [],
  createRouter,
} = {}) => {
  if (!name || typeof name !== 'string') {
    throw new Error('Module name is required');
  }

  if (!basePath || typeof basePath !== 'string' || !basePath.startsWith('/')) {
    throw new Error(`Module "${name}" basePath must start with "/"`);
  }

  if (typeof createRouter !== 'function') {
    throw new Error(`Module "${name}" must provide a createRouter function`);
  }

  validateMiddlewares(middlewares, `Module "${name}"`);

  return Object.freeze({
    kind: 'module',
    name,
    basePath,
    middlewares,
    createRouter,
  });
};
