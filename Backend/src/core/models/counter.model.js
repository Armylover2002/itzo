import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
    model: { type: String, required: true, unique: true },
    seq: { type: Number, default: 0 }
});

export const Counter = mongoose.model('Counter', counterSchema, 'counters');
