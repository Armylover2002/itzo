export const PAGINATION_DEFAULTS = {
    defaultPage: 1,
    defaultLimit: 30,
    /**
     * Central maximum pagination limit.
     * Endpoints that truly need larger limits should pass an override.
     */
    maxLimit: 1000,
};

export const buildPaginationOptions = (
    query = {},
    { defaultLimit = PAGINATION_DEFAULTS.defaultLimit, maxLimit = PAGINATION_DEFAULTS.maxLimit } = {}
) => {
    const page = Math.max(parseInt(query.page, 10) || PAGINATION_DEFAULTS.defaultPage, PAGINATION_DEFAULTS.defaultPage);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), maxLimit);
    const skip = (page - 1) * limit;

    return { page, limit, skip };
};

export const buildPaginationMeta = ({ totalItems, page, limit }) => {
    const totalPages = Math.ceil(totalItems / limit) || 1;

    return {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
    };
};

export const buildPaginatedResult = ({ docs, total, page, limit }) => {
    const pagination = buildPaginationMeta({ totalItems: total, page, limit });

    // Backward compatible response:
    // - existing: { data: [...], meta: { total, page, limit, totalPages } }
    // - new:      ... + pagination: { page, limit, totalItems, totalPages, hasNextPage, hasPreviousPage }
    return {
        data: docs,
        meta: {
            total,
            page,
            limit,
            totalPages: pagination.totalPages,
        },
        pagination,
    };
};

