import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { FoodAdmin } from '../src/core/admin/admin.model.js';
import { HrmsEmployee } from '../src/modules/hrms/models/employee.model.js';
import { getNextSequence } from '../src/modules/hrms/models/counter.model.js';

const dummyData = [
    {
        name: 'Rajesh Kumar',
        email: 'rajesh.kumar.field@itzofood.in',
        phone: '+919876543211',
        department: 'Operations',
        designation: 'Field Executive'
    },
    {
        name: 'Amit Singh',
        email: 'amit.singh.field@itzofood.in',
        phone: '+919876543212',
        department: 'Delivery',
        designation: 'Delivery Manager'
    },
    {
        name: 'Suresh Sharma',
        email: 'suresh.sharma.field@itzofood.in',
        phone: '+919876543213',
        department: 'Sales',
        designation: 'Sales Representative'
    },
    {
        name: 'Rahul Verma',
        email: 'rahul.verma.field@itzofood.in',
        phone: '+919876543214',
        department: 'Operations',
        designation: 'Field Agent'
    },
    {
        name: 'Vikram Patel',
        email: 'vikram.patel.field@itzofood.in',
        phone: '+919876543215',
        department: 'Field Sales',
        designation: 'Area Manager'
    }
];

const seedFieldEmployees = async () => {
    console.log('\n🚀 ITZO HRMS - Seeding Dummy Field Employees\n');
    
    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) {
            console.error('❌ MONGODB_URI not found in .env file');
            process.exit(1);
        }

        console.log('📡 Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        for (const data of dummyData) {
            // Check if exists
            let admin = await FoodAdmin.findOne({ email: data.email });
            if (!admin) {
                admin = new FoodAdmin({
                    email: data.email,
                    password: 'password123',
                    name: data.name,
                    phone: data.phone,
                    role: 'ADMIN',
                    isActive: true,
                    servicesAccess: ['food']
                });
                await admin.save();
                console.log(`✅ Created Admin: ${data.name}`);
            } else {
                console.log(`⚠️ Admin already exists: ${data.name}`);
            }

            let employee = await HrmsEmployee.findOne({ adminId: admin._id });
            if (!employee) {
                const seq = await getNextSequence('employeeId');
                const employeeId = `ITZO-EMP-${String(seq).padStart(4, '0')}`;

                employee = new HrmsEmployee({
                    adminId: admin._id,
                    employeeId,
                    hrmsRole: 'Employee',
                    department: data.department,
                    designation: data.designation,
                    employmentType: 'Full-Time',
                    employeeType: 'Field',
                    joiningDate: new Date(),
                    shift: 'General',
                    ctc: 360000,
                    status: 'Active',
                    address: {
                        street: '123 Main St',
                        city: 'Bengaluru',
                        state: 'Karnataka',
                        pincode: '560001',
                        country: 'India'
                    }
                });
                await employee.save();
                console.log(`✅ Created Field Employee: ${data.name} (${employeeId})`);
            } else {
                console.log(`⚠️ Employee already exists: ${data.name} (${employee.employeeId})`);
            }
        }
        console.log('\n🎉 Successfully onboarded dummy Indian field employees!\n');
    } catch (error) {
        console.error('\n❌ Seed failed:', error);
    } finally {
        await mongoose.disconnect();
    }
};

seedFieldEmployees();
