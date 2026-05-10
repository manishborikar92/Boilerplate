const mongoose = require('mongoose');
const Session = require('../../src/models/Session');

describe('Session model', () => {
  const userId = new mongoose.Types.ObjectId();

  afterEach(async () => {
    await Session.deleteMany({});
  });

  it('creates sessions and enforces max session count', async () => {
    const first = await Session.createSession({
      userId,
      refreshToken: 'token1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
      ipAddress: '127.0.0.1',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    }, 1);

    first.lastActivityAt = new Date(Date.now() - 10000);
    await first.save();

    const second = await Session.createSession({
      userId,
      refreshToken: 'token2',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0) AppleWebKit/605.1.15 Safari/604.1',
      ipAddress: '127.0.0.2',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    }, 1);

    const updatedFirst = await Session.findById(first._id);
    expect(updatedFirst.isActive).toBe(false);
    expect(second.deviceType).toBe('mobile');
    expect(second.clientName).toBe('Safari');
  });

  it('validates and refreshes sessions', async () => {
    const session = await Session.createSession({
      userId,
      refreshToken: 'token3',
      userAgent: 'Mozilla/5.0 (Windows) Firefox/120.0',
      ipAddress: '127.0.0.3',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    });

    const refreshed = await Session.validateAndRefreshSession('token3');
    expect(refreshed._id.toString()).toBe(session._id.toString());
  });

  it('rotates refresh tokens', async () => {
    const session = await Session.createSession({
      userId,
      refreshToken: 'token4',
      userAgent: 'Mozilla/5.0 (Windows) Chrome/120.0',
      ipAddress: '127.0.0.4',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    });

    const newExpires = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const rotated = await Session.rotateRefreshToken('token4', 'token4-new', newExpires);
    expect(rotated._id.toString()).toBe(session._id.toString());
    expect(rotated.expiresAt.getTime()).toBe(newExpires.getTime());
  });

  it('invalidates sessions', async () => {
    await Session.createSession({
      userId,
      refreshToken: 'token5',
      userAgent: 'Mozilla/5.0 (Windows) Chrome/120.0',
      ipAddress: '127.0.0.5',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    });

    await Session.invalidateSession('token5');
    const inactive = await Session.findOne({ userId, isActive: false });
    expect(inactive).toBeTruthy();

    await Session.createSession({
      userId,
      refreshToken: 'token6',
      userAgent: 'Mozilla/5.0 (Windows) Chrome/120.0',
      ipAddress: '127.0.0.6',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    });
    await Session.invalidateAllUserSessions(userId, 'forced_logout');
    const count = await Session.getActiveSessionCount(userId);
    expect(count).toBe(0);
  });

  it('returns active sessions', async () => {
    await Session.createSession({
      userId,
      refreshToken: 'token7',
      userAgent: 'Mozilla/5.0 (Windows) Chrome/120.0',
      ipAddress: '127.0.0.7',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    });
    const sessions = await Session.getActiveSessions(userId);
    expect(sessions.length).toBe(1);
  });
});
