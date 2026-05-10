const express = require('express');
const router = express.Router();
const { uploadFile, uploadMultipleFiles, deleteFile } = require('../controllers/fileController');
const { protect } = require('../middleware/auth');
const { uploadSingle, uploadMultiple, handleUploadError } = require('../middleware/upload');

// All file routes should be protected
router.use(protect);

router.post('/upload', uploadSingle, handleUploadError, uploadFile);
router.post('/upload-multiple', uploadMultiple(5), handleUploadError, uploadMultipleFiles);
router.post('/delete', deleteFile);

module.exports = router;
