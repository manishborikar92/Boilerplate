const mongoose = require('mongoose');
const Folder = require('../models/Folder');
const Document = require('../models/Document');
const {
  ValidationError,
  NotFoundError,
} = require('../utils/errorHandler');
const {
  WORKSPACE_DOCUMENT_SOURCE,
  buildHierarchyMetadata,
  assertFolderMoveAllowed,
  buildBreadcrumbs,
} = require('./documentWorkspaceService');
const { ensureFolderIndexesCompatible } = require('./folderIndexService');

function normalizePage(value, fallback = 1) {
  return Math.max(1, parseInt(value, 10) || fallback);
}

function normalizeLimit(value, fallback = 50, max = 200) {
  return Math.min(max, Math.max(1, parseInt(value, 10) || fallback));
}

function sortWorkspaceItems(items, { sortBy = 'name', sortOrder = 'asc' } = {}) {
  const direction = sortOrder === 'desc' ? -1 : 1;

  return [...items].sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === 'folder' ? -1 : 1;
    }

    let leftValue;
    let rightValue;

    switch (sortBy) {
      case 'createdAt':
        leftValue = new Date(left.createdAt || 0).getTime();
        rightValue = new Date(right.createdAt || 0).getTime();
        break;
      case 'updatedAt':
        leftValue = new Date(left.updatedAt || 0).getTime();
        rightValue = new Date(right.updatedAt || 0).getTime();
        break;
      case 'fileSize':
        leftValue = left.fileSize || 0;
        rightValue = right.fileSize || 0;
        break;
      case 'type':
        leftValue = left.type;
        rightValue = right.type;
        break;
      case 'name':
      default:
        leftValue = String(left.name || left.displayName || '').toLowerCase();
        rightValue = String(right.name || right.displayName || '').toLowerCase();
        break;
    }

    if (leftValue < rightValue) {
      return -1 * direction;
    }

    if (leftValue > rightValue) {
      return 1 * direction;
    }

    const leftFallback = String(left.name || left.displayName || '').toLowerCase();
    const rightFallback = String(right.name || right.displayName || '').toLowerCase();

    if (leftFallback < rightFallback) {
      return -1;
    }

    if (leftFallback > rightFallback) {
      return 1;
    }

    return 0;
  });
}

function toFolderTree(folders) {
  const folderMap = new Map();
  const rootFolders = [];

  folders.forEach((folder) => {
    folderMap.set(folder._id.toString(), {
      ...folder,
      children: [],
      hasChildren: folder.childFolderCount > 0,
    });
  });

  folders.forEach((folder) => {
    const current = folderMap.get(folder._id.toString());
    if (folder.parentId) {
      const parent = folderMap.get(folder.parentId.toString());
      if (parent) {
        parent.children.push(current);
        return;
      }
    }

    rootFolders.push(current);
  });

  const sortTree = (nodes) => {
    nodes.sort((left, right) => left.name.localeCompare(right.name));
    nodes.forEach((node) => sortTree(node.children));
  };

  sortTree(rootFolders);
  return rootFolders;
}

function toFolderObjectId(value) {
  if (!value) {
    return null;
  }

  return value instanceof mongoose.Types.ObjectId
    ? value
    : new mongoose.Types.ObjectId(value);
}

async function getWorkspaceFolderCountMaps(folders = []) {
  const folderIds = [...new Set(
    folders
      .map((folder) => folder?._id || folder?.id || null)
      .filter(Boolean)
      .map((id) => id.toString())
  )];

  if (folderIds.length === 0) {
    return {
      documentCountMap: new Map(),
      childFolderCountMap: new Map(),
    };
  }

  const objectIds = folderIds.map(toFolderObjectId);

  const [documentCounts, childFolderCounts] = await Promise.all([
    Document.aggregate([
      {
        $match: {
          folderId: { $in: objectIds },
          isDeleted: false,
          documentSource: WORKSPACE_DOCUMENT_SOURCE,
        }
      },
      {
        $group: {
          _id: '$folderId',
          count: { $sum: 1 }
        }
      }
    ]),
    Folder.aggregate([
      {
        $match: {
          parentId: { $in: objectIds },
          isDeleted: false,
        }
      },
      {
        $group: {
          _id: '$parentId',
          count: { $sum: 1 }
        }
      }
    ]),
  ]);

  return {
    documentCountMap: new Map(
      documentCounts.map((entry) => [entry._id.toString(), entry.count])
    ),
    childFolderCountMap: new Map(
      childFolderCounts.map((entry) => [entry._id.toString(), entry.count])
    ),
  };
}

