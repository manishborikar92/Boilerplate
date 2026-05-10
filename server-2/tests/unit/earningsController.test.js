jest.mock('../../src/models/Payment', () => ({
  aggregate: jest.fn()
}));

jest.mock('../../src/models/Firm', () => ({}));

const Payment = require('../../src/models/Payment');
const { getEarnings } = require('../../src/controllers/earningsController');

describe('earningsController', () => {
  it('returns earnings with growth when previous exists', async () => {
    Payment.aggregate
      .mockResolvedValueOnce([{ totalEarnings: 10000, count: 2 }])
      .mockResolvedValueOnce([{ totalEarnings: 5000 }]);

    const req = { user: { firmId: 'firm' } };
    const payload = await new Promise((resolve) => {
      const res = {
        json: (data) => resolve(data)
      };
      getEarnings(req, res, jest.fn());
    });

    expect(payload.data.totalEarnings).toBe(100);
    expect(payload.data.growthPercent).toBe(100);
  });

  it('returns growth 100 when previous is zero and current exists', async () => {
    Payment.aggregate
      .mockResolvedValueOnce([{ totalEarnings: 10000, count: 1 }])
      .mockResolvedValueOnce([]);

    const req = { user: { firmId: 'firm' } };
    const payload = await new Promise((resolve) => {
      const res = {
        json: (data) => resolve(data)
      };
      getEarnings(req, res, jest.fn());
    });

    expect(payload.data.growthPercent).toBe(100);
  });

  it('returns growth 0 when no earnings', async () => {
    Payment.aggregate
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const req = { user: { firmId: 'firm' } };
    const payload = await new Promise((resolve) => {
      const res = {
        json: (data) => resolve(data)
      };
      getEarnings(req, res, jest.fn());
    });

    expect(payload.data.totalEarnings).toBe(0);
    expect(payload.data.growthPercent).toBe(0);
  });
});
