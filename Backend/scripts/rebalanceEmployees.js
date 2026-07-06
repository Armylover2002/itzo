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

const dummyNames = [
    "Aarav Sharma", "Vivaan Patel", "Aditya Singh", "Vihaan Kumar", "Arjun Gupta",
    "Sai Reddy", "Ananya Desai", "Aadhya Joshi", "Krish Nair", "Ishaan Verma",
    "Dhruv Mehta", "Riya Iyer", "Kabir Das", "Ayaan Bose", "Diya Pillai",
    "Om Bhat", "Neha Kaur", "Rudra Sengupta", "Aarohi Prasad", "Sneha Menon",
    "Karthik Raj", "Pooja Trivedi", "Rohan Malik", "Tara Saxena", "Rahul Kapoor",
    "Sanya Ahuja", "Aryan Chawla", "Kavya Pandey", "Dev Nanda", "Shruti Varma"
];

const generateUniqueEmail = (name, index) => {
    return `${name.toLowerCase().replace(/ /g, '.')}.emp${index}@itzofood.in`;
};

const rebalanceEmployees = async () => {
    console.log('\n🚀 ITZO HRMS - Rebalancing Employees to 55 Total (25 Field, 25 Office, 5 Managers)\n');
    
    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) {
            console.error('❌ MONGODB_URI not found in .env file');
            process.exit(1);
        }

        console.log('📡 Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        let allEmployees = await HrmsEmployee.find({});
        console.log(`📊 Current employee count: ${allEmployees.length}`);

        const targetCount = 55;
        const needed = targetCount - allEmployees.length;

        if (needed > 0) {
            console.log(`➕ Creating ${needed} new employees...`);
            for (let i = 0; i < needed; i++) {
                const name = dummyNames[i % dummyNames.length] + (i >= dummyNames.length ? ` ${Math.floor(i/dummyNames.length)}` : '');
                const email = generateUniqueEmail(name, Date.now() + i);

                let admin = new FoodAdmin({
                    email: email,
                    password: 'password123',
                    name: name,
                    phone: `+919000${String(i).padStart(6, '0')}`,
                    role: 'ADMIN',
                    isActive: true,
                    servicesAccess: ['food']
                });
                await admin.save();

                const seq = await getNextSequence('employeeId');
                const employeeId = `ITZO-EMP-${String(seq).padStart(4, '0')}`;

                let employee = new HrmsEmployee({
                    adminId: admin._id,
                    employeeId,
                    hrmsRole: 'Employee',
                    department: 'Operations',
                    designation: 'Staff',
                    employmentType: 'Full-Time',
                    employeeType: 'Office',
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
                allEmployees.push(employee);
            }
            console.log(`✅ Created ${needed} new employees.`);
        } else if (needed < 0) {
            console.log(`⚠️ You have ${allEmployees.length} employees, which is more than 55. The script will only rebalance the first 55 and leave the rest as-is.`);
        }

        // Re-fetch just to be safe and get all fresh from DB
        allEmployees = await HrmsEmployee.find({}).limit(Math.max(55, allEmployees.length));
        
        // Select exactly 55 for our strict rebalancing pool
        const pool = allEmployees.slice(0, 55);

        console.log(`🔄 Rebalancing roles and types for 55 employees...`);

        // First 5 become Managers
        const managers = pool.slice(0, 5);
        for (let m of managers) {
            m.hrmsRole = 'Manager';
            m.employeeType = 'Office'; // Managers are typically office, or it doesn't matter for the count of 25 since user said "25 office and 25 field and 5 managers" (Wait, 25+25+5=55)
            m.managerId = null; 
            await m.save();
        }

        // The remaining 50 become regular employees
        const nonManagers = pool.slice(5);
        
        // 25 Field, 25 Office
        const fieldEmployees = nonManagers.slice(0, 25);
        const officeEmployees = nonManagers.slice(25, 50);

        for (let f of fieldEmployees) {
            f.hrmsRole = 'Employee';
            f.employeeType = 'Field';
        }
        
        for (let o of officeEmployees) {
            o.hrmsRole = 'Employee';
            o.employeeType = 'Office';
        }

        // Assign to teams: 5 teams, each manager gets exactly 10 employees (5 field, 5 office)
        for (let i = 0; i < 5; i++) {
            const manager = managers[i];
            
            // Assign 5 field
            for (let j = 0; j < 5; j++) {
                const emp = fieldEmployees[i * 5 + j];
                emp.managerId = manager._id;
                await emp.save();
            }

            // Assign 5 office
            for (let j = 0; j < 5; j++) {
                const emp = officeEmployees[i * 5 + j];
                emp.managerId = manager._id;
                await emp.save();
            }
        }

        console.log('\n🎉 Successfully rebalanced employees!');
        console.log('Summary:');
        console.log('- Total Managers: 5');
        console.log('- Total Field Employees: 25');
        console.log('- Total Office Employees: 25');
        console.log('- Each Manager has exactly 10 employees (5 Field, 5 Office)');
        
    } catch (error) {
        console.error('\n❌ Rebalance failed:', error);
    } finally {
        await mongoose.disconnect();
    }
};

rebalanceEmployees();
