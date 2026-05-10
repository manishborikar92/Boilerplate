import { Readable } from 'node:stream';

import { StorageAdapter } from '../storage.adapter.js';
import { StorageModuleError } from '../storage-error.js';

export class CloudinaryStorageAdapter extends StorageAdapter {
  constructor({ cloudinary, logger = console } = {}) {
    super();
    if (!cloudinary?.uploader || !cloudinary?.api) {
      throw new Error('CloudinaryStorageAdapter requires cloudinary.v2');
    }
    this.cloudinary = cloudinary;
    this.logger = logger;
  }

  getProviderName() {
    return 'cloudinary';
  }

  uploadBuffer({ buffer, folder = 'uploads', publicId, resourceType = 'auto', tags = [], context = {}, transformation }) {
    if (!Buffer.isBuffer(buffer)) {
      throw new StorageModuleError('uploadBuffer requires a Buffer', { statusCode: 400 });
    }

    return new Promise((resolve, reject) => {
      const uploadStream = this.cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          resource_type: resourceType,
          tags,
          context,
          transformation,
          use_filename: true,
          unique_filename: true,
          overwrite: false,
        },
        (error, result) => {
          if (error) {
            reject(new StorageModuleError(error.message, { providerCode: error.http_code || null }));
            return;
          }

          this.logger.info?.('Cloudinary upload complete', { publicId: result.public_id });
          resolve(toStoredObject(result));
        },
      );

      Readable.from(buffer).pipe(uploadStream);
    });
  }

  async deleteObject({ publicId, resourceType = 'image', invalidate = true }) {
    if (!publicId) {
      throw new StorageModuleError('publicId is required', { statusCode: 400 });
    }

    const result = await this.cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate,
    });

    return {
      deleted: result.result === 'ok' || result.result === 'not found',
      result: result.result,
      raw: result,
    };
  }

  async getObjectMetadata({ publicId, resourceType = 'image' }) {
    try {
      const result = await this.cloudinary.api.resource(publicId, {
        resource_type: resourceType,
      });
      return toStoredObject(result);
    } catch (error) {
      if (error.http_code === 404 || error.error?.http_code === 404) {
        throw new StorageModuleError('Object not found', { statusCode: 404 });
      }
      throw new StorageModuleError(error.message);
    }
  }

  createSignedUrl({ publicId, resourceType = 'image', expiresInSeconds = 3600, transformation }) {
    if (!publicId) {
      throw new StorageModuleError('publicId is required', { statusCode: 400 });
    }

    return this.cloudinary.url(publicId, {
      resource_type: resourceType,
      secure: true,
      sign_url: true,
      type: 'authenticated',
      expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
      transformation,
    });
  }
}

const toStoredObject = (result) => ({
  provider: 'cloudinary',
  publicId: result.public_id,
  url: result.secure_url,
  resourceType: result.resource_type,
  format: result.format,
  bytes: result.bytes,
  width: result.width,
  height: result.height,
  createdAt: result.created_at,
  raw: result,
});

export const extractCloudinaryPublicId = (url) => {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
  return match?.[1] || null;
};

export const createCloudinaryStorageAdapter = (options) => new CloudinaryStorageAdapter(options);
