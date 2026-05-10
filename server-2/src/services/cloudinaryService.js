/**
 * Cloudinary Service
 * Handles all file upload, download, and management operations with Cloudinary
 */
const { cloudinary } = require('../config/cloudinary');
const { logger } = require('../middleware/logger');
const { 
  InternalError, 
  ValidationError,
  NotFoundError 
} = require('../utils/errorHandler');
const path = require('path');
const streamifier = require('streamifier');

class CloudinaryService {
  /**
   * Upload file to Cloudinary
   * @param {Buffer} fileBuffer - File buffer from multer
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload result with URL and metadata
   */
  static async uploadFile(fileBuffer, options = {}) {
    try {
      const {
        folder = 'uploads',
        resourceType = 'auto',
        publicId,
        transformation,
        tags = [],
        context = {}
      } = options;

      logger.info('Uploading file to Cloudinary', { 
        folder, 
        resourceType,
        bufferSize: fileBuffer.length 
      });

      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: resourceType,
            type: 'upload', // Ensure public access
            access_mode: 'public', // Explicitly set public access
            public_id: publicId,
            transformation,
            tags,
            context,
            use_filename: true,
            unique_filename: true,
            overwrite: false
          },
          (error, result) => {
            if (error) {
              logger.error('Cloudinary upload failed', { error: error.message });
              reject(new InternalError(`File upload failed: ${error.message}`));
            } else {
              logger.info('File uploaded successfully', { 
                publicId: result.public_id,
                url: result.secure_url,
                accessMode: result.access_mode
              });
              resolve({
                publicId: result.public_id,
                url: result.secure_url,
                format: result.format,
                resourceType: result.resource_type,
                bytes: result.bytes,
                width: result.width,
                height: result.height,
                createdAt: result.created_at
              });
            }
          }
        );

