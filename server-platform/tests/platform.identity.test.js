import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const legacyWorkspaceName = ['server', '2'].join('-');

const readProjectFile = (relativePath) => readFile(path.join(rootDir, relativePath), 'utf8');

test('uses server-platform as the workspace identity', async () => {
  assert.equal(path.basename(rootDir), 'server-platform');

  const packageJson = JSON.parse(await readProjectFile('package.json'));
  const corePackageJson = JSON.parse(await readProjectFile('packages/core/package.json'));
  const mainApiPackageJson = JSON.parse(await readProjectFile('apps/main-api/package.json'));
  const adminApiPackageJson = JSON.parse(await readProjectFile('apps/admin-api/package.json'));
  const gatewayPackageJson = JSON.parse(await readProjectFile('hosts/gateway/package.json'));
  const readme = await readProjectFile('README.md');
  const createAppScript = await readProjectFile('scripts/create-app.mjs');

  assert.equal(packageJson.name, 'server-platform');
  assert.equal(corePackageJson.name, '@server-platform/core');
  assert.equal(mainApiPackageJson.name, '@server-platform/main-api');
  assert.equal(adminApiPackageJson.name, '@server-platform/admin-api');
  assert.equal(gatewayPackageJson.name, '@server-platform/gateway');
  assert.match(readme, /^# server-platform$/m);
  assert.ok(!readme.includes(legacyWorkspaceName));
  assert.ok(createAppScript.includes('@server-platform/'));
});
