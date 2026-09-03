import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const orphans = [
  'quick_delivery_commission_rules',
  'quick_experience_sections',
  'quick_faq_categories',
  'quick_faqs',
  'quick_hero_configs',
  'quick_offer_sections',
  'quick_seller_categories',
  'quick_seller_coupons',
  'quick_seller_profiles',
];

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const existing = (await db.listCollections().toArray()).map((c) => c.name);

for (const name of orphans) {
  if (!existing.includes(name)) {
    console.log(`skip (not found): ${name}`);
    continue;
  }
  const count = await db.collection(name).countDocuments();
  if (count > 0) {
    console.log(`SKIPPED (has ${count} docs, not dropping): ${name}`);
    continue;
  }
  await db.collection(name).drop();
  console.log(`dropped: ${name}`);
}

await mongoose.disconnect();
