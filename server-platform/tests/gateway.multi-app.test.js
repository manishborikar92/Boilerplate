import assert from 'node:assert/strict';
import test from 'node:test';

const TEST_ENV = {
  NODE_ENV: 'test',
  PORT: '0',
  HOST_NAME: 'gateway',
  HOST_VERSION: '1.0.0',
  LOG_LEVEL: 'error',
  CORS_ORIGINS: '',
  JSON_BODY_LIMIT: '1mb',
  TRUST_PROXY: 'false',
  HEALTH_DETAILS_ENABLED: 'true',
};

const startGateway = async () => {
  const { createGateway } = await import('../hosts/gateway/src/create-gateway.js');
  const gateway = await createGateway({ envOverrides: TEST_ENV });
  const server = gateway.app.listen(0);

  await new Promise((resolve) => server.once('listening', resolve));

  const address = server.address();

  return {
    ...gateway,
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
};

const getJson = async (baseUrl, path) => {
  const response = await fetch(`${baseUrl}${path}`);
  return {
    status: response.status,
    body: await response.json(),
  };
};

test('loads registered apps from workspace config', async (t) => {
  const gateway = await startGateway();
  t.after(() => gateway.server.close());

  assert.deepEqual(
    gateway.apps.map((app) => app.name),
    ['main-api', 'admin-api'],
  );
});

test('exposes gateway health with mounted app metadata', async (t) => {
  const gateway = await startGateway();
  t.after(() => gateway.server.close());

  const response = await getJson(gateway.baseUrl, '/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.host.name, 'gateway');
  assert.deepEqual(
    response.body.data.apps.map((app) => app.name),
    ['main-api', 'admin-api'],
  );
});

test('routes requests to main-api modules', async (t) => {
  const gateway = await startGateway();
  t.after(() => gateway.server.close());

  const response = await getJson(gateway.baseUrl, '/api/main/info');

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.app.name, 'main-api');
  assert.equal(response.body.data.app.kind, 'public');
});

test('routes requests to admin-api modules', async (t) => {
  const gateway = await startGateway();
  t.after(() => gateway.server.close());

  const response = await getJson(gateway.baseUrl, '/api/admin/dashboard/summary');

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.app.name, 'admin-api');
  assert.equal(response.body.data.summary.totalModules, 2);
});
