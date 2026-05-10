export const storeValidatedRequestData = (req, source, value) => {
  if (!req.validated || typeof req.validated !== 'object') {
    req.validated = Object.create(null);
  }

  req.validated[source] = value;
};

export const getValidatedRequestData = (req, source = 'body') => {
  if (!req.validated || !Object.prototype.hasOwnProperty.call(req.validated, source)) {
    throw new Error(`Validated request ${source} is unavailable`);
  }

  return req.validated[source];
};
