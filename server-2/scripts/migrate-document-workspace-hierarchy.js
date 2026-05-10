require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const Folder = require('../src/models/Folder');
const Document = require('../src/models/Document');
const {
  normalizeFolderName,
  inferDocumentSource
} = require('../src/services/documentWorkspaceService');

function idsEqual(left, right) {
  return String(left || '') === String(right || '');
}

function arraysEqual(left = [], right = []) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => idsEqual(value, right[index]));
}

function buildFolderHierarchyMetadata(folders) {
  const folderMap = new Map(
    folders.map((folder) => [folder._id.toString(), folder])
  );
  const cache = new Map();
  const visiting = new Set();

  const computeFolder = (folder) => {
    const folderId = folder._id.toString();
    if (cache.has(folderId)) {
      return cache.get(folderId);
    }

    if (visiting.has(folderId)) {
      throw new Error(`Detected a cycle while rebuilding folder hierarchy for folder ${folderId}`);
    }

    visiting.add(folderId);

    const normalizedName = normalizeFolderName(folder.name);
    const parentId = folder.parentId || null;

    if (!parentId) {
      const metadata = {
        parentId: null,
        ancestorIds: [],
        depth: 0,
        normalizedName
      };
      cache.set(folderId, metadata);
      visiting.delete(folderId);
      return metadata;
    }

    const parentFolder = folderMap.get(parentId.toString());
    if (!parentFolder) {
      const metadata = {
        parentId: null,
        ancestorIds: [],
        depth: 0,
        normalizedName
      };
      cache.set(folderId, metadata);
      visiting.delete(folderId);
      return metadata;
    }

    const parentMetadata = computeFolder(parentFolder);
    const ancestorIds = [...parentMetadata.ancestorIds, parentFolder._id];

    const metadata = {
      parentId: parentFolder._id,
      ancestorIds,
      depth: ancestorIds.length,
      normalizedName
    };

    cache.set(folderId, metadata);
    visiting.delete(folderId);
    return metadata;
  };

  folders.forEach((folder) => {
    computeFolder(folder);
  });

  return cache;
}

async function dropLegacyFolderNameIndex() {
  const collection = mongoose.connection.db.collection('folders');
  const indexes = await collection.indexes();
  const legacyIndex = indexes.find((index) => {
    const keys = Object.keys(index.key || {});
    return (
      index.unique &&
      keys.length === 3 &&
      index.key.clientId === 1 &&
      index.key.name === 1 &&
      index.key.isDeleted === 1
    );
  });

  if (!legacyIndex) {
    return false;
  }

  await collection.dropIndex(legacyIndex.name);
  return true;
}

