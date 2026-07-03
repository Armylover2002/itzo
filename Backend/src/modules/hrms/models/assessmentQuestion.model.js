import mongoose from 'mongoose';

const assessmentQuestionSchema = new mongoose.Schema(
    {
        questionText: {
            type: String,
            required: true,
            trim: true
        },
        options: [{
            type: String,
            required: true,
            trim: true
        }],
        correctOptionIndex: {
            type: Number,
            required: true,
            min: 0,
            max: 3
        },
        category: {
            type: String,
            required: true,
            trim: true,
            index: true
        },
        difficulty: {
            type: String,
            enum: ['Easy', 'Medium', 'Hard'],
            default: 'Medium',
            index: true
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodAdmin'
        }
    },
    { timestamps: true }
);

export const AssessmentQuestion = mongoose.model('AssessmentQuestion', assessmentQuestionSchema);