        streamifier.createReadStream(fileBuffer).pipe(uploadStream);
      });
    } catch (error) {
      logger.error('Upload error', { error: error.message });
      throw new InternalError(`Upload failed: ${error.message}`);
    }
  }

  /**
   * Upload multiple files
   * @param {Array} files - Array of file objects with buffers
   * @param {Object} options - Upload options
   * @returns {Promise<Array>} Array of upload results
   */
  static async uploadMultipleFiles(files, options = {}) {
    try {
      const uploadPromises = files.map(file => 
        this.uploadFile(file.buffer, {
          ...options,
          publicId: options.publicId || path.parse(file.originalname).name
        })
      );

      const results = await Promise.all(uploadPromises);
      logger.info('Multiple files uploaded', { count: results.length });
      return results;
    } catch (error) {
      logger.error('Multiple upload error', { error: error.message });
      throw new InternalError(`Multiple upload failed: ${error.message}`);
    }
  }

  /**
   * Delete file from Cloudinary
   * @param {string} publicId - Cloudinary public ID
   * @param {string} resourceType - Resource type (image, video, raw)
   * @returns {Promise<Object>} Deletion result
   */
  static async deleteFile(publicId, resourceType = 'auto') {
    try {
      if (!publicId) {
        throw new ValidationError('Public ID is required for deletion');
      }

      logger.info('Deleting file from Cloudinary', { publicId, resourceType });

      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        invalidate: true
      });

      if (result.result === 'ok' || result.result === 'not found') {
        logger.info('File deleted successfully', { publicId });
        return { success: true, result: result.result };
      }

      throw new InternalError('File deletion failed');
    } catch (error) {
      logger.error('Delete error', { error: error.message, publicId });
      throw new InternalError(`Delete failed: ${error.message}`);
    }
  }

  /**
   * Delete multiple files
   * @param {Array<string>} publicIds - Array of public IDs
   * @param {string} resourceType - Resource type
   * @returns {Promise<Object>} Deletion result
   */
  static async deleteMultipleFiles(publicIds, resourceType = 'auto') {
    try {
      if (!publicIds || publicIds.length === 0) {
        throw new ValidationError('Public IDs array is required');
      }

      logger.info('Deleting multiple files', { count: publicIds.length });

      const result = await cloudinary.api.delete_resources(publicIds, {
        resource_type: resourceType,
        invalidate: true
      });

      logger.info('Multiple files deleted', { 
        deleted: Object.keys(result.deleted).length 
      });

      return result;
    } catch (error) {
      logger.error('Multiple delete error', { error: error.message });
      throw new InternalError(`Multiple delete failed: ${error.message}`);
    }
  }

  /**
   * Get file details
   * @param {string} publicId - Cloudinary public ID
   * @param {string} resourceType - Resource type
   * @returns {Promise<Object>} File details
   */
  static async getFileDetails(publicId, resourceType = 'image') {
    try {
      if (!publicId) {
        throw new ValidationError('Public ID is required');
      }

      logger.info('Fetching file details', { publicId });

      const result = await cloudinary.api.resource(publicId, {
        resource_type: resourceType
      });

      return {
        publicId: result.public_id,
        format: result.format,
        resourceType: result.resource_type,
        bytes: result.bytes,
        width: result.width,
        height: result.height,
        url: result.secure_url,
        createdAt: result.created_at
      };
    } catch (error) {
      if (error.error && error.error.http_code === 404) {
        throw new NotFoundError('File not found');
      }
      logger.error('Get file details error', { error: error.message });
      throw new InternalError(`Failed to get file details: ${error.message}`);
    }
  }

  /**
   * List files in a folder
   * @param {string} folder - Folder path
   * @param {Object} options - List options
   * @returns {Promise<Object>} List of files
   */
  static async listFiles(folder, options = {}) {
    try {
      const {
        maxResults = 100,
        nextCursor,
        resourceType = 'image'
      } = options;

      logger.info('Listing files', { folder, maxResults });

      const result = await cloudinary.api.resources({
        type: 'upload',
        prefix: folder,
        max_results: maxResults,
        next_cursor: nextCursor,
        resource_type: resourceType
      });

      return {
        resources: result.resources.map(r => ({
          publicId: r.public_id,
          format: r.format,
          bytes: r.bytes,
          url: r.secure_url,
          createdAt: r.created_at
        })),
        nextCursor: result.next_cursor
      };
    } catch (error) {
      logger.error('List files error', { error: error.message });
      throw new InternalError(`Failed to list files: ${error.message}`);
    }
  }

  /**
   * Generate signed URL for secure access
   * @param {string} publicId - Cloudinary public ID
   * @param {Object} options - URL options
   * @returns {string} Signed URL
   */
  static generateSignedUrl(publicId, options = {}) {
    try {
      const {
        expiresIn = 3600, // 1 hour default
        transformation
      } = options;

      const timestamp = Math.round(Date.now() / 1000) + expiresIn;

      const url = cloudinary.url(publicId, {
        sign_url: true,
        secure: true,
        type: 'authenticated',
        transformation,
        expires_at: timestamp
      });

      logger.info('Generated signed URL', { publicId, expiresIn });
      return url;
    } catch (error) {
      logger.error('Generate signed URL error', { error: error.message });
      throw new InternalError(`Failed to generate signed URL: ${error.message}`);
    }
  }

  /**
   * Extract public ID from Cloudinary URL
   * @param {string} url - Cloudinary URL
   * @returns {string|null} Public ID
   */
  static extractPublicId(url) {
    try {
      if (!url || typeof url !== 'string') return null;

      // Match Cloudinary URL pattern
      const match = url.match(/\/v\d+\/(.+?)(?:\.[^.]+)?$/);
      if (match && match[1]) {
        return match[1];
      }

      // Alternative pattern without version
      const altMatch = url.match(/\/upload\/(.+?)(?:\.[^.]+)?$/);
      if (altMatch && altMatch[1]) {
        return altMatch[1];
      }

      return null;
    } catch (error) {
      logger.error('Extract public ID error', { error: error.message });
      return null;
    }
  }

  /**
   * Create folder
   * @param {string} folderPath - Folder path to create
   * @returns {Promise<Object>} Creation result
   */
  static async createFolder(folderPath) {
    try {
      logger.info('Creating folder', { folderPath });

      const result = await cloudinary.api.create_folder(folderPath);
      
      logger.info('Folder created', { folderPath });
      return result;
    } catch (error) {
      // Folder might already exist
      if (error.error && error.error.message.includes('already exists')) {
        logger.info('Folder already exists', { folderPath });
        return { success: true, message: 'Folder already exists' };
      }
      logger.error('Create folder error', { error: error.message });
      throw new InternalError(`Failed to create folder: ${error.message}`);
    }
  }

  /**
   * Delete folder and all its contents
   * @param {string} folderPath - Folder path to delete
   * @returns {Promise<Object>} Deletion result
   */
  static async deleteFolder(folderPath) {
    try {
      logger.info('Deleting folder', { folderPath });

      // First delete all resources in the folder
      await cloudinary.api.delete_resources_by_prefix(folderPath);

      // Then delete the folder itself
      const result = await cloudinary.api.delete_folder(folderPath);

      logger.info('Folder deleted', { folderPath });
      return result;
    } catch (error) {
      logger.error('Delete folder error', { error: error.message });
      throw new InternalError(`Failed to delete folder: ${error.message}`);
    }
  }
}

module.exports = CloudinaryService;