async function backfillFolders({ dryRun = true } = {}) {
  const folders = await Folder.find({})
    .select('_id name parentId ancestorIds depth normalizedName childFolderCount directDocumentCount documentCount')
    .lean();

  const directDocumentCounts = await Document.aggregate([
    {
      $match: {
        folderId: { $ne: null },
        isDeleted: false
      }
    },
    {
      $group: {
        _id: '$folderId',
        count: { $sum: 1 }
      }
    }
  ]);

  const childFolderCounts = await Folder.aggregate([
    {
      $match: {
        parentId: { $ne: null },
        isDeleted: false
      }
    },
    {
      $group: {
        _id: '$parentId',
        count: { $sum: 1 }
      }
    }
  ]);

  const directDocumentCountMap = new Map(
    directDocumentCounts.map((entry) => [entry._id.toString(), entry.count])
  );
  const childFolderCountMap = new Map(
    childFolderCounts.map((entry) => [entry._id.toString(), entry.count])
  );
  const hierarchyMetadata = buildFolderHierarchyMetadata(folders);

  const operations = [];

  folders.forEach((folder) => {
    const folderId = folder._id.toString();
    const metadata = hierarchyMetadata.get(folderId);
    const nextDirectDocumentCount = directDocumentCountMap.get(folderId) || 0;
    const nextChildFolderCount = childFolderCountMap.get(folderId) || 0;

    const nextValues = {
      parentId: metadata.parentId,
      ancestorIds: metadata.ancestorIds,
      depth: metadata.depth,
      normalizedName: metadata.normalizedName,
      childFolderCount: nextChildFolderCount,
      directDocumentCount: nextDirectDocumentCount,
      documentCount: nextDirectDocumentCount
    };

    const needsUpdate =
      !idsEqual(folder.parentId, nextValues.parentId) ||
      !arraysEqual(folder.ancestorIds || [], nextValues.ancestorIds) ||
      folder.depth !== nextValues.depth ||
      folder.normalizedName !== nextValues.normalizedName ||
      folder.childFolderCount !== nextValues.childFolderCount ||
      folder.directDocumentCount !== nextValues.directDocumentCount ||
      folder.documentCount !== nextValues.documentCount;

    if (!needsUpdate) {
      return;
    }

    operations.push({
      updateOne: {
        filter: { _id: folder._id },
        update: { $set: nextValues }
      }
    });
  });

  if (!dryRun && operations.length > 0) {
    await Folder.bulkWrite(operations, { ordered: false });
  }

  return {
    scanned: folders.length,
    updated: operations.length
  };
}

async function backfillDocuments({ dryRun = true } = {}) {
  const documents = await Document.find({})
    .select('_id folderId cloudinaryFolder tags description displayName documentSource originalName fileName')
    .lean();

  const operations = [];

  documents.forEach((document) => {
    const nextDisplayName = String(
      document.displayName || document.originalName || document.fileName || ''
    ).trim();
    const nextDocumentSource = inferDocumentSource(document);

    const needsUpdate =
      document.displayName !== nextDisplayName ||
      document.documentSource !== nextDocumentSource;

    if (!needsUpdate) {
      return;
    }

    operations.push({
      updateOne: {
        filter: { _id: document._id },
        update: {
          $set: {
            displayName: nextDisplayName,
            documentSource: nextDocumentSource
          }
        }
      }
    });
  });

  if (!dryRun && operations.length > 0) {
    await Document.bulkWrite(operations, { ordered: false });
  }

  return {
    scanned: documents.length,
    updated: operations.length
  };
}

async function migrateDocumentWorkspaceHierarchy({ dryRun = true } = {}) {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required to run the document workspace migration');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  try {
    const droppedLegacyIndex = await dropLegacyFolderNameIndex();
    const folderResult = await backfillFolders({ dryRun });
    const documentResult = await backfillDocuments({ dryRun });

    if (!dryRun) {
      await Folder.createIndexes();
      await Document.createIndexes();
    }

    return {
      dryRun,
      droppedLegacyIndex,
      folders: folderResult,
      documents: documentResult
    };
  } finally {
    await mongoose.connection.close();
  }
}

async function runFromCli() {
  const dryRun = !process.argv.includes('--apply');
  const result = await migrateDocumentWorkspaceHierarchy({ dryRun });

  console.log('\nDocument workspace hierarchy migration summary');
  console.log(`Mode: ${dryRun ? 'dry-run' : 'apply'}`);
  console.log(`Dropped legacy folder name index: ${result.droppedLegacyIndex ? 'yes' : 'no'}`);
  console.log(`Folders scanned: ${result.folders.scanned}`);
  console.log(`Folders to update: ${result.folders.updated}`);
  console.log(`Documents scanned: ${result.documents.scanned}`);
  console.log(`Documents to update: ${result.documents.updated}`);
}

if (require.main === module) {
  runFromCli()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nDocument workspace hierarchy migration failed:', error);
      process.exit(1);
    });
}

module.exports = {
  migrateDocumentWorkspaceHierarchy,
  buildFolderHierarchyMetadata,
  backfillFolders,
  backfillDocuments,
  dropLegacyFolderNameIndex
};
