const PAGE_SIZE = 100;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export const slugifyCategory = (value = '') =>
  String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

export const extractCategoryApiError = (error, fallback = 'Something went wrong') =>
  error?.response?.data?.message || error?.message || fallback;

export const validateCategoryImage = (file) => {
  if (!file) return null;
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'Only JPEG, PNG, WebP, and GIF images are allowed';
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return 'Image must be smaller than 5MB';
  }
  return null;
};

export const buildCategoryFormData = (formData, type, imageFile) => {
  const data = new FormData();
  data.append('type', type);

  Object.entries(formData).forEach(([key, value]) => {
    if (key === 'type') return;
    if (key === 'parentId') {
      if (type === 'header' || value === null || value === undefined || value === '' || value === 'null') {
        return;
      }
    }
    if (value === null || value === undefined) return;
    if (typeof value === 'boolean') {
      data.append(key, value ? 'true' : 'false');
      return;
    }
    data.append(key, value);
  });

  if (imageFile) {
    data.append('image', imageFile);
  }

  return data;
};

export const fetchAllCategoriesByType = async (adminApi, type) => {
  const firstRes = await adminApi.getCategories({ type, page: 1, limit: PAGE_SIZE });
  const firstPayload = firstRes.data?.result || {};
  const firstItems = Array.isArray(firstPayload.items)
    ? firstPayload.items
    : firstRes.data?.results || [];
  const total = Number(firstPayload.total || firstItems.length || 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (totalPages === 1) {
    return firstItems;
  }

  const remainingResponses = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      adminApi.getCategories({ type, page: index + 2, limit: PAGE_SIZE }),
    ),
  );

  return [
    ...firstItems,
    ...remainingResponses.flatMap((response) => {
      const payload = response.data?.result || {};
      return Array.isArray(payload.items) ? payload.items : response.data?.results || [];
    }),
  ];
};

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * Turning a category off or on carries its sub-levels and their products with it, so the
 * toast reports how far the change reached instead of leaving the admin guessing.
 */
export const describeCategoryCascade = (cascade, fallback) => {
  if (!cascade) return fallback;

  const deactivated =
    Number(cascade.categoriesDeactivated || 0) + Number(cascade.productsDeactivated || 0);
  if (deactivated > 0) {
    return `${fallback}. Also deactivated ${plural(Number(cascade.categoriesDeactivated || 0), 'sub-category')} and ${plural(Number(cascade.productsDeactivated || 0), 'product')}.`;
  }

  const reactivated =
    Number(cascade.categoriesReactivated || 0) + Number(cascade.productsReactivated || 0);
  if (reactivated > 0) {
    return `${fallback}. Also reactivated ${plural(Number(cascade.categoriesReactivated || 0), 'sub-category')} and ${plural(Number(cascade.productsReactivated || 0), 'product')}.`;
  }

  return fallback;
};

/**
 * Delete removes the category tree but only switches its products off so they can be
 * reassigned later — the toast has to say that clearly.
 */
export const describeCategoryDelete = (result, label = 'Category') => {
  const removedChildren = Math.max(0, Number(result?.categoriesDeleted || 1) - 1);
  const deactivated = Number(result?.productsDeactivated || 0);
  const childPart =
    removedChildren > 0
      ? ` and ${plural(removedChildren, 'sub-category')}`
      : '';
  const productPart =
    deactivated > 0
      ? ` Linked products (${deactivated}) were set to inactive — they stay in the database and can be moved to another category later.`
      : ' Linked products stay in the database as inactive if any were attached.';
  return `${label} deleted${childPart}.${productPart}`;
};

export const bulkDeleteCategories = async (adminApi, ids = []) => {
  const results = await Promise.allSettled(ids.map((id) => adminApi.deleteCategory(id)));
  const failed = results.filter((result) => result.status === 'rejected');
  return {
    deleted: results.length - failed.length,
    failed: failed.length,
    firstError: failed[0]?.reason,
  };
};

const categoryKey = (item) => String(item?._id || item?.id || '');

/** Prefer the create/update response over a full list refetch. */
export const upsertCategoryInList = (list = [], item) => {
  if (!item) return list;
  const id = categoryKey(item);
  if (!id) return list;
  const index = list.findIndex((row) => categoryKey(row) === id);
  if (index === -1) return [item, ...list];
  const next = [...list];
  next[index] = { ...list[index], ...item };
  return next;
};

export const removeCategoriesFromList = (list = [], ids = []) => {
  const remove = new Set((ids || []).map((id) => String(id)));
  if (!remove.size) return list;
  return list.filter((row) => !remove.has(categoryKey(row)));
};