async function hydrateFoldersWithLiveCounts(folders = []) {
  const normalizedFolders = folders.map((folder) => (
    folder?.toObject ? folder.toObject() : folder
  ));

  const { documentCountMap, childFolderCountMap } = await getWorkspaceFolderCountMaps(normalizedFolders);

  return normalizedFolders.map((folder) => {
    const folderId = (folder?._id || folder?.id)?.toString();
    const directDocumentCount = folderId ? (documentCountMap.get(folderId) || 0) : 0;
    const childFolderCount = folderId ? (childFolderCountMap.get(folderId) || 0) : 0;

    return {
      ...folder,
      childFolderCount,
      directDocumentCount,
      documentCount: directDocumentCount,
    };
  });
}

async function getFolderOrThrow({ folderId, clientId, firmId }) {
  const query = {
    _id: folderId,
    isDeleted: false,
  };

  if (clientId) {
    query.clientId = clientId;
  }

  if (firmId) {
    query.firmId = firmId;
  }

  const folder = await Folder.findOne(query);
  if (!folder) {
    throw new NotFoundError('Folder not found');
  }

  return folder;
}

async function refreshFolderDocumentCounts(folderIds = []) {
  const idStrings = [...new Set(folderIds.filter(Boolean).map((id) => id.toString()))];
  if (idStrings.length === 0) {
    return;
  }

  const objectIds = idStrings.map((id) => new mongoose.Types.ObjectId(id));

  const counts = await Document.aggregate([
    {
      $match: {
        folderId: { $in: objectIds },
        isDeleted: false,
        documentSource: WORKSPACE_DOCUMENT_SOURCE,
      }
    },
    {
      $group: {
        _id: '$folderId',
        count: { $sum: 1 }
      }
    }
  ]);

  const countMap = new Map(
    counts.map((entry) => [entry._id.toString(), entry.count])
  );

  const operations = objectIds.map((folderId) => ({
    updateOne: {
      filter: { _id: folderId },
      update: {
        $set: {
          documentCount: countMap.get(folderId.toString()) || 0,
          directDocumentCount: countMap.get(folderId.toString()) || 0,
        }
      }
    }
  }));

  await Folder.bulkWrite(operations, { ordered: false });
}

async function refreshChildFolderCounts(parentIds = []) {
  const idStrings = [...new Set(parentIds.filter(Boolean).map((id) => id.toString()))];
  if (idStrings.length === 0) {
    return;
  }

  const objectIds = idStrings.map((id) => new mongoose.Types.ObjectId(id));

  const counts = await Folder.aggregate([
    {
      $match: {
        parentId: { $in: objectIds },
        isDeleted: false,
      }
    },
    {
      $group: {
        _id: '$parentId',
        count: { $sum: 1 }
      }
    }
  ]);

  const countMap = new Map(
    counts.map((entry) => [entry._id.toString(), entry.count])
  );

  const operations = objectIds.map((folderId) => ({
    updateOne: {
      filter: { _id: folderId },
      update: {
        $set: {
          childFolderCount: countMap.get(folderId.toString()) || 0,
        }
      }
    }
  }));

  await Folder.bulkWrite(operations, { ordered: false });
}

