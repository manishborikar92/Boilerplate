const buildMeta = (meta = {}) => ({
  timestamp: new Date().toISOString(),
  ...meta,
});

export const createSuccessResponse = ({
  message = 'Request completed successfully',
  data = null,
  meta = {},
} = {}) => ({
  success: true,
  message,
  data,
  meta: buildMeta(meta),
});

export const createErrorResponse = ({
  message = 'Request failed',
  code = 'INTERNAL_SERVER_ERROR',
  details,
  meta = {},
} = {}) => {
  const error = { code };

  if (details !== undefined) {
    error.details = details;
  }

  return {
    success: false,
    message,
    error,
    meta: buildMeta(meta),
  };
};

export const sendSuccess = (
  res,
  {
    statusCode = 200,
    message = 'Request completed successfully',
    data = null,
    meta = {},
  } = {},
) => res.status(statusCode).json(createSuccessResponse({ message, data, meta }));
