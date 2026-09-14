import { invalidateCache } from '../../../middleware/cache.js';

/** Invalidate all caches affected by category create/update/delete/approval changes. */
export async function invalidateCategoryCaches() {
    await Promise.all([
        invalidateCache('categories:*'),
        invalidateCache('restaurant_menu:*'),
        invalidateCache('restaurant_menus_batch:*')
    ]);
}
