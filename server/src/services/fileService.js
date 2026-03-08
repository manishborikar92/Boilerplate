const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');
const { InternalError } = require('../utils/errorHandler');

class FileService {
    /**
     * Upload a file buffer to Cloudinary
     * @param {Buffer} buffer - File buffer
     * @param {string} folder - Destination folder
     * @param {string} filename - Optional filename
     * @returns {Promise<Object>} Cloudinary result
     */
    async uploadFile(buffer, folder = 'boilerplate/uploads', filename = null) {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder,
                    public_id: filename,
                    resource_type: 'auto'
                },
                (error, result) => {
                    if (error) {
                        console.error('Cloudinary Upload Error:', error);
                        return reject(new InternalError('File upload failed'));
                    }
                    resolve({
                        url: result.secure_url,
                        publicId: result.public_id,
                        format: result.format,
                        size: result.bytes,
                        resourceType: result.resource_type
                    });
                }
            );

            streamifier.createReadStream(buffer).pipe(uploadStream);
        });
    }

    /**
     * Delete file from Cloudinary
     * @param {string} publicId - Cloudinary public ID
     */
    async deleteFile(publicId) {
        try {
            if (!publicId) return;
            await cloudinary.uploader.destroy(publicId);
        } catch (error) {
            console.error('Cloudinary Delete Error:', error);
            // We don't throw here to avoid blocking main flows if cleanup fails
        }
    }
}

module.exports = new FileService();
