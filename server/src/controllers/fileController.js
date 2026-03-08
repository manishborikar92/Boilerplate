const fileService = require('../services/fileService');
const { asyncHandler, ValidationError } = require('../utils/errorHandler');

const uploadFile = asyncHandler(async (req, res) => {
    if (!req.file) {
        throw new ValidationError('No file uploaded');
    }

    const { folder } = req.body; // Optional folder override
    const result = await fileService.uploadFile(req.file.buffer, folder);

    res.status(201).json({
        success: true,
        data: result
    });
});

const uploadMultipleFiles = asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
        throw new ValidationError('No files uploaded');
    }

    const uploadPromises = req.files.map(file =>
        fileService.uploadFile(file.buffer)
    );

    const results = await Promise.all(uploadPromises);

    res.status(201).json({
        success: true,
        data: results
    });
});

const deleteFile = asyncHandler(async (req, res) => {
    const { publicId } = req.body;

    if (!publicId) {
        throw new ValidationError('Public ID is required');
    }

    await fileService.deleteFile(publicId);

    res.status(200).json({
        success: true,
        message: 'File deleted successfully'
    });
});

module.exports = {
    uploadFile,
    uploadMultipleFiles,
    deleteFile
};
