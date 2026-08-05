require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const { QuickCategory } = require('./src/modules/quick-commerce/models/category.model.js');
    const categories = await QuickCategory.find({ 
        name: { $in: [/wedding/i, /grocery/i, /kids/i, /electronics/i] } 
    }).lean();
    console.log("=== HEADERS ===");
    console.log(JSON.stringify(categories, null, 2));
    
    // Also fetch their children to see what they have!
    const parentIds = categories.map(c => c._id);
    const children = await QuickCategory.find({ parentId: { $in: parentIds } }).lean();
    console.log("=== CHILDREN ===");
    console.log(JSON.stringify(children, null, 2));
    
    process.exit(0);
});
