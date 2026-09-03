import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!uri) {
  console.error('MONGO_URI is not set in environment.');
  process.exit(1);
}

const seedCategorySlugs = [
  // from seed.service.js
  'fruits-vegetables', 'dairy-bread-eggs', 'cold-drinks-juices', 'snacks-munchies', 'bakery-biscuits', 'instant-frozen-food',
  // from DEFAULT_CATEGORY_TREE in sellerCatalog.service.js
  'catalog', 'groceries', 'staples', 'dairy-breakfast', 'snacks', 'fresh', 'fruits', 'vegetables', 'herbs',
  'beverages', 'soft-drinks', 'tea-coffee', 'juices', 'home-essentials', 'cleaning', 'laundry', 'kitchen-care',
  'personal-care', 'skin-care', 'hair-care', 'daily-hygiene'
];

const seedProductSlugs = [
  'fresh-bananas-robusta', 'farm-fresh-tomato', 'amul-taaza-toned-milk',
  'country-delight-paneer', 'coca-cola-soft-drink', 'tropicana-mixed-fruit-juice',
  'lays-classic-salted-chips', 'haldirams-aloo-bhujia', 'britannia-good-day-cashew',
  'harvest-gold-white-bread', 'mccain-french-fries', 'itc-yippee-noodles'
];

async function runCleanup() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  console.log('=== QUICK COMMERCE SEED & DUMMY DATA CLEANUP ===\n');

  // 1. Clean up dummy sellers auto-created by static code
  const dummySellerFilter = {
    $or: [
      { name: { $regex: /^Seller\s+\d+$/i } },
      { shopName: { $regex: /^Store\s+\d+$/i } },
      { email: { $regex: /@seller\.local$/i } },
    ],
  };

  const dummySellers = await db.collection('quick_sellers').find(dummySellerFilter).toArray();
  console.log(`Found ${dummySellers.length} auto-generated dummy sellers to delete:`);
  dummySellers.forEach((s) => {
    console.log(`  - [ID: ${s._id}] "${s.name}" | Shop: "${s.shopName}" | Phone: "${s.phone}" | Email: "${s.email}"`);
  });

  if (dummySellers.length > 0) {
    const sellerIds = dummySellers.map((s) => s._id);
    const sellerDelRes = await db.collection('quick_sellers').deleteMany({ _id: { $in: sellerIds } });
    console.log(`✅ Deleted ${sellerDelRes.deletedCount} dummy sellers from quick_sellers.\n`);
  } else {
    console.log(`ℹ️ No dummy sellers found.\n`);
  }

  // 2. Clean up seeded products from productSeeds (if any exist)
  const seededProducts = await db.collection('quick_products').find({ slug: { $in: seedProductSlugs } }).toArray();
  console.log(`Found ${seededProducts.length} seeded products to delete:`);
  seededProducts.forEach((p) => {
    console.log(`  - [ID: ${p._id}] "${p.name}" (${p.slug})`);
  });

  if (seededProducts.length > 0) {
    const prodIds = seededProducts.map((p) => p._id);
    const prodDelRes = await db.collection('quick_products').deleteMany({ _id: { $in: prodIds } });
    console.log(`✅ Deleted ${prodDelRes.deletedCount} seeded products from quick_products.\n`);
  } else {
    console.log(`ℹ️ No seeded products from productSeeds found in quick_products.\n`);
  }

  // 3. Clean up seeded categories that have 0 products attached
  const seededCategories = await db.collection('quick_categories').find({ slug: { $in: seedCategorySlugs } }).toArray();
  console.log(`Found ${seededCategories.length} categories matching seeder slugs:`);
  
  const catsToDelete = [];
  for (const cat of seededCategories) {
    const productCount = await db.collection('quick_products').countDocuments({
      $or: [
        { categoryId: cat._id },
        { category: cat._id },
        { subcategoryId: cat._id },
        { subcategory: cat._id },
        { headerId: cat._id },
      ],
    });
    console.log(`  - [ID: ${cat._id}] "${cat.name}" (${cat.slug}) -> Products linked: ${productCount}`);
    if (productCount === 0) {
      catsToDelete.push(cat._id);
    }
  }

  if (catsToDelete.length > 0) {
    const catDelRes = await db.collection('quick_categories').deleteMany({ _id: { $in: catsToDelete } });
    console.log(`✅ Deleted ${catDelRes.deletedCount} unlinked seeded categories from quick_categories.\n`);
  } else {
    console.log(`ℹ️ No unlinked seeded categories to delete.\n`);
  }

  // 4. Remaining summary
  const remainingSellers = await db.collection('quick_sellers').countDocuments({});
  const remainingCats = await db.collection('quick_categories').countDocuments({});
  const remainingProds = await db.collection('quick_products').countDocuments({});
  console.log('=== DATABASE STATUS AFTER CLEANUP ===');
  console.log(`  quick_sellers:    ${remainingSellers} real sellers remaining`);
  console.log(`  quick_categories: ${remainingCats} categories remaining`);
  console.log(`  quick_products:   ${remainingProds} products remaining`);

  await mongoose.disconnect();
  console.log('\nCleanup finished successfully.');
}

runCleanup().catch((err) => {
  console.error('Cleanup error:', err);
  process.exit(1);
});
