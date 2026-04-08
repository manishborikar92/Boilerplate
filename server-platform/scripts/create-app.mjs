import path from 'node:path';
import { promises as fs } from 'node:fs';

const [name, mountPathArg] = process.argv.slice(2);

if (!name) {
  console.error('Usage: npm run app:new -- <name> <mountPath>');
  process.exit(1);
}

const mountPath = mountPathArg || `/api/${name.replace(/-api$/, '')}`;

if (!mountPath.startsWith('/')) {
  console.error('mountPath must start with "/"');
  process.exit(1);
}

const rootDir = process.cwd();
const appDir = path.join(rootDir, 'apps', name);
const srcDir = path.join(appDir, 'src');
const modulesDir = path.join(srcDir, 'modules');
const workspaceConfigPath = path.join(rootDir, 'workspace.config.js');

const ensureMissing = async (targetPath, label) => {
  try {
    await fs.access(targetPath);
    console.error(`${label} already exists: ${targetPath}`);
    process.exit(1);
  } catch {
    return;
  }
};

const writeFile = (filePath, content) => fs.writeFile(filePath, content, 'utf8');

await ensureMissing(appDir, 'App');

await fs.mkdir(modulesDir, { recursive: true });

await writeFile(
  path.join(appDir, 'package.json'),
  JSON.stringify(
    {
      name: `@server-platform/${name}`,
      version: '1.0.0',
      private: true,
      type: 'module',
    },
    null,
    2,
  ) + '\n',
);

await writeFile(
  path.join(appDir, 'app.config.js'),
  `export default {
  name: '${name}',
  version: '1.0.0',
  description: '${name} application API',
  meta: {
    kind: 'custom',
  },
};
`,
);

await writeFile(
  path.join(srcDir, 'shared.js'),
  `export {
  asyncHandler,
  createHealthModule,
  defineApp,
  defineModule,
  sendSuccess,
} from '../../../packages/core/src/index.js';
`,
);

await writeFile(
  path.join(srcDir, 'index.js'),
  `import appConfig from '../app.config.js';
import modules from './modules/index.js';
import { defineApp } from './shared.js';

export default defineApp({
  ...appConfig,
  modules,
});
`,
);

await writeFile(
  path.join(modulesDir, 'index.js'),
  `import { createHealthModule } from '../shared.js';

const modules = [
  createHealthModule(),
  // __MODULE_REGISTRATIONS__
];

export default modules;
`,
);

const workspaceConfig = await fs.readFile(workspaceConfigPath, 'utf8');

if (!workspaceConfig.includes('// __APP_REGISTRATIONS__')) {
  console.error('workspace.config.js is missing the app registration marker');
  process.exit(1);
}

const nextWorkspaceConfig = workspaceConfig.replace(
  '  // __APP_REGISTRATIONS__',
  `  {
    name: '${name}',
    mountPath: '${mountPath}',
    entry: './apps/${name}/src/index.js',
  },
  // __APP_REGISTRATIONS__`,
);

await writeFile(workspaceConfigPath, nextWorkspaceConfig);

console.log(`Created app "${name}" at apps/${name} and registered it at "${mountPath}".`);
