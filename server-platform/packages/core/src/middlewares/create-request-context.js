import { randomUUID } from 'node:crypto';

const createRequestContext = () => (req, res, next) => {
  const incomingRequestId = Array.isArray(req.headers['x-request-id'])
    ? req.headers['x-request-id'][0]
    : req.headers['x-request-id'];

  req.id = incomingRequestId?.trim() || randomUUID();
  res.setHeader('x-request-id', req.id);

  next();
};

export default createRequestContext;
