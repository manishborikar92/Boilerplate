const mongoose = require('mongoose');
const Payment = require('../../src/models/Payment');
const Counter = require('../../src/models/Counter');

describe('Payment model', () => {
  const firmId = new mongoose.Types.ObjectId();
  const clientId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();

  afterEach(async () => {
    await Payment.deleteMany({});
    await Counter.deleteMany({});
  });

  it('generates invoice numbers for invoice payments', async () => {
    const payment = await Payment.create({
      paymentType: 'invoice',
      clientId,
      firmId,
      amount: 10000,
      description: 'Invoice payment',
      createdBy: userId
    });

    expect(payment.invoiceNumber).toMatch(/^INV-\d{4}-\d{5}$/);
    expect(payment.amountInRupees).toBe(100);
  });

  it('does not generate invoice number for subscription payments', async () => {
    const payment = await Payment.create({
      paymentType: 'subscription',
      clientId,
      firmId,
      amount: 20000,
      description: 'Subscription payment',
      createdBy: userId
    });

    expect(payment.invoiceNumber).toBeUndefined();
  });
});
