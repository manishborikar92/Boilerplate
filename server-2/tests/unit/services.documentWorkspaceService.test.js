const mongoose = require('mongoose');
const {
  buildHierarchyMetadata,
  assertFolderMoveAllowed,
  buildBreadcrumbs,
  inferDocumentSource,
  buildConversationStorageRoot,
} = require('../../src/services/documentWorkspaceService');

describe('documentWorkspaceService', () => {
  it('builds hierarchy metadata for root and nested folders', () => {
    const rootMetadata = buildHierarchyMetadata({ name: '  FY 2025-26  ' });
    expect(rootMetadata).toEqual({
      normalizedName: 'fy 2025-26',
      ancestorIds: [],
      depth: 0,
    });

    const grandParentId = new mongoose.Types.ObjectId();
    const parentId = new mongoose.Types.ObjectId();

    const nestedMetadata = buildHierarchyMetadata({
      name: '  GST Returns  ',
      parentFolder: {
        _id: parentId,
        ancestorIds: [grandParentId],
        depth: 1,
      },
    });

    expect(nestedMetadata).toEqual({
      normalizedName: 'gst returns',
      ancestorIds: [grandParentId, parentId],
      depth: 2,
    });
  });

  it('rejects moving a folder into itself or a descendant', () => {
    const folderId = new mongoose.Types.ObjectId();
    const childId = new mongoose.Types.ObjectId();

    expect(() =>
      assertFolderMoveAllowed({
        folder: {
          _id: folderId,
          ancestorIds: [],
        },
        nextParent: {
          _id: folderId,
          ancestorIds: [],
        },
      })
    ).toThrow('cannot be moved into itself');

    expect(() =>
      assertFolderMoveAllowed({
        folder: {
          _id: folderId,
          ancestorIds: [],
        },
        nextParent: {
          _id: childId,
          ancestorIds: [folderId],
        },
      })
    ).toThrow('cannot be moved into one of its descendants');
  });

  it('builds breadcrumbs from the current folder chain', () => {
    const rootId = new mongoose.Types.ObjectId();
    const parentId = new mongoose.Types.ObjectId();
    const childId = new mongoose.Types.ObjectId();

    const breadcrumbMap = new Map([
      [rootId.toString(), { _id: rootId, name: 'Root' }],
      [parentId.toString(), { _id: parentId, name: 'Parent' }],
      [childId.toString(), { _id: childId, name: 'Child' }],
    ]);

    const breadcrumbs = buildBreadcrumbs({
      currentFolder: {
        _id: childId,
        name: 'Child',
        ancestorIds: [rootId, parentId],
      },
      folderLookup: breadcrumbMap,
    });

    expect(breadcrumbs.map((folder) => folder.name)).toEqual(['Root', 'Parent', 'Child']);
  });

  it('infers document source for migration and root workspace files', () => {
    expect(
      inferDocumentSource({
        folderId: new mongoose.Types.ObjectId(),
      })
    ).toBe('workspace');

    expect(
      inferDocumentSource({
        cloudinaryFolder: 'CA-Flow/documents/clients/Acme/Miscellaneous/Chat',
      })
    ).toBe('conversation');

    expect(
      inferDocumentSource({
        tags: ['chat'],
      })
    ).toBe('conversation');

    expect(
      inferDocumentSource({
        description: 'Workspace upload',
        folderId: null,
      })
    ).toBe('workspace');
  });

  it('builds the dedicated conversation storage root', () => {
    expect(
      buildConversationStorageRoot({
        firmId: 'firm-123',
        clientId: 'client-456',
      })
    ).toBe('CA-Workflow/documents/conversations/firm-123/client-456/chat');
  });
});
