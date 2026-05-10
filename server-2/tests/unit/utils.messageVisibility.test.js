const { stripPaymentLockedUrlsForClient } = require('../../src/utils/messageVisibility');

describe('messageVisibility', () => {
  it('removes cloudinaryUrl for pending payment messages', () => {
    const messages = [
      {
        paymentRequired: true,
        paymentStatus: 'pending',
        attachments: [{ cloudinaryUrl: 'a', other: 'x' }],
        inlineFiles: [{ cloudinaryUrl: 'b', other: 'y' }]
      },
      {
        paymentRequired: true,
        paymentStatus: 'paid',
        attachments: [{ cloudinaryUrl: 'c' }]
      }
    ];

    stripPaymentLockedUrlsForClient(messages);

    expect(messages[0].attachments[0].cloudinaryUrl).toBeUndefined();
    expect(messages[0].inlineFiles[0].cloudinaryUrl).toBeUndefined();
    expect(messages[1].attachments[0].cloudinaryUrl).toBe('c');
  });

  it('handles non-array input safely', () => {
    expect(() => stripPaymentLockedUrlsForClient(null)).not.toThrow();
    expect(() => stripPaymentLockedUrlsForClient({})).not.toThrow();
  });
});