function buildDocumentSearchQuery(search) {
  if (!search) {
    return null;
  }

  return {
    $or: [
      { displayName: { $regex: search, $options: 'i' } },
      { fileName: { $regex: search, $options: 'i' } },
      { originalName: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ]
  };
}

async function getWorkspaceTree({ clientId }) {
  const folders = await Folder.find({
    clientId,
    isDeleted: false,
  })
    .sort({ depth: 1, name: 1 })
    .lean();

  const foldersWithLiveCounts = await hydrateFoldersWithLiveCounts(folders);
  return toFolderTree(foldersWithLiveCounts);
}

async function getWorkspaceContents({
  clientId,
  parentId = null,
  search = '',
  scope = 'current',
  page = 1,
  limit = 50,
  sortBy = 'name',
  sortOrder = 'asc',
}) {
  const pageNumber = normalizePage(page);
  const limitNumber = normalizeLimit(limit, 50, 200);

  const currentFolder = parentId
    ? await getFolderOrThrow({ folderId: parentId, clientId })
    : null;

  const breadcrumbs = currentFolder
    ? await (async () => {
      const folderIds = [...currentFolder.ancestorIds, currentFolder._id];
      const breadcrumbFolders = await Folder.find({
        _id: { $in: folderIds },
        isDeleted: false,
      }).lean();

      const folderLookup = new Map(
        breadcrumbFolders.map((folder) => [folder._id.toString(), folder])
      );

      return buildBreadcrumbs({
        currentFolder: currentFolder.toObject(),
        folderLookup,
      });
    })()
    : [];

  const folderQuery = {
    clientId,
    isDeleted: false,
  };

  const documentQuery = {
    clientId,
    isDeleted: false,
    documentSource: WORKSPACE_DOCUMENT_SOURCE,
  };

  if (scope === 'all') {
    if (search) {
      folderQuery.name = { $regex: search, $options: 'i' };
      Object.assign(documentQuery, buildDocumentSearchQuery(search));
    }
  } else {
    folderQuery.parentId = currentFolder?._id || null;
    documentQuery.folderId = currentFolder?._id || null;

    if (search) {
      folderQuery.name = { $regex: search, $options: 'i' };
      Object.assign(documentQuery, buildDocumentSearchQuery(search));
    }
  }

  const [folders, documents] = await Promise.all([
    Folder.find(folderQuery)
      .sort({ name: 1 })
      .lean(),
    Document.find(documentQuery)
      .populate('uploadedBy', 'name email')
      .populate('folderId', 'name color parentId')
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const countScopedFolders = currentFolder
    ? [...folders, currentFolder.toObject()]
    : folders;
  const liveFolders = await hydrateFoldersWithLiveCounts(countScopedFolders);
  const liveFolderMap = new Map(
    liveFolders.map((folder) => [(folder._id || folder.id).toString(), folder])
  );
  const workspaceFolders = folders.map((folder) => liveFolderMap.get(folder._id.toString()) || folder);

  const folderItems = workspaceFolders.map((folder) => ({
    ...folder,
    type: 'folder',
  }));

  const documentItems = documents.map((document) => ({
    ...document,
    type: 'document',
  }));

  const sortedItems = sortWorkspaceItems(
    [...folderItems, ...documentItems],
    { sortBy, sortOrder }
  );

  const skip = (pageNumber - 1) * limitNumber;
  const pagedItems = sortedItems.slice(skip, skip + limitNumber);

  return {
    currentFolder: currentFolder ? liveFolderMap.get(currentFolder._id.toString()) || currentFolder.toObject() : null,
    breadcrumbs,
    folders: pagedItems.filter((item) => item.type === 'folder'),
    documents: pagedItems.filter((item) => item.type === 'document'),
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total: sortedItems.length,
      pages: Math.max(1, Math.ceil(sortedItems.length / limitNumber)),
      folderCount: folders.length,
      documentCount: documents.length,
    },
    summary: {
      folderCount: folders.length,
      documentCount: documents.length,
      totalFileSize: documents.reduce((sum, document) => sum + (document.fileSize || 0), 0),
    }
  };
}

async function createWorkspaceFolder({
  clientId,
  firmId,
  createdBy,
  name,
  parentId = null,
  description,
  color,
  category,
}) {
  if (!name || !name.trim()) {
    throw new ValidationError('Folder name is required');
  }

  await ensureFolderIndexesCompatible();

  const parentFolder = parentId
    ? await getFolderOrThrow({ folderId: parentId, clientId, firmId })
    : null;

  const hierarchyMetadata = buildHierarchyMetadata({
    name,
    parentFolder,
  });

  const folder = await Folder.create({
    name: name.trim(),
    category: category !== undefined ? category : parentFolder?.category || null,
    description,
    color: color || '#3B82F6',
    clientId,
    firmId,
    createdBy,
    parentId: parentFolder?._id || null,
    ancestorIds: hierarchyMetadata.ancestorIds,
    depth: hierarchyMetadata.depth,
    normalizedName: hierarchyMetadata.normalizedName,
  });

  if (parentFolder) {
    await refreshChildFolderCounts([parentFolder._id]);
  }

  return folder;
}

async function updateWorkspaceFolder({
  folderId,
  name,
  parentId,
  description,
  color,
  category,
}) {
  await ensureFolderIndexesCompatible();

  const folder = await getFolderOrThrow({ folderId });
  const previousParentId = folder.parentId;
  const previousAncestorIds = [...folder.ancestorIds];
  const hasParentUpdate = Object.prototype.hasOwnProperty.call(arguments[0], 'parentId');

  let nextParent = null;
  if (hasParentUpdate && parentId) {
    nextParent = await getFolderOrThrow({
      folderId: parentId,
      clientId: folder.clientId,
      firmId: folder.firmId,
    });
    assertFolderMoveAllowed({ folder, nextParent });
  } else if (!hasParentUpdate && folder.parentId) {
    nextParent = await getFolderOrThrow({
      folderId: folder.parentId,
      clientId: folder.clientId,
      firmId: folder.firmId,
    });
  }

  const hierarchyMetadata = buildHierarchyMetadata({
    name: name !== undefined ? name : folder.name,
    parentFolder: nextParent,
  });

  if (name !== undefined) {
    folder.name = name.trim();
  }
  if (description !== undefined) {
    folder.description = description;
  }
  if (color !== undefined) {
    folder.color = color;
  }
  if (category !== undefined) {
    folder.category = category;
  }
  if (hasParentUpdate) {
    folder.parentId = nextParent?._id || null;
    folder.ancestorIds = hierarchyMetadata.ancestorIds;
    folder.depth = hierarchyMetadata.depth;
  }

  await folder.save();

  const movedParentsChanged =
    String(previousParentId || '') !== String(folder.parentId || '');

  if (hasParentUpdate) {
    const descendants = await Folder.find({
      ancestorIds: folder._id,
      isDeleted: false,
    }).lean();

    if (descendants.length > 0) {
      const previousChain = [...previousAncestorIds, folder._id].map((id) => id.toString());
      const nextChain = [...folder.ancestorIds, folder._id];

      const operations = descendants.map((descendant) => {
        const descendantAncestorIds = descendant.ancestorIds || [];
        const tail = descendantAncestorIds.slice(previousChain.length);

        return {
          updateOne: {
            filter: { _id: descendant._id },
            update: {
              $set: {
                ancestorIds: [...nextChain, ...tail],
                depth: nextChain.length + tail.length,
              }
            }
          }
        };
      });

      await Folder.bulkWrite(operations, { ordered: false });
    }
  }

  if (movedParentsChanged) {
    await refreshChildFolderCounts([previousParentId, folder.parentId]);
  }

  return folder;
}

async function deleteWorkspaceFolder({
  folderId,
  deletedBy,
  cascade = false,
}) {
  const rootFolder = await getFolderOrThrow({ folderId });
  const subtreeFolders = await Folder.find({
    $or: [
      { _id: rootFolder._id },
      { ancestorIds: rootFolder._id },
    ],
    isDeleted: false,
  }).lean();

  const subtreeFolderIds = subtreeFolders.map((folder) => folder._id);
  const childFolderCount = Math.max(0, subtreeFolders.length - 1);
  const documentCount = await Document.countDocuments({
    folderId: { $in: subtreeFolderIds },
    isDeleted: false,
    documentSource: WORKSPACE_DOCUMENT_SOURCE,
  });

  if (!cascade && (childFolderCount > 0 || documentCount > 0)) {
    const impactSummary = [];
    if (childFolderCount > 0) {
      impactSummary.push(`${childFolderCount} child folder(s)`);
    }
    if (documentCount > 0) {
      impactSummary.push(`${documentCount} document(s)`);
    }

    throw new ValidationError(
      `Cannot delete folder with ${impactSummary.join(' and ')}. Use cascade=true query parameter to delete the entire subtree.`
    );
  }

  const deletionTime = new Date();

  if (documentCount > 0) {
    await Document.updateMany(
      {
        folderId: { $in: subtreeFolderIds },
        isDeleted: false,
        documentSource: WORKSPACE_DOCUMENT_SOURCE,
      },
      {
        $set: {
          isDeleted: true,
          deletedAt: deletionTime,
          deletedBy,
        }
      }
    );
  }

  await Folder.updateMany(
    { _id: { $in: subtreeFolderIds } },
    {
      $set: {
        isDeleted: true,
        deletedAt: deletionTime,
        deletedBy,
        childFolderCount: 0,
      }
    }
  );

  await refreshChildFolderCounts([rootFolder.parentId]);

  return {
    deletedFolders: subtreeFolders.length,
    deletedDocuments: documentCount,
  };
}

async function moveWorkspaceDocument({
  documentId,
  targetFolderId,
}) {
  const document = await Document.findOne({
    _id: documentId,
    isDeleted: false,
    documentSource: WORKSPACE_DOCUMENT_SOURCE,
  });

  if (!document) {
    throw new NotFoundError('Document not found');
  }

  let targetFolder = null;
  if (targetFolderId) {
    targetFolder = await getFolderOrThrow({
      folderId: targetFolderId,
      clientId: document.clientId,
      firmId: document.firmId,
    });
  }

  const previousFolderId = document.folderId;
  document.folderId = targetFolder?._id || null;
  await document.save();

  await refreshFolderDocumentCounts([previousFolderId, document.folderId]);

  return document;
}

module.exports = {
  getWorkspaceTree,
  getWorkspaceContents,
  createWorkspaceFolder,
  updateWorkspaceFolder,
  deleteWorkspaceFolder,
  moveWorkspaceDocument,
  getWorkspaceFolderCountMaps,
  hydrateFoldersWithLiveCounts,
  refreshFolderDocumentCounts,
  refreshChildFolderCounts,
};
