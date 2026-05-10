const WORKSPACE_DOCUMENT_SOURCE = 'workspace';
const CONVERSATION_DOCUMENT_SOURCE = 'conversation';

const DOCUMENT_SOURCE_VALUES = [
  WORKSPACE_DOCUMENT_SOURCE,
  CONVERSATION_DOCUMENT_SOURCE
];

function normalizeFolderName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function buildHierarchyMetadata({ name, parentFolder = null } = {}) {
  const normalizedName = normalizeFolderName(name);

  if (!parentFolder) {
    return {
      normalizedName,
      ancestorIds: [],
      depth: 0
    };
  }

  const ancestorIds = [
    ...(parentFolder.ancestorIds || []),
    parentFolder._id
  ];

  return {
    normalizedName,
    ancestorIds,
    depth: ancestorIds.length
  };
}

function assertFolderMoveAllowed({ folder, nextParent } = {}) {
  if (!folder || !nextParent) {
    return true;
  }

  const folderId = folder._id?.toString();
  const nextParentId = nextParent._id?.toString();

  if (folderId && nextParentId && folderId === nextParentId) {
    throw new Error('Folder cannot be moved into itself');
  }

  const nextParentAncestorIds = (nextParent.ancestorIds || []).map((id) => id.toString());
  if (folderId && nextParentAncestorIds.includes(folderId)) {
    throw new Error('Folder cannot be moved into one of its descendants');
  }

  return true;
}

function buildBreadcrumbs({ currentFolder, folderLookup } = {}) {
  if (!currentFolder) {
    return [];
  }

  const orderedIds = [
    ...(currentFolder.ancestorIds || []),
    currentFolder._id
  ];

  return orderedIds
    .map((id) => folderLookup?.get(id.toString()))
    .filter(Boolean);
}

function inferDocumentSource({
  documentSource,
  folderId,
  cloudinaryFolder,
  tags,
  description
} = {}) {
  if (DOCUMENT_SOURCE_VALUES.includes(documentSource)) {
    return documentSource;
  }

  if (folderId) {
    return WORKSPACE_DOCUMENT_SOURCE;
  }

  const normalizedFolder = String(cloudinaryFolder || '').toLowerCase();
  const normalizedDescription = String(description || '').toLowerCase();
  const normalizedTags = Array.isArray(tags)
    ? tags.map((tag) => String(tag).trim().toLowerCase())
    : [];

  const isConversationDocument =
    normalizedFolder.includes('/chat') ||
    normalizedTags.some((tag) => ['chat', 'chat-upload', 'conversation'].includes(tag)) ||
    normalizedDescription.includes('chat upload') ||
    normalizedDescription.includes('conversation upload');

  return isConversationDocument
    ? CONVERSATION_DOCUMENT_SOURCE
    : WORKSPACE_DOCUMENT_SOURCE;
}

function buildWorkspaceStorageRoot({ firmId, clientId } = {}) {
  if (!firmId || !clientId) {
    throw new Error('firmId and clientId are required to build the workspace storage root');
  }

  return `CA-Workflow/documents/workspace/${firmId}/${clientId}`;
}

function buildConversationStorageRoot({ firmId, clientId } = {}) {
  if (!firmId || !clientId) {
    throw new Error('firmId and clientId are required to build the conversation storage root');
  }

  return `CA-Workflow/documents/conversations/${firmId}/${clientId}/chat`;
}

module.exports = {
  WORKSPACE_DOCUMENT_SOURCE,
  CONVERSATION_DOCUMENT_SOURCE,
  DOCUMENT_SOURCE_VALUES,
  normalizeFolderName,
  buildHierarchyMetadata,
  assertFolderMoveAllowed,
  buildBreadcrumbs,
  inferDocumentSource,
  buildWorkspaceStorageRoot,
  buildConversationStorageRoot
};
