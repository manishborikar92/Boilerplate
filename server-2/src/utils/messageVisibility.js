function stripPaymentLockedUrlsForClient(messages) {
  const list = Array.isArray(messages) ? messages : [];
  for (const message of list) {
    if (!message?.paymentRequired || message?.paymentStatus !== 'pending') continue;

    const attachments = message.attachments || [];
    for (const attachment of attachments) {
      if (attachment && typeof attachment === 'object' && 'cloudinaryUrl' in attachment) {
        delete attachment.cloudinaryUrl;
      }
    }

    const inlineFiles = message.inlineFiles || [];
    for (const inlineFile of inlineFiles) {
      if (inlineFile && typeof inlineFile === 'object' && 'cloudinaryUrl' in inlineFile) {
        delete inlineFile.cloudinaryUrl;
      }
    }
  }
}

module.exports = {
  stripPaymentLockedUrlsForClient,
};

