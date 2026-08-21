import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { HrmsEmployee } from '../models/employee.model.js';

const seedTeam = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const db = mongoose.connection.db;
        
        const amanAdmin = await db.collection('common_admins').findOne({ email: 'amanpateldev@gmail.com' });
        const amanEmp = await HrmsEmployee.findOne({ adminId: amanAdmin._id });

        // Find existing team
        let team = await HrmsEmployee.find({ managerId: amanEmp._id, status: 'Active' });
        
        // We want 11 total employees in Aman's team
        let needed = 11 - team.length;
        
        if (needed > 0) {
            const otherEmps = await HrmsEmployee.find({ 
                status: 'Active', 
                _id: { $ne: amanEmp._id },
                hrmsRole: { $ne: 'Manager' },
                managerId: null
            }).limit(needed);
            
            for (const emp of otherEmps) {
                emp.managerId = amanEmp._id;
                await emp.save();
                console.log(`Assigned employee ${emp.employeeId || emp._id} to Aman's team`);
            }
        }

        console.log(`Aman Patel now has a team of 11 employees (or max available).`);
        process.exit(0);
    } catch (error) {
        console.error('Error seeding team data:', error);
        process.exit(1);
    }
};

seedTeam();
