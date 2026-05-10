const mongoose = require('mongoose');
const Folder = require('../../src/models/Folder');
const Document = require('../../src/models/Document');
require('../../src/models/User');
const {
  getWorkspaceTree,
  getWorkspaceContents,
  createWorkspaceFolder,
  updateWorkspaceFolder,
  deleteWorkspaceFolder,
  moveWorkspaceDocument,
} = require('../../src/services/documentWorkspaceManager');
const { resetFolderIndexCompatibilityCache } = require('../../src/services/folderIndexService');

describe('documentWorkspaceManager', () => {
  const clientId = new mongoose.Types.ObjectId();
  const firmId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const legacyFolderIndexName = 'legacy_clientId_name_isDeleted_unique';

  const createWorkspaceDocument = async (overrides = {}) =>
    Document.create({
      fileName: overrides.fileName || 'workspace.pdf',
      originalName: overrides.originalName || 'workspace.pdf',
      fileSize: overrides.fileSize || 1024,
      mimeType: overrides.mimeType || 'application/pdf',
      fileExtension: overrides.fileExtension || '.pdf',
      cloudinaryPublicId: overrides.cloudinaryPublicId || `workspace-${new mongoose.Types.ObjectId()}`,
      cloudinaryUrl: overrides.cloudinaryUrl || 'https://example.com/workspace.pdf',
      cloudinaryFolder: overrides.cloudinaryFolder || 'CA-Workflow/documents/workspace/firm/client',
      category: overrides.category || 'Miscellaneous',
      clientId,
      firmId,
      uploadedBy: userId,
      folderId: overrides.folderId === undefined ? null : overrides.folderId,
      description: overrides.description,
      tags: overrides.tags,
      documentSource: overrides.documentSource,
      displayName: overrides.displayName,
    });

  afterEach(async () => {
    resetFolderIndexCompatibilityCache();

    await Promise.all([
      Document.deleteMany({}),
      Folder.deleteMany({}),
    ]);

    const collection = mongoose.connection.db.collection('folders');
    const indexes = await collection.indexes();
    const legacyIndex = indexes.find((index) => index.name === legacyFolderIndexName);
    if (legacyIndex) {
      await collection.dropIndex(legacyFolderIndexName);
    }
  });

  it('builds a folder tree and mixed root workspace contents', async () => {
    const fiscalYearFolder = await createWorkspaceFolder({
      clientId,
      firmId,
      createdBy: userId,
      name: 'FY 2025-26',
    });

    await createWorkspaceFolder({
      clientId,
      firmId,
      createdBy: userId,
      parentId: fiscalYearFolder._id,
      name: 'GST Returns',
    });

    const auditFolder = await createWorkspaceFolder({
      clientId,
      firmId,
      createdBy: userId,
      name: 'Audits',
    });

    await createWorkspaceDocument({
      originalName: 'root-summary.pdf',
      displayName: 'root-summary.pdf',
      description: 'Workspace upload',
      folderId: null,
    });

    const tree = await getWorkspaceTree({ clientId });
    const fiscalYearNode = tree.find((folder) => folder.name === 'FY 2025-26');
    const auditNode = tree.find((folder) => folder.name === 'Audits');

    expect(tree).toHaveLength(2);
    expect(fiscalYearNode.children).toHaveLength(1);
    expect(fiscalYearNode.childFolderCount).toBe(1);
    expect(auditNode._id.toString()).toBe(auditFolder._id.toString());

    const rootContents = await getWorkspaceContents({
      clientId,
      parentId: null,
      page: 1,
      limit: 20,
    });

    expect(rootContents.currentFolder).toBeNull();
    expect(rootContents.breadcrumbs).toEqual([]);
    expect(rootContents.folders.map((folder) => folder.name)).toEqual(['Audits', 'FY 2025-26']);
    expect(rootContents.documents).toHaveLength(1);
    expect(rootContents.documents[0].documentSource).toBe('workspace');
    expect(rootContents.summary).toEqual({
      folderCount: 2,
      documentCount: 1,
      totalFileSize: 1024,
    });
  });

  it('creates and moves folders while rewriting descendant hierarchy and counters', async () => {
    const sourceParent = await createWorkspaceFolder({
      clientId,
      firmId,
      createdBy: userId,
      name: 'Source',
    });

    const destinationParent = await createWorkspaceFolder({
      clientId,
      firmId,
      createdBy: userId,
      name: 'Destination',
    });

    const childFolder = await createWorkspaceFolder({
      clientId,
      firmId,
      createdBy: userId,
      parentId: sourceParent._id,
      name: 'Child',
    });

    const grandChildFolder = await createWorkspaceFolder({
      clientId,
      firmId,
      createdBy: userId,
      parentId: childFolder._id,
      name: 'Grandchild',
    });

    const movedFolder = await updateWorkspaceFolder({
      folderId: childFolder._id,
      name: 'Child',
      parentId: destinationParent._id,
    });

    const refreshedChild = await Folder.findById(movedFolder._id).lean();
    const refreshedGrandChild = await Folder.findById(grandChildFolder._id).lean();
    const refreshedSourceParent = await Folder.findById(sourceParent._id).lean();
    const refreshedDestinationParent = await Folder.findById(destinationParent._id).lean();

    expect(refreshedChild.parentId.toString()).toBe(destinationParent._id.toString());
    expect(refreshedChild.ancestorIds.map((id) => id.toString())).toEqual([
      destinationParent._id.toString(),
    ]);
    expect(refreshedGrandChild.ancestorIds.map((id) => id.toString())).toEqual([
      destinationParent._id.toString(),
      refreshedChild._id.toString(),
    ]);
    expect(refreshedSourceParent.childFolderCount).toBe(0);
    expect(refreshedDestinationParent.childFolderCount).toBe(1);
  });

  it('soft deletes a folder subtree and its workspace documents', async () => {
    const rootFolder = await createWorkspaceFolder({
      clientId,
      firmId,
      createdBy: userId,
      name: 'Root',
    });

    const nestedFolder = await createWorkspaceFolder({
      clientId,
      firmId,
      createdBy: userId,
      parentId: rootFolder._id,
      name: 'Nested',
    });

    const nestedDocument = await createWorkspaceDocument({
      originalName: 'nested.pdf',
      folderId: nestedFolder._id,
    });

    await createWorkspaceDocument({
      originalName: 'conversation.pdf',
      cloudinaryFolder: 'CA-Flow/documents/clients/Acme/Miscellaneous/Chat',
      tags: ['chat'],
      description: 'Chat upload',
    });

    const deleteResult = await deleteWorkspaceFolder({
      folderId: rootFolder._id,
      deletedBy: userId,
      cascade: true,
    });

    const deletedRoot = await Folder.findById(rootFolder._id).lean();
    const deletedNested = await Folder.findById(nestedFolder._id).lean();
    const deletedDocument = await Document.findById(nestedDocument._id).lean();
    const remainingConversationDocuments = await Document.countDocuments({
      documentSource: 'conversation',
      isDeleted: false,
    });

    expect(deleteResult).toEqual({
      deletedFolders: 2,
      deletedDocuments: 1,
    });
    expect(deletedRoot.isDeleted).toBe(true);
    expect(deletedNested.isDeleted).toBe(true);
    expect(deletedDocument.isDeleted).toBe(true);
    expect(remainingConversationDocuments).toBe(1);
  });

  it('moves workspace documents between folders and root while keeping counters correct', async () => {
    const sourceFolder = await createWorkspaceFolder({
      clientId,
      firmId,
      createdBy: userId,
      name: 'Source',
    });

    const destinationFolder = await createWorkspaceFolder({
      clientId,
      firmId,
      createdBy: userId,
      name: 'Destination',
    });

    const document = await createWorkspaceDocument({
      originalName: 'move-me.pdf',
      folderId: sourceFolder._id,
    });

    await Folder.findByIdAndUpdate(sourceFolder._id, {
      $set: { documentCount: 1, directDocumentCount: 1 },
    });

    const movedToFolder = await moveWorkspaceDocument({
      documentId: document._id,
      targetFolderId: destinationFolder._id,
    });

    const sourceAfterFolderMove = await Folder.findById(sourceFolder._id).lean();
    const destinationAfterFolderMove = await Folder.findById(destinationFolder._id).lean();

    expect(movedToFolder.folderId.toString()).toBe(destinationFolder._id.toString());
    expect(sourceAfterFolderMove.directDocumentCount).toBe(0);
    expect(destinationAfterFolderMove.directDocumentCount).toBe(1);

    const movedToRoot = await moveWorkspaceDocument({
      documentId: document._id,
      targetFolderId: null,
    });

    const destinationAfterRootMove = await Folder.findById(destinationFolder._id).lean();
    expect(movedToRoot.folderId).toBeNull();
    expect(destinationAfterRootMove.directDocumentCount).toBe(0);
  });

  it('returns live folder counts even when stored counters are stale', async () => {
    const parentFolder = await createWorkspaceFolder({
      clientId,
      firmId,
      createdBy: userId,
      name: 'Parent',
    });

    const childFolder = await createWorkspaceFolder({
      clientId,
      firmId,
      createdBy: userId,
      parentId: parentFolder._id,
      name: 'Child',
    });

    await createWorkspaceDocument({
      originalName: 'inside-parent.pdf',
      folderId: parentFolder._id,
    });

    await Folder.updateMany(
      { _id: { $in: [parentFolder._id, childFolder._id] } },
      {
        $set: {
          childFolderCount: 99,
          documentCount: 99,
          directDocumentCount: 99,
        }
      }
    );

    const tree = await getWorkspaceTree({ clientId });
    const parentNode = tree.find((folder) => folder.name === 'Parent');

    expect(parentNode.childFolderCount).toBe(1);
    expect(parentNode.directDocumentCount).toBe(1);
    expect(parentNode.documentCount).toBe(1);

    const rootContents = await getWorkspaceContents({
      clientId,
      parentId: null,
      page: 1,
      limit: 20,
    });

    expect(rootContents.folders).toEqual([
      expect.objectContaining({
        name: 'Parent',
        childFolderCount: 1,
        directDocumentCount: 1,
        documentCount: 1,
      })
    ]);
  });

  it('allows nested folders to reuse names after removing the legacy client-level name index', async () => {
    resetFolderIndexCompatibilityCache();

    const collection = mongoose.connection.db.collection('folders');
    await collection.createIndex(
      { clientId: 1, name: 1, isDeleted: 1 },
      { unique: true, name: legacyFolderIndexName }
    );

    const helloFolder = await createWorkspaceFolder({
      clientId,
      firmId,
      createdBy: userId,
      name: 'Hello',
    });

    await createWorkspaceFolder({
      clientId,
      firmId,
      createdBy: userId,
      name: 'Hi',
    });

    await expect(
      createWorkspaceFolder({
        clientId,
        firmId,
        createdBy: userId,
        parentId: helloFolder._id,
        name: 'Hi',
      })
    ).resolves.toBeDefined();

    const indexes = await collection.indexes();
    expect(indexes.some((index) => index.name === legacyFolderIndexName)).toBe(false);
  });
});
