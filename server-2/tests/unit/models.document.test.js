const mongoose = require('mongoose');
const Document = require('../../src/models/Document');

describe('Document model', () => {
  const clientId = new mongoose.Types.ObjectId();
  const firmId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();

  afterEach(async () => {
    await Document.deleteMany({});
  });

  it('defaults displayName and infers workspace source for root workspace files', async () => {
    const document = await Document.create({
      fileName: 'fy-2025-summary.pdf',
      originalName: 'FY 2025 Summary.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      fileExtension: '.pdf',
      cloudinaryPublicId: `workspace-${new mongoose.Types.ObjectId()}`,
      cloudinaryUrl: 'https://example.com/workspace.pdf',
      cloudinaryFolder: 'CA-Workflow/documents/workspace/firm/client',
      clientId,
      firmId,
      uploadedBy: userId,
      folderId: null,
      description: 'Workspace upload'
    });

    expect(document.displayName).toBe('FY 2025 Summary.pdf');
    expect(document.documentSource).toBe('workspace');
    expect(document.category).toBe('Miscellaneous');
  });

  it('infers conversation source from chat upload metadata', async () => {
    const document = await Document.create({
      fileName: 'chat-proof.pdf',
      originalName: 'chat-proof.pdf',
      fileSize: 2048,
      mimeType: 'application/pdf',
      fileExtension: '.pdf',
      cloudinaryPublicId: `conversation-${new mongoose.Types.ObjectId()}`,
      cloudinaryUrl: 'https://example.com/conversation.pdf',
      cloudinaryFolder: 'CA-Flow/documents/clients/Acme/Miscellaneous/Chat',
      category: 'Miscellaneous',
      clientId,
      firmId,
      uploadedBy: userId,
      tags: ['chat'],
      description: 'Chat upload'
    });

    expect(document.documentSource).toBe('conversation');
    expect(document.displayName).toBe('chat-proof.pdf');
  });

  it('keeps only the workspace storage helper and removes the legacy folder-structure helper', () => {
    expect(typeof Document.getWorkspaceStorageRoot).toBe('function');
    expect(Document.getFolderStructure).toBeUndefined();
  });
});
