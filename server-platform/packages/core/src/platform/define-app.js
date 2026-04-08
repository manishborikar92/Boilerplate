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

export const defineApp = ({
  name,
  version = '1.0.0',
  description = '',
  meta = {},
  middlewares = [],
  modules = [],
} = {}) => {
  if (!name || typeof name !== 'string') {
    throw new Error('App name is required');
  }

  if (!Array.isArray(modules)) {
    throw new Error(`App "${name}" modules must be an array`);
  }

  validateMiddlewares(middlewares, `App "${name}"`);

  return Object.freeze({
    kind: 'app',
    name,
    version,
    description,
    meta,
    middlewares,
    modules,
  });
};
