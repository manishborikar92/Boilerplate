export const buildPagination = (query = {}, total = 0, defaults = {}) => {
  const defaultPage = defaults.defaultPage ?? 1;
  const defaultLimit = defaults.defaultLimit ?? 20;
  const maxLimit = defaults.maxLimit ?? 100;

  const page = Math.max(1, Number.parseInt(query.page, 10) || defaultPage);
  const limit = Math.min(
    Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit),
    maxLimit,
  );
  const totalPages = Math.ceil(total / limit);

  return {
    skip: (page - 1) * limit,
    limit,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
};
