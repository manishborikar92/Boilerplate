const appRegistrations = [
  {
    name: 'main-api',
    mountPath: '/api/main',
    entry: './apps/main-api/src/index.js',
  },
  {
    name: 'admin-api',
    mountPath: '/api/admin',
    entry: './apps/admin-api/src/index.js',
  },
  // __APP_REGISTRATIONS__
];

export default {
  apps: appRegistrations,
};
