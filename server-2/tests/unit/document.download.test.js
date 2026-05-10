const { PassThrough } = require('stream');

jest.mock('https', () => ({
  get: jest.fn(),
}));

jest.mock('../../src/models/Document', () => ({
  findById: jest.fn(),
}));

jest.mock('../../src/models/Client', () => ({
  findById: jest.fn(),
}));

const https = require('https');
const Document = require('../../src/models/Document');
const Client = require('../../src/models/Client');
const { downloadDocument } = require('../../src/controllers/documentController');

describe('documentController.downloadDocument', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('streams document when CA-Admin has access', async () => {
    Document.findById.mockResolvedValue({
      _id: 'doc1',
      isDeleted: false,
      firmId: 'firm1',
      clientId: 'client1',
      requiresPayment: false,
      isPaid: false,
      cloudinaryUrl: 'https://example.com/file.pdf',
      mimeType: 'application/pdf',
      fileName: 'file.pdf',
      originalName: 'file.pdf',
    });

    const upstream = new PassThrough();
    upstream.statusCode = 200;
    upstream.headers = { 'content-type': 'application/pdf' };

    https.get.mockImplementation((_url, cb) => {
      cb(upstream);
      process.nextTick(() => upstream.end('data'));
      return {
        on: () => {},
        end: () => {},
      };
    });

    const headers = {};
    const res = new PassThrough();
    res.setHeader = (k, v) => {
      headers[String(k).toLowerCase()] = v;
    };
    res.getHeader = (k) => headers[String(k).toLowerCase()];

    const req = {
      params: { id: 'doc1' },
      query: { disposition: 'attachment' },
      user: { _id: 'u1', role: 'CA-Admin', firmId: 'firm1' },
    };

    const next = jest.fn();

    await new Promise((resolve, reject) => {
      res.on('finish', resolve);
      res.on('error', reject);
      downloadDocument(req, res, next);
    });

    expect(next).not.toHaveBeenCalled();
    expect(https.get).toHaveBeenCalled();
    expect(headers['content-type']).toBe('application/pdf');
    expect(headers['content-disposition']).toContain('attachment');
  });

  it('rejects client download when payment required and unpaid', async () => {
    Document.findById.mockResolvedValue({
      _id: 'doc2',
      isDeleted: false,
      firmId: 'firm1',
      clientId: 'client2',
      requiresPayment: true,
      isPaid: false,
      cloudinaryUrl: 'https://example.com/file.pdf',
      mimeType: 'application/pdf',
      fileName: 'file.pdf',
      originalName: 'file.pdf',
    });

    Client.findById.mockResolvedValue({
      _id: 'client2',
      userAccountId: 'u2',
    });

    const headers = {};
    const res = new PassThrough();
    res.setHeader = (k, v) => {
      headers[String(k).toLowerCase()] = v;
    };
    res.getHeader = (k) => headers[String(k).toLowerCase()];

    const req = {
      params: { id: 'doc2' },
      query: { disposition: 'attachment' },
      user: { _id: 'u2', role: 'Client' },
    };

    const next = jest.fn();

    downloadDocument(req, res, next);

    await new Promise((r) => setImmediate(r));
    expect(next).toHaveBeenCalled();
    expect(https.get).not.toHaveBeenCalled();
  });
});
