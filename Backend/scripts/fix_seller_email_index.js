import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4']);

async function fixSellerIndexes() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not set');
    }
    await mongoose.connect(mongoUri, { family: 4 });
    console.log('Connected to MongoDB');

    const coll = mongoose.connection.db.collection('quick_sellers');

    // 1. Unset empty string / null emails
    const unsetEmailRes = await coll.updateMany(
      { email: { $in: ['', null] } },
      { $unset: { email: 1 } }
    );
    console.log(`Unset empty/null email in ${unsetEmailRes.modifiedCount} documents.`);

    // 2. Unset empty string / null alternate phone fields
    const unsetAltRes = await coll.updateMany(
      {
        $or: [
          { alternatePhoneDigits: { $in: ['', null] } },
          { alternatePhoneLast10: { $in: ['', null] } },
        ],
      },
      { $unset: { alternatePhoneDigits: 1, alternatePhoneLast10: 1 } }
    );
    console.log(`Unset empty/null alternatePhone in ${unsetAltRes.modifiedCount} documents.`);

    // 3. Drop existing email_1 index
    try {
      await coll.dropIndex('email_1');
      console.log('Successfully dropped old email_1 index.');
    } catch (err) {
      console.log('Old email_1 index not found or already dropped:', err.message);
    }

    // 4. Create new email_1 index with partialFilterExpression
    await coll.createIndex(
      { email: 1 },
      {
        name: 'email_1',
        unique: true,
        partialFilterExpression: { email: { $type: 'string', $gt: '' } },
      }
    );
    console.log('Created new email_1 index with partialFilterExpression.');

    // 5. Fix alternatePhoneLast10_1 index
    try {
      await coll.dropIndex('alternatePhoneLast10_1');
      console.log('Successfully dropped old alternatePhoneLast10_1 index.');
    } catch (err) {
      console.log('Old alternatePhoneLast10_1 index not found or already dropped:', err.message);
    }

    await coll.createIndex(
      { alternatePhoneLast10: 1 },
      {
        name: 'alternatePhoneLast10_1',
        unique: true,
        partialFilterExpression: { alternatePhoneLast10: { $type: 'string', $gt: '' } },
      }
    );
    console.log('Created new alternatePhoneLast10_1 index with partialFilterExpression.');

    const finalIndexes = await coll.indexes();
    console.log('Final indexes on quick_sellers:');
    console.log(JSON.stringify(finalIndexes, null, 2));

    console.log('Seller indexes and data migration completed successfully.');
  } catch (error) {
    console.error('Error fixing seller indexes:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

fixSellerIndexes();
