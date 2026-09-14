import mongoose from 'mongoose';

export const actionPerformerSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, default: null },
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    role: { type: String, default: '' },
    roleName: { type: String, default: '' },
    actionAt: { type: Date, default: Date.now }
}, { _id: false });
