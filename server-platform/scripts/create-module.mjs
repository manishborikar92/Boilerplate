import path from 'node:path';
import { promises as fs } from 'node:fs';

const [appName, moduleName, basePathArg] = process.argv.slice(2);

if (!appName || !moduleName) {
  console.error('Usage: npm run module:new -- <app> <module> <basePath>');
  process.exit(1);
}

const basePath = basePathArg || `/${moduleName}`;

if (!basePath.startsWith('/')) {
  console.error('basePath must start with "/"');
  process.exit(1);
}

const rootDir = process.cwd();
const appSrcDir = path.join(rootDir, 'apps', appName, 'src');
const sharedPath = path.join(appSrcDir, 'shared.js');
const modulesIndexPath = path.join(appSrcDir, 'modules', 'index.js');
const moduleDir = path.join(appSrcDir, 'modules', moduleName);

const toPascalCase = (value) =>
  value
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

const pascalName = toPascalCase(moduleName);
const moduleVariableName = `${moduleName.replace(/-([a-z])/g, (_, char) => char.toUpperCase())}Module`;

try {
  await fs.access(sharedPath);
  await fs.access(modulesIndexPath);
} catch {
  console.error(`App "${appName}" is missing required source files`);
  process.exit(1);
}

try {
  await fs.access(moduleDir);
  console.error(`Module already exists: ${moduleDir}`);
  process.exit(1);
} catch {
  await fs.mkdir(moduleDir, { recursive: true });
}

const writeFile = (filePath, content) => fs.writeFile(filePath, content, 'utf8');

await writeFile(
  path.join(moduleDir, `${moduleName}.service.js`),
  `export const build${pascalName}Payload = (app) => ({
  app: {
    name: app.name,
    version: app.version,
    mountPath: app.mountPath,
  },
  module: {
    name: '${moduleName}',
    basePath: '${basePath}',
  },
});
`,
);

await writeFile(
  path.join(moduleDir, `${moduleName}.controller.js`),
  `import { asyncHandler, sendSuccess } from '../../shared.js';
import { build${pascalName}Payload } from './${moduleName}.service.js';

export const create${pascalName}Controller = ({ app }) => ({
  getIndex: asyncHandler(async (req, res) =>
    sendSuccess(res, {
      message: '${pascalName} module response retrieved successfully',
      data: build${pascalName}Payload(app),
      meta: { requestId: req.id },
    })),
});
`,
);

await writeFile(
  path.join(moduleDir, `${moduleName}.routes.js`),
  `import express from 'express';
import { create${pascalName}Controller } from './${moduleName}.controller.js';

export const create${pascalName}Routes = (context) => {
  const router = express.Router();
  const controller = create${pascalName}Controller(context);

  router.get('/', controller.getIndex);

  return router;
};
`,
);

await writeFile(
  path.join(moduleDir, `${moduleName}.module.js`),
  `import { defineModule } from '../../shared.js';
import { create${pascalName}Routes } from './${moduleName}.routes.js';

const ${moduleVariableName} = defineModule({
  name: '${moduleName}',
  basePath: '${basePath}',
  createRouter: (context) => create${pascalName}Routes(context),
});

export default ${moduleVariableName};
`,
);

const modulesIndex = await fs.readFile(modulesIndexPath, 'utf8');

if (!modulesIndex.includes('// __MODULE_REGISTRATIONS__')) {
  console.error(`${modulesIndexPath} is missing the module registration marker`);
  process.exit(1);
}

const importStatement = `import ${moduleVariableName} from './${moduleName}/${moduleName}.module.js';`;
const lines = modulesIndex.split('\n');
const lastImportIndex = lines.reduce(
  (index, line, currentIndex) => (line.startsWith('import ') ? currentIndex : index),
  -1,
);

lines.splice(lastImportIndex + 1, 0, importStatement);

const nextModulesIndex = lines
  .join('\n')
  .replace(
    '  // __MODULE_REGISTRATIONS__',
    `  ${moduleVariableName},
  // __MODULE_REGISTRATIONS__`,
  );

await writeFile(modulesIndexPath, nextModulesIndex);

console.log(`Created module "${moduleName}" in app "${appName}" at basePath "${basePath}".`);
