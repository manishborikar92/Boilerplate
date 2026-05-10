import crypto from 'node:crypto';

export const requestId = (req, res, next) => {
  const incoming = req.get('x-request-id');
  req.id = incoming || crypto.randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
};
