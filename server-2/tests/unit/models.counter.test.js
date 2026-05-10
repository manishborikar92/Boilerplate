const mongoose = require('mongoose');
const Counter = require('../../src/models/Counter');

describe('Counter model', () => {
  const firmId = new mongoose.Types.ObjectId();
  const year = 2026;

  afterEach(async () => {
    await Counter.deleteMany({});
  });

  it('returns 0 for missing counters', async () => {
    const current = await Counter.getCurrentSequence(firmId, year, 'thread');
    expect(current).toBe(0);
  });

  it('increments and resets sequences', async () => {
    const first = await Counter.getNextSequence(firmId, year, 'thread');
    const second = await Counter.getNextSequence(firmId, year, 'thread');
    expect(first).toBe(1);
    expect(second).toBe(2);

    await Counter.resetCounter(firmId, year, 'thread');
    const resetValue = await Counter.getCurrentSequence(firmId, year, 'thread');
    expect(resetValue).toBe(0);
  });

  it('returns firm counters sorted', async () => {
    await Counter.getNextSequence(firmId, 2025, 'invoice');
    await Counter.getNextSequence(firmId, 2026, 'thread');

    const counters = await Counter.getFirmCounters(firmId);
    expect(counters.length).toBeGreaterThan(0);
    expect(counters[0].year).toBeGreaterThanOrEqual(counters[counters.length - 1].year);
  });
});
