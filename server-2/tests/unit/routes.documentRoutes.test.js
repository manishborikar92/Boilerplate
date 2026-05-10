jest.mock('../../src/controllers/documentController', () => ({
  uploadDocument: jest.fn(),
  getWorkspace: jest.fn(),
  getClientDocuments: jest.fn(),
  getSharedConversationDocuments: jest.fn(),
  getDocumentsByCategory: jest.fn(),
  getDocument: jest.fn(),
  updateDocument: jest.fn(),
  deleteDocument: jest.fn(),
  permanentDeleteDocument: jest.fn(),
  getCategories: jest.fn(),
  searchDocuments: jest.fn(),
  setPaymentRequirement: jest.fn(),
  getDocumentWithAccessCheck: jest.fn(),
  downloadDocument: jest.fn(),
  uploadChatDocuments: jest.fn(),
  getLockedDocuments: jest.fn(),
  getPaidDocuments: jest.fn(),
  getDocumentStats: jest.fn(),
}))

jest.mock('../../src/controllers/folderController', () => ({
  getFolderTree: jest.fn(),
  createFolder: jest.fn(),
  updateFolder: jest.fn(),
  deleteFolder: jest.fn(),
}))

jest.mock('../../src/middleware/auth', () => ({
  protect: jest.fn((req, res, next) => next()),
  authorize: jest.fn(() => (req, res, next) => next()),
}))

jest.mock('../../src/middleware/upload', () => ({
  uploadMultipleFiles: {
    array: jest.fn(() => (req, res, next) => next()),
  },
  handleUploadError: jest.fn((req, res, next) => next()),
}))

jest.mock('../../src/middleware/subscription', () => ({
  checkMonthlyLimit: jest.fn(() => (req, res, next) => next()),
}))

function summarizeRoutes(router) {
  return router.stack
    .filter((layer) => layer.route)
    .reduce((routes, layer) => {
      const path = layer.route.path
      const methods = Object.keys(layer.route.methods)
      const existingMethods = routes.get(path) || []

      routes.set(path, Array.from(new Set([...existingMethods, ...methods])).sort())

      return routes
    }, new Map())
}

describe('documentRoutes', () => {
  it('exposes only the active workspace and document endpoints for CA-admin documents', () => {
    const router = require('../../src/routes/documentRoutes')
    const routeMap = summarizeRoutes(router)

    expect(routeMap.get('/client/:clientId/workspace')).toEqual(['get'])
    expect(routeMap.get('/client/:clientId/folders/tree')).toEqual(['get'])
    expect(routeMap.get('/client/:clientId/folders')).toEqual(['post'])
    expect(routeMap.get('/folders/:id')).toEqual(['delete', 'patch', 'put'])

    expect(routeMap.has('/client/:clientId/structure')).toBe(false)
    expect(routeMap.has('/folders/:id/stats')).toBe(false)
  })
})
