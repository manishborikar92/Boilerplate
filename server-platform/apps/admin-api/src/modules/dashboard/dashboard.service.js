export const buildDashboardSummary = (app) => ({
  app: {
    name: app.name,
    version: app.version,
    description: app.description,
    kind: app.meta.kind,
    mountPath: app.mountPath,
  },
  summary: {
    totalModules: app.modules.length,
    moduleNames: app.modules.map((moduleDefinition) => moduleDefinition.name),
  },
});
