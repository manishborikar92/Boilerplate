import path from 'node:path';
import { pathToFileURL } from 'node:url';

const validateRegistration = (registration) => {
  if (!registration?.name) {
    throw new Error('App registration requires a name');
  }

  if (!registration?.mountPath || !registration.mountPath.startsWith('/')) {
    throw new Error(`App registration "${registration.name}" must have a mountPath starting with "/"`);
  }

  if (!registration?.entry) {
    throw new Error(`App registration "${registration.name}" requires an entry path`);
  }
};

export const loadRegisteredApps = async ({ rootDir, workspaceConfig }) => {
  if (!workspaceConfig || !Array.isArray(workspaceConfig.apps)) {
    throw new Error('workspace.config.js must export an object with an apps array');
  }

  const activeRegistrations = workspaceConfig.apps.filter((registration) => registration.enabled !== false);
  const seenNames = new Set();
  const seenMountPaths = new Set();
  const loadedApps = [];

  for (const registration of activeRegistrations) {
    validateRegistration(registration);

    if (seenNames.has(registration.name)) {
      throw new Error(`Duplicate registered app name "${registration.name}"`);
    }

    if (seenMountPaths.has(registration.mountPath)) {
      throw new Error(`Duplicate registered mountPath "${registration.mountPath}"`);
    }

    seenNames.add(registration.name);
    seenMountPaths.add(registration.mountPath);

    const entryPath = path.resolve(rootDir, registration.entry);
    const imported = await import(pathToFileURL(entryPath).href);
    const appDefinition = imported.default;

    if (!appDefinition || appDefinition.kind !== 'app') {
      throw new Error(`Registered app "${registration.name}" must export a default app definition`);
    }

    if (appDefinition.name !== registration.name) {
      throw new Error(
        `Registered app "${registration.name}" does not match exported app name "${appDefinition.name}"`,
      );
    }

    loadedApps.push({
      name: registration.name,
      mountPath: registration.mountPath,
      entry: registration.entry,
      app: appDefinition,
    });
  }

  return loadedApps;
};
