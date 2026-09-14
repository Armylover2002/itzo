import mongoose from 'mongoose';
import { FoodUserContact } from '../models/userContact.model.js';
import { FoodUser } from '../../../../core/users/user.model.js';
import { normalizePhoneNumber } from '../utils/phone.js';
import { ValidationError } from '../../../../core/auth/errors.js';

/**
 * Syncs a batch chunk of contacts for a specific user.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {Array<{name: string, phone: string}>} contacts
 * @param {boolean} isLastChunk
 * @returns {Promise<{success: boolean, count: number}>}
 */
export async function importUserContacts(userId, contacts, isLastChunk) {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        throw new ValidationError('Invalid user ID');
    }

    if (!Array.isArray(contacts) || contacts.length === 0) {
        return { success: true, count: 0 };
    }

    // 1. Normalize numbers and filter out invalids
    const normalizedList = contacts
        .map(c => ({
            name: String(c.name || '').trim(),
            phone: String(c.phone || '').trim(),
            normalizedNumber: normalizePhoneNumber(c.phone)
        }))
        .filter(c => c.normalizedNumber !== null && c.name !== '');

    // 2. Deduplicate normalized numbers in-memory to prevent Mongo bulk write key collision errors
    const seenNumbers = new Set();
    const deduplicatedContacts = [];

    for (const c of normalizedList) {
        if (!seenNumbers.has(c.normalizedNumber)) {
            seenNumbers.add(c.normalizedNumber);
            deduplicatedContacts.push(c);
        }
    }

    if (deduplicatedContacts.length === 0) {
        // If isLastChunk is true even with empty payload, update user sync flags
        if (isLastChunk === true) {
            await FoodUser.findByIdAndUpdate(userId, {
                $set: {
                    contactPermissionStatus: 'ALLOWED',
                    isContactSynced: true
                }
            });
        }
        return { success: true, count: 0 };
    }

    // 3. Prepare bulkWrite operations (idempotent upserts)
    const operations = deduplicatedContacts.map(c => ({
        updateOne: {
            filter: { 
                userId: new mongoose.Types.ObjectId(userId), 
                normalizedNumber: c.normalizedNumber 
            },
            update: {
                $set: {
                    contactName: c.name,
                    contactNumber: c.phone
                }
            },
            upsert: true
        }
    }));

    // Execute bulkWrite
    await FoodUserContact.bulkWrite(operations, { ordered: false });

    // 4. Update user state ONLY on the last chunk
    if (isLastChunk === true) {
        await FoodUser.findByIdAndUpdate(userId, {
            $set: {
                contactPermissionStatus: 'ALLOWED',
                isContactSynced: true
            }
        });
    }

    return { success: true, count: deduplicatedContacts.length };
}

/**
 * Updates the contact permission status for a user.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {'DENIED'|'SKIPPED'} status
 * @returns {Promise<{success: boolean}>}
 */
export async function updatePermissionStatus(userId, status) {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        throw new ValidationError('Invalid user ID');
    }

    if (!['DENIED', 'SKIPPED'].includes(status)) {
        throw new ValidationError('Invalid status parameter');
    }

    await FoodUser.findByIdAndUpdate(userId, {
        $set: { contactPermissionStatus: status }
    });

    return { success: true };
}

/**
 * Retrieves paginated contacts of a user for admin inspection.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {{page: number, limit: number}} pagination
 * @returns {Promise<{contacts: Array, total: number, page: number, limit: number}>}
 */
export async function getCustomerContactsForAdmin(userId, pagination = {}) {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        throw new ValidationError('Invalid customer ID');
    }

    const limit = Math.min(Math.max(parseInt(pagination.limit, 10) || 50, 1), 500);
    const page = Math.max(parseInt(pagination.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const query = { userId: new mongoose.Types.ObjectId(userId) };

    const [contacts, total] = await Promise.all([
        FoodUserContact.find(query)
            .sort({ contactName: 1 })
            .skip(skip)
            .limit(limit)
            .select('contactName contactNumber createdAt')
            .lean(),
        FoodUserContact.countDocuments(query)
    ]);

    return { contacts, total, page, limit };
}
