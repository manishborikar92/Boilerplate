const Message = require('../models/Message');

async function isDocumentLockedByPendingChatPayment(documentId) {
  return Message.exists({
    attachments: documentId,
    paymentRequired: true,
    paymentStatus: 'pending',
    isDeleted: false,
  });
}

module.exports = {
  isDocumentLockedByPendingChatPayment,
};

