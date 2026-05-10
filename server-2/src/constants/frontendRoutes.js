const matchesNamespace = (pathname = '', root) =>
  pathname === root || pathname.startsWith(`${root}/`);

const PUBLIC_ROUTES = Object.freeze({
  HOME: '/',
  HELP: '/help',
  PRIVACY: '/privacy',
  TERMS: '/terms',
  COMPLETE_PROFILE: '/complete-profile',
  UNAUTHORIZED: '/unauthorized',
});

const AUTH_ROUTES = Object.freeze({
  LOGIN: '/login',
  REGISTER: '/register',
  PORTAL_LOGIN: '/portal-login',
  LEGACY_PORTAL_LOGIN: '/client-login',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  VERIFY_EMAIL: '/verify-email',
});

const CA_ADMIN_ROUTES = Object.freeze({
  ROOT: '/app',
  DASHBOARD: '/app/dashboard',
  CLIENTS: '/app/clients',
  CONVERSATIONS: '/app/conversations',
  DOCUMENTS: '/app/documents',
  HELP_CENTER: '/app/help-center',
  SETTINGS: '/app/settings',
});

const CLIENT_PORTAL_ROUTES = Object.freeze({
  ROOT: '/portal',
  DASHBOARD: '/portal/dashboard',
  CONVERSATIONS: '/portal/conversations',
  DOCUMENTS: '/portal/documents',
  PAYMENTS: '/portal/payments',
  HELP: '/portal/help',
});

const LEGACY_FRONTEND_ROUTES = Object.freeze({
  CA_ADMIN_ROOT: '/dashboard',
  CLIENT_ROOT: '/client',
});

const isClientPortalActionUrl = (pathname = '') =>
  matchesNamespace(pathname, CLIENT_PORTAL_ROUTES.ROOT)
  || matchesNamespace(pathname, LEGACY_FRONTEND_ROUTES.CLIENT_ROOT);

const buildCaAdminConversationPath = (threadId) =>
  `${CA_ADMIN_ROUTES.CONVERSATIONS}/${encodeURIComponent(threadId)}`;

const buildClientConversationPath = (threadId) =>
  `${CLIENT_PORTAL_ROUTES.CONVERSATIONS}/${encodeURIComponent(threadId)}`;

const buildCaAdminSettingsPath = (tab) =>
  tab ? `${CA_ADMIN_ROUTES.SETTINGS}?tab=${encodeURIComponent(tab)}` : CA_ADMIN_ROUTES.SETTINGS;

module.exports = {
  PUBLIC_ROUTES,
  AUTH_ROUTES,
  CA_ADMIN_ROUTES,
  CLIENT_PORTAL_ROUTES,
  LEGACY_FRONTEND_ROUTES,
  isClientPortalActionUrl,
  buildCaAdminConversationPath,
  buildClientConversationPath,
  buildCaAdminSettingsPath,
};
