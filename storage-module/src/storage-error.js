export class StorageModuleError extends Error {
  constructor(message, { statusCode = 500, providerCode = null } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.providerCode = providerCode;
  }
}
