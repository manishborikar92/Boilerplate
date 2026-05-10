const {
  AUTH_ROUTES,
  CA_ADMIN_ROUTES,
  CLIENT_PORTAL_ROUTES,
  buildCaAdminConversationPath,
  buildCaAdminSettingsPath,
  buildClientConversationPath,
  isClientPortalActionUrl,
} = require('../../src/constants/frontendRoutes');

describe('frontend route constants', () => {
  it('defines the new URL namespaces', () => {
    expect(AUTH_ROUTES.PORTAL_LOGIN).toBe('/portal-login');
    expect(CA_ADMIN_ROUTES.ROOT).toBe('/app');
    expect(CA_ADMIN_ROUTES.DASHBOARD).toBe('/app/dashboard');
    expect(CLIENT_PORTAL_ROUTES.ROOT).toBe('/portal');
    expect(CLIENT_PORTAL_ROUTES.DASHBOARD).toBe('/portal/dashboard');
  });

  it('recognizes both the new and legacy client portal URLs', () => {
    expect(isClientPortalActionUrl('/portal/conversations')).toBe(true);
    expect(isClientPortalActionUrl('/portal/conversations/123')).toBe(true);
    expect(isClientPortalActionUrl('/client/conversations')).toBe(true);
    expect(isClientPortalActionUrl('/app/conversations')).toBe(false);
  });

  it('builds the new notification/action URLs', () => {
    expect(buildCaAdminSettingsPath('payments')).toBe('/app/settings?tab=payments');
    expect(buildCaAdminConversationPath('thread 123')).toBe('/app/conversations/thread%20123');
    expect(buildClientConversationPath('thread 123')).toBe('/portal/conversations/thread%20123');
  });
});
