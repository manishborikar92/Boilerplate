const mongoose = require('mongoose');
const Folder = require('../models/Folder');

let ensureFolderIndexesPromise = null;

function isLegacyFolderNameIndex(index = {}) {
  const keys = Object.keys(index.key || {});

  return (
    index.unique === true &&
    keys.length === 3 &&
    index.key.clientId === 1 &&
    index.key.name === 1 &&
    index.key.isDeleted === 1
  );
}

async function listFolderIndexes(collection) {
  try {
    return await collection.indexes();
  } catch (error) {
    if (error?.codeName === 'NamespaceNotFound') {
      return [];
    }
    throw error;
  }
}

async function dropLegacyFolderIndexes() {
  if (mongoose.connection.readyState !== 1) {
    return [];
  }

  const collection = mongoose.connection.db.collection(Folder.collection.name);
  const indexes = await listFolderIndexes(collection);
  const legacyIndexes = indexes.filter(isLegacyFolderNameIndex);

  for (const legacyIndex of legacyIndexes) {
    await collection.dropIndex(legacyIndex.name);
  }

  return legacyIndexes.map((index) => index.name);
}

async function ensureFolderIndexesCompatible() {
  if (ensureFolderIndexesPromise) {
    return ensureFolderIndexesPromise;
  }

  ensureFolderIndexesPromise = (async () => {
    const droppedIndexes = await dropLegacyFolderIndexes();
    await Folder.createIndexes();

    return {
      droppedIndexes,
    };
  })().catch((error) => {
    ensureFolderIndexesPromise = null;
    throw error;
  });

  return ensureFolderIndexesPromise;
}

function resetFolderIndexCompatibilityCache() {
  ensureFolderIndexesPromise = null;
}

module.exports = {
  ensureFolderIndexesCompatible,
  dropLegacyFolderIndexes,
  resetFolderIndexCompatibilityCache,
  isLegacyFolderNameIndex,
};
