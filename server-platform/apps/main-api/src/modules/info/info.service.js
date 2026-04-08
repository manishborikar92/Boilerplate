export const buildInfoPayload = (app) => ({
  app: {
    name: app.name,
    version: app.version,
    description: app.description,
    kind: app.meta.kind,
    mountPath: app.mountPath,
  },
  modules: app.modules,
});
