const { PassThrough } = require('stream');

const buildCloudinaryMock = () => ({
  uploader: {
    upload_stream: jest.fn(),
    destroy: jest.fn()
  },
  api: {
    delete_resources: jest.fn(),
    resource: jest.fn(),
    resources: jest.fn(),
    create_folder: jest.fn(),
    delete_resources_by_prefix: jest.fn(),
    delete_folder: jest.fn()
  },
  url: jest.fn()
});

const loadService = (cloudinaryMock, streamifierMock = null) => {
  jest.resetModules();
  jest.doMock('../../src/config/cloudinary', () => ({ cloudinary: cloudinaryMock }));
  jest.doMock('../../src/middleware/logger', () => ({
    logger: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    }
  }));
  jest.doMock('streamifier', () => (
    streamifierMock || {
      createReadStream: jest.fn(() => ({ pipe: jest.fn() }))
    }
  ));
  let service;
  let InternalError;
  let ValidationError;
  let NotFoundError;
  jest.isolateModules(() => {
    service = require('../../src/services/cloudinaryService');
    ({ InternalError, ValidationError, NotFoundError } = require('../../src/utils/errorHandler'));
  });
  return { service, InternalError, ValidationError, NotFoundError };
};

describe('cloudinaryService', () => {
  it('uploads files successfully and handles errors', async () => {
    const cloudinaryMock = buildCloudinaryMock();
    cloudinaryMock.uploader.upload_stream.mockImplementation((options, cb) => {
      cb(null, {
        public_id: 'id',
        secure_url: 'url',
        format: 'pdf',
        resource_type: 'raw',
        bytes: 10,
        width: 1,
        height: 1,
        created_at: 'now'
      });
      return new PassThrough();
    });
    const { service } = loadService(cloudinaryMock);
    const result = await service.uploadFile(Buffer.from('test'));
    expect(result.publicId).toBe('id');

    cloudinaryMock.uploader.upload_stream.mockImplementation((options, cb) => {
      cb(new Error('fail'));
      return new PassThrough();
    });
    await expect(service.uploadFile(Buffer.from('test'))).rejects.toThrow('File upload failed');
  });

  it('handles upload stream failures', async () => {
    const cloudinaryMock = buildCloudinaryMock();
    cloudinaryMock.uploader.upload_stream.mockImplementation(() => {
      throw new Error('boom');
    });
    const { service } = loadService(cloudinaryMock);
    await expect(service.uploadFile(Buffer.from('test'))).rejects.toThrow('boom');
  });

  it('handles invalid file buffer', async () => {
    const cloudinaryMock = buildCloudinaryMock();
    cloudinaryMock.uploader.upload_stream.mockImplementation(() => new PassThrough());
    const { service } = loadService(cloudinaryMock);
    await expect(service.uploadFile(null)).rejects.toThrow('Upload failed');
  });

  it('uploads multiple files and handles errors', async () => {
    const cloudinaryMock = buildCloudinaryMock();
    cloudinaryMock.uploader.upload_stream.mockImplementation((options, cb) => {
      cb(null, {
        public_id: options.public_id,
        secure_url: 'url',
        format: 'pdf',
        resource_type: 'raw',
        bytes: 10,
        width: 1,
        height: 1,
        created_at: 'now'
      });
      return new PassThrough();
    });
    const { service } = loadService(cloudinaryMock);
    const results = await service.uploadMultipleFiles([
      { buffer: Buffer.from('a'), originalname: 'a.pdf' },
      { buffer: Buffer.from('b'), originalname: 'b.pdf' }
    ]);
    expect(results).toHaveLength(2);

    jest.spyOn(service, 'uploadFile').mockRejectedValueOnce(new Error('fail'));
    await expect(service.uploadMultipleFiles([{ buffer: Buffer.from('a'), originalname: 'a.pdf' }])).rejects.toThrow('Multiple upload failed');
  });

  it('deletes files with success and error paths', async () => {
    const cloudinaryMock = buildCloudinaryMock();
    cloudinaryMock.uploader.destroy.mockResolvedValue({ result: 'ok' });
    const { service } = loadService(cloudinaryMock);
    const ok = await service.deleteFile('id');
    expect(ok.success).toBe(true);

    cloudinaryMock.uploader.destroy.mockResolvedValue({ result: 'not found' });
    const nf = await service.deleteFile('id');
    expect(nf.result).toBe('not found');

    cloudinaryMock.uploader.destroy.mockResolvedValue({ result: 'failed' });
    await expect(service.deleteFile('id')).rejects.toThrow('Delete failed');

    cloudinaryMock.uploader.destroy.mockRejectedValue(new Error('fail'));
    await expect(service.deleteFile('id')).rejects.toThrow('Delete failed');

    await expect(service.deleteFile()).rejects.toThrow('Delete failed');
  });

  it('deletes multiple files and handles errors', async () => {
    const cloudinaryMock = buildCloudinaryMock();
    cloudinaryMock.api.delete_resources.mockResolvedValue({ deleted: { a: 'deleted' } });
    const { service } = loadService(cloudinaryMock);
    const result = await service.deleteMultipleFiles(['a']);
    expect(result.deleted.a).toBe('deleted');

    await expect(service.deleteMultipleFiles([])).rejects.toThrow('Multiple delete failed');
    cloudinaryMock.api.delete_resources.mockRejectedValue(new Error('fail'));
    await expect(service.deleteMultipleFiles(['a'])).rejects.toThrow('Multiple delete failed');
  });

  it('gets file details and handles errors', async () => {
    const cloudinaryMock = buildCloudinaryMock();
    cloudinaryMock.api.resource.mockResolvedValue({
      public_id: 'id',
      format: 'pdf',
      resource_type: 'raw',
      bytes: 10,
      width: 1,
      height: 1,
      secure_url: 'url',
      created_at: 'now'
    });
    const { service, NotFoundError } = loadService(cloudinaryMock);
    const details = await service.getFileDetails('id');
    expect(details.publicId).toBe('id');

    await expect(service.getFileDetails()).rejects.toThrow('Failed to get file details');

    cloudinaryMock.api.resource.mockRejectedValue({ error: { http_code: 404 } });
    await expect(service.getFileDetails('id')).rejects.toThrow(NotFoundError);

    cloudinaryMock.api.resource.mockRejectedValue(new Error('fail'));
    await expect(service.getFileDetails('id')).rejects.toThrow('Failed to get file details');
  });

  it('lists files and handles errors', async () => {
    const cloudinaryMock = buildCloudinaryMock();
    cloudinaryMock.api.resources.mockResolvedValue({
      resources: [{ public_id: 'id', format: 'pdf', bytes: 1, secure_url: 'url', created_at: 'now' }],
      next_cursor: 'next'
    });
    const { service } = loadService(cloudinaryMock);
    const list = await service.listFiles('folder');
    expect(list.resources).toHaveLength(1);
    expect(list.nextCursor).toBe('next');

    cloudinaryMock.api.resources.mockRejectedValue(new Error('fail'));
    await expect(service.listFiles('folder')).rejects.toThrow('Failed to list files');
  });

  it('generates signed urls and handles errors', () => {
    const cloudinaryMock = buildCloudinaryMock();
    cloudinaryMock.url.mockReturnValue('signed-url');
    const { service } = loadService(cloudinaryMock);
    const url = service.generateSignedUrl('id', { expiresIn: 1 });
    expect(url).toBe('signed-url');

    cloudinaryMock.url.mockImplementation(() => {
      throw new Error('fail');
    });
    expect(() => service.generateSignedUrl('id')).toThrow('Failed to generate signed URL');
  });

  it('extracts public id from urls', () => {
    const { service } = loadService(buildCloudinaryMock());
    const url = 'https://res.cloudinary.com/demo/image/upload/v1234/folder/file.jpg';
    const url2 = 'https://res.cloudinary.com/demo/image/upload/folder/file.jpg';
    expect(service.extractPublicId(url)).toBe('folder/file');
    expect(service.extractPublicId(url2)).toBe('folder/file');
    expect(service.extractPublicId('bad')).toBeNull();
    expect(service.extractPublicId(null)).toBeNull();

    const spy = jest.spyOn(String.prototype, 'match').mockImplementation(() => {
      throw new Error('fail');
    });
    expect(service.extractPublicId('https://x')).toBeNull();
    spy.mockRestore();
  });

  it('creates and deletes folders', async () => {
    const cloudinaryMock = buildCloudinaryMock();
    cloudinaryMock.api.create_folder.mockResolvedValue({ success: true });
    cloudinaryMock.api.delete_resources_by_prefix.mockResolvedValue({});
    cloudinaryMock.api.delete_folder.mockResolvedValue({ success: true });
    const { service } = loadService(cloudinaryMock);
    const created = await service.createFolder('folder');
    expect(created.success).toBe(true);
    const deleted = await service.deleteFolder('folder');
    expect(deleted.success).toBe(true);

    cloudinaryMock.api.create_folder.mockRejectedValue({ error: { message: 'already exists' } });
    const exists = await service.createFolder('folder');
    expect(exists.message).toBe('Folder already exists');

    cloudinaryMock.api.create_folder.mockRejectedValue(new Error('fail'));
    await expect(service.createFolder('folder')).rejects.toThrow('Failed to create folder');

    cloudinaryMock.api.delete_folder.mockRejectedValue(new Error('fail'));
    await expect(service.deleteFolder('folder')).rejects.toThrow('Failed to delete folder');
  });
});
