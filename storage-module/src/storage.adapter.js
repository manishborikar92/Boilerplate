export class StorageAdapter {
  getProviderName() {
    throw new Error('getProviderName() must be implemented');
  }

  uploadBuffer(_params) {
    throw new Error('uploadBuffer() must be implemented');
  }

  deleteObject(_params) {
    throw new Error('deleteObject() must be implemented');
  }

  getObjectMetadata(_params) {
    throw new Error('getObjectMetadata() must be implemented');
  }

  createSignedUrl(_params) {
    throw new Error('createSignedUrl() must be implemented');
  }
}
