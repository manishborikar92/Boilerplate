const express = require('express');
const router = express.Router();
const {
  uploadDocument,
  getWorkspace,
  getClientDocuments,
  getSharedConversationDocuments,
  getDocumentsByCategory,
  getDocument,
  updateDocument,
  deleteDocument,
  permanentDeleteDocument,
  getCategories,
  searchDocuments,
  setPaymentRequirement,
  getDocumentWithAccessCheck,
  downloadDocument,
  uploadChatDocuments,
  getLockedDocuments,
  getPaidDocuments,
  getDocumentStats
} = require('../controllers/documentController');
const {
  getFolderTree,
  createFolder,
  updateFolder,
  deleteFolder,
} = require('../controllers/folderController');
const { protect, authorize } = require('../middleware/auth');
const { uploadMultipleFiles, handleUploadError } = require('../middleware/upload');
const { checkMonthlyLimit } = require('../middleware/subscription');

// All routes require authentication
router.use(protect);

// Public routes (all authenticated users)
router.get('/categories', getCategories);

// Stats endpoint (CA-Admin only)
router.get('/stats', authorize('CA-Admin'), getDocumentStats);

// Document upload (CA-Admin only)
// checkMonthlyLimit enforces subscription plan monthly document limits
router.post(
  '/upload',
  authorize('CA-Admin'),
  checkMonthlyLimit('Document'), // Enforces: Starter=25, Pro=500 docs/month
  uploadMultipleFiles.array('documents', 20),
  handleUploadError,
  uploadDocument
);

router.post(
  '/chat-upload',
  authorize('CA-Admin', 'Client'),
  uploadMultipleFiles.array('documents', 10),
  handleUploadError,
  uploadChatDocuments
);

// Search documents (CA-Admin only)
router.get(
  '/search',
  authorize('CA-Admin'),
  searchDocuments
);

// Payment requirement management (CA-Admin only)
router.put(
  '/set-payment-requirement',
  authorize('CA-Admin'),
  setPaymentRequirement
);

// Client-specific routes (accessible by CA-Admin and Client)
router.get('/client/:clientId/workspace', authorize('CA-Admin'), getWorkspace);
router.get('/client/:clientId', authorize('CA-Admin', 'Client'), getClientDocuments);
router.get('/client/:clientId/shared', authorize('CA-Admin', 'Client'), getSharedConversationDocuments);
router.get('/client/:clientId/locked', authorize('CA-Admin', 'Client'), getLockedDocuments);
router.get('/client/:clientId/paid', authorize('CA-Admin', 'Client'), getPaidDocuments);
router.get('/client/:clientId/category/:category', authorize('CA-Admin', 'Client'), getDocumentsByCategory);

// Folder routes
router.get('/client/:clientId/folders/tree', authorize('CA-Admin'), getFolderTree);
router.post('/client/:clientId/folders', authorize('CA-Admin'), createFolder);
router.put('/folders/:id', authorize('CA-Admin'), updateFolder);
router.patch('/folders/:id', authorize('CA-Admin'), updateFolder);
router.delete('/folders/:id', authorize('CA-Admin'), deleteFolder);

// Single document operations
router.get('/:id/download', authorize('CA-Admin', 'Client'), downloadDocument);
router.get('/:id', authorize('CA-Admin', 'Client'), getDocument);
router.get('/:id/access', authorize('CA-Admin', 'Client'), getDocumentWithAccessCheck);
router.put('/:id', authorize('CA-Admin'), updateDocument);
router.patch('/:id', authorize('CA-Admin'), updateDocument);
router.delete('/:id', authorize('CA-Admin'), deleteDocument);
router.delete('/:id/permanent', authorize('CA-Admin'), permanentDeleteDocument);

module.exports = router;
