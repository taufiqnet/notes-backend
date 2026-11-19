function getPaginationParams(query) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  if (isNaN(page) || page < 1) {
    page = 1;
  }

  if (isNaN(limit) || limit < 1) {
    limit = 10;
  } else if (limit > 100) {
    limit = 100;
  }

  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

function formatPaginatedResponse(data, total, page, limit) {
  const totalPages = Math.ceil(total / limit) || (total === 0 ? 0 : 1);

  return {
    data,
    page,
    limit,
    total,
    totalPages,
  };
}

module.exports = {
  getPaginationParams,
  formatPaginatedResponse,
};
