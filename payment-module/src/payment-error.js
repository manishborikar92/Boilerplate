export class PaymentModuleError extends Error {
  constructor(message, { statusCode = 502, providerCode = null, providerMessage = null } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.providerCode = providerCode;
    this.providerMessage = providerMessage;
  }
}
