import { QuickProduct } from '../models/product.model.js';
import { FaqCategory } from '../models/faqCategory.model.js';

const categoriesSeed = [
  {
    name: 'Fruits & Vegetables',
    slug: 'fruits-vegetables',
    type: 'header',
    image: 'https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout_item/2022-09/44889.png',
    accentColor: '#66bb6a',
    sortOrder: 1,
  },
  {
    name: 'Dairy, Bread & Eggs',
    slug: 'dairy-bread-eggs',
    type: 'header',
    image: 'https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout_item/2022-09/44910.png',
    accentColor: '#f7ca4d',
    sortOrder: 2,
  },
  {
    name: 'Cold Drinks & Juices',
    slug: 'cold-drinks-juices',
    type: 'header',
    image: 'https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout_item/2023-01/44907.png',
    accentColor: '#80deea',
    sortOrder: 3,
  },
  {
    name: 'Snacks & Munchies',
    slug: 'snacks-munchies',
    type: 'header',
    image: 'https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout_item/2023-01/44908.png',
    accentColor: '#ffcc80',
    sortOrder: 4,
  },
  {
    name: 'Bakery & Biscuits',
    slug: 'bakery-biscuits',
    type: 'header',
    image: 'https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout_item/2022-09/44901.png',
    accentColor: '#bcaaa4',
    sortOrder: 5,
  },
  {
    name: 'Instant & Frozen Food',
    slug: 'instant-frozen-food',
    type: 'header',
    image: 'https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout_item/2022-09/44917.png',
    accentColor: '#a5d6a7',
    sortOrder: 6,
  },
];

const faqCategoriesSeed = [
  { name: 'Orders', color: 'sky' },
  { name: 'Payments', color: 'emerald' },
  { name: 'Returns', color: 'amber' },
  { name: 'Delivery', color: 'indigo' },
  { name: 'Account', color: 'rose' },
];

let isSeedingVerified = false;
let seedingPromise = null;
let isCleanupVerified = false;
let cleanupPromise = null;

const removeMockProducts = async () => {
  // Seed/mock products had no seller and rendered as shop name "Admin" in admin UI.
  const result = await QuickProduct.deleteMany({
    $or: [{ sellerId: null }, { sellerId: { $exists: false } }],
  });

  if (result.deletedCount > 0) {
    console.log(`Removed ${result.deletedCount} mock/seller-less quick-commerce products`);
  }
};

const ensureFaqCategoriesSeeded = async () => {
  await FaqCategory.bulkWrite(
    faqCategoriesSeed.map((category) => ({
      updateOne: {
        filter: { name: category.name },
        update: { $setOnInsert: category },
        upsert: true,
      },
    }))
  );
};

/**
 * One-time startup cleanup for legacy mock products.
 * Categories are never auto-created — admins must create them explicitly.
 */
export const ensureQuickCommerceSeedData = async () => {
  if (isCleanupVerified) return;
  if (cleanupPromise) return cleanupPromise;

  cleanupPromise = (async () => {
    try {
      await removeMockProducts();
      await ensureFaqCategoriesSeeded();

      isSeedingVerified = true;
      isCleanupVerified = true;
    } catch (err) {
      console.error('Quick Commerce startup cleanup failed:', err);
    } finally {
      cleanupPromise = null;
    }
  })();

  return cleanupPromise;
};
