import { connectDB, disconnectDB } from '../src/config/db.js';
import { FoodAdmin } from '../src/core/admin/admin.model.js';

const [emailArg, passwordArg, nameArg] = process.argv.slice(2);

const email = (emailArg || 'admin@gmail.com').trim().toLowerCase();
const password = passwordArg || 'admin123';
const name = nameArg || 'Admin';

if (!email || !password) {
  console.error('Usage: node scripts/create-admin.js [email] [password] [name]');
  process.exit(1);
}

const run = async () => {
  await connectDB();

  try {
    let admin = await FoodAdmin.findOne({ email });

    if (admin) {
      admin.password = password;
      admin.name = name;
      admin.role = 'ADMIN';
      admin.isActive = true;
      admin.servicesAccess = ['food', 'quickCommerce'];
      await admin.save();
      console.log(`Admin updated: ${email}`);
    } else {
      admin = new FoodAdmin({
        email,
        password,
        name,
        role: 'ADMIN',
        isActive: true,
        servicesAccess: ['food', 'quickCommerce'],
      });
      await admin.save();
      console.log(`Admin created: ${email}`);
    }

    console.log(`Login with email: ${email}`);
    console.log(`Role: ${admin.role}`);
    console.log(`ID: ${admin._id.toString()}`);
  } catch (error) {
    console.error(`Failed to create admin: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
};

run();
