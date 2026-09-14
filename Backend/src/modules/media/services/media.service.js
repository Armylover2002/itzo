import { SharedMedia } from '../models/sharedMedia.model.js';
import mongoose from 'mongoose';

// Stop words to clean from food type name normalizations
const STOP_WORDS = new Set([
    'veg', 'veg.', 'nonveg', 'non-veg', 'non', 'with', 'extra', 'and', 'cheese', 'cheesy', 
    'hot', 'special', 'fresh', 'delicious', 'taste', 'spicy', 'sweet', 'double', 'single',
    'classic', 'premium', 'supreme', 'house', 'signature', 'chef', 'chefs', 'style'
]);

export function normalizeFoodName(name) {
    if (!name || typeof name !== 'string') return '';
    const clean = name.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '');
    const words = clean.split(/[\s-]+/).filter(Boolean);
    const filtered = words.filter(word => !STOP_WORDS.has(word));
    const resultWords = filtered.length > 0 ? filtered : words;
    // Core type is generally the last noun in the phrase (e.g. "Pizza", "Burger")
    return resultWords[resultWords.length - 1] || '';
}

export function generateKeywords(name) {
    const keywords = new Set();
    if (!name || typeof name !== 'string') return [];
    const clean = name.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '');
    if (clean) {
        keywords.add(clean); // e.g. "tandoori pizza"
        const core = normalizeFoodName(name);
        if (core) {
            keywords.add(core); // e.g. "pizza"
        }
    }
    return Array.from(keywords);
}

export function extractTags(name, category) {
    const tags = new Set();
    const addCleanWords = (str) => {
        if (!str || typeof str !== 'string') return;
        str.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').split(/[\s-]+/).forEach(w => {
            if (w.length > 2) tags.add(w);
        });
    };
    addCleanWords(name);
    addCleanWords(category);
    return Array.from(tags);
}

export async function saveToSharedMedia({ url, name, category, restaurantId }) {
    if (!url) return null;

    const normalizedName = normalizeFoodName(name);
    const rId = restaurantId && mongoose.Types.ObjectId.isValid(restaurantId) 
        ? new mongoose.Types.ObjectId(String(restaurantId)) 
        : null;

    // 1. Duplicate Protection: Skip if restaurant already saved this image for this food type
    const existing = await SharedMedia.findOne({
        restaurantId: rId,
        normalizedName,
        url: String(url).trim()
    });

    if (existing) {
        existing.reuseCount = (existing.reuseCount || 1) + 1;
        await existing.save().catch(err => console.error("Error updating reuseCount:", err));
        return existing;
    }

    // 2. Per-Food Image Limit: Max 5 recent images per restaurant per normalized food type
    const filter = { restaurantId: rId, normalizedName };
    const count = await SharedMedia.countDocuments(filter);
    if (count >= 5) {
        // Find oldest record and delete it to preserve sliding window of 5 recent templates
        const oldest = await SharedMedia.findOne(filter).sort({ createdAt: 1 });
        if (oldest) {
            await SharedMedia.deleteOne({ _id: oldest._id });
        }
    }

    // Insert new template metadata
    const keywords = generateKeywords(name);
    const tags = extractTags(name, category);

    return await SharedMedia.create({
        url: String(url).trim(),
        normalizedName,
        keywords,
        tags,
        category: String(category || '').trim(),
        restaurantId: rId,
        isGlobal: false
    });
}

export async function getSharedMedia(restaurantId, query = {}) {
    const searchTerm = String(query.query || query.search || '').trim().toLowerCase();
    const categoryFilter = String(query.category || '').trim();
    
    // Automatically fetch ONLY matching images. If no search term is entered and no category, return empty array.
    if (!searchTerm && !categoryFilter) {
        return {
            items: [],
            pagination: {
                page: 1,
                limit: 6,
                total: 0,
                pages: 0
            }
        };
    }

    const filter = {};

    if (categoryFilter) {
        filter.category = categoryFilter;
    }

    if (searchTerm) {
        const queryTermNormalized = normalizeFoodName(searchTerm);
        const searchReg = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

        const searchFilter = {
            $or: [
                { keywords: searchTerm }, // Priority 1: Keyword exact match
                { normalizedName: queryTermNormalized }, // Priority 2: Core food type exact match
                { category: new RegExp('^' + searchTerm + '$', 'i') }, // Priority 3: Category match
                { tags: { $in: [queryTermNormalized, searchTerm] } }, // Priority 4: Tags matches
                { tags: { $regex: searchReg } } // Fallback regex matching
            ]
        };

        if (categoryFilter) {
            filter.$and = [
                { category: categoryFilter },
                searchFilter
            ];
            delete filter.category;
        } else {
            filter.$or = searchFilter.$or;
        }
    }

    const items = await SharedMedia.find(filter).lean();

    // Sort in-memory to strictly satisfy prioritization weights
    items.sort((a, b) => {
        if (searchTerm) {
            const queryTermNormalized = normalizeFoodName(searchTerm);

            // Priority 1: Keyword exact match (weight 4)
            const aKeyMatch = Array.isArray(a.keywords) && a.keywords.includes(searchTerm) ? 1 : 0;
            const bKeyMatch = Array.isArray(b.keywords) && b.keywords.includes(searchTerm) ? 1 : 0;
            if (aKeyMatch !== bKeyMatch) return bKeyMatch - aKeyMatch;

            // Priority 2: Core food type exact match (weight 3)
            const aNameMatch = a.normalizedName === queryTermNormalized ? 1 : 0;
            const bNameMatch = b.normalizedName === queryTermNormalized ? 1 : 0;
            if (aNameMatch !== bNameMatch) return bNameMatch - aNameMatch;

            // Priority 3: Category match (weight 2)
            const aCatMatch = String(a.category).toLowerCase() === searchTerm ? 1 : 0;
            const bCatMatch = String(b.category).toLowerCase() === searchTerm ? 1 : 0;
            if (aCatMatch !== bCatMatch) return bCatMatch - aCatMatch;
        }

        // Priority 4: Frequently reused (if available)
        const aReuse = a.reuseCount || 1;
        const bReuse = b.reuseCount || 1;
        if (aReuse !== bReuse) return bReuse - aReuse;

        // Fallback: Latest first (createdAt)
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
    });

    const limit = Math.min(20, Math.max(1, parseInt(query.limit, 10) || 6)); // default limit 6
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const skip = (page - 1) * limit;
    const paginatedItems = items.slice(skip, skip + limit);
    const total = items.length;

    // Cloudinary dynamic low-res thumbnail transformations
    const results = paginatedItems.map(item => {
        let thumb = null;
        if (item.url && item.url.includes('/image/upload/')) {
            thumb = item.url.replace('/image/upload/', '/image/upload/c_thumb,w_150,h_150,q_auto,f_auto/');
        }
        return {
            ...item,
            thumbnailUrl: thumb || item.url
        };
    });

    return {
        items: results,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    };
}
