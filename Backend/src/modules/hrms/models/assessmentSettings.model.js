import mongoose from 'mongoose';

const assessmentSettingsSchema = new mongoose.Schema(
    {
        isAssessmentEnabled: {
            type: Boolean,
            default: true
        },
        questionsPerTest: {
            type: Number,
            default: 50,
            min: 1
        },
        passingPercentage: {
            type: Number,
            default: 60,
            min: 0,
            max: 100
        },
        durationMinutes: {
            type: Number,
            default: 30,
            min: 1
        },
        categoryDistribution: [{
            category: { type: String, required: true },
            count: { type: Number, required: true, min: 0 }
        }],
        difficultyDistribution: {
            Easy: { type: Number, default: 30 },
            Medium: { type: Number, default: 50 },
            Hard: { type: Number, default: 20 }
        },
        shuffleQuestions: {
            type: Boolean,
            default: true
        },
        shuffleOptions: {
            type: Boolean,
            default: true
        },
        allowRetest: {
            type: Boolean,
            default: false
        },
        maxAttempts: {
            type: Number,
            default: 1
        },
        autoSubmit: {
            type: Boolean,
            default: true
        },
        enableTimer: {
            type: Boolean,
            default: true
        },
        enableNegativeMarking: {
            type: Boolean,
            default: false // Future Ready
        },
        negativeMarkingWeight: {
            type: Number,
            default: 0.25 // Future Ready
        }
    },
    { timestamps: true }
);

export const AssessmentSettings = mongoose.model('AssessmentSettings', assessmentSettingsSchema);
