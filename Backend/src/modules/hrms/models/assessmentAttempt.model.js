import mongoose from 'mongoose';

const attemptQuestionSchema = new mongoose.Schema({
    questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AssessmentQuestion',
        required: true
    },
    // We snapshot the question text, options, and correct index so future edits 
    // to the question bank do not corrupt completed/ongoing tests.
    snapshot: {
        questionText: { type: String, required: true },
        options: [{ type: String }],
        correctOptionIndex: { type: Number, required: true },
        category: { type: String },
        difficulty: { type: String }
    },
    // [2, 0, 1, 3] -> Index 0 in UI is Option 2 from DB.
    optionsOrder: [{ type: Number }],
    // The index of the option the user selected (relative to optionsOrder)
    selectedOptionIndex: { type: Number, default: null },
    // Time spent on this question in seconds
    timeSpentSeconds: { type: Number, default: 0 }
}, { _id: false });

const assessmentAttemptSchema = new mongoose.Schema(
    {
        // Link to the user taking the test (before joining request is created)
        applicantEmail: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            index: true
        },
        applicantPhone: {
            type: String,
            required: true,
            trim: true,
            index: true
        },
        applicantName: {
            type: String,
            required: true,
            trim: true
        },
        // To strictly prevent multiple attempts
        sessionToken: {
            type: String,
            unique: true,
            sparse: true
        },
        status: {
            type: String,
            enum: ['In_Progress', 'Completed', 'Timeout', 'Abandoned', 'Reset'],
            default: 'In_Progress',
            index: true
        },
        questions: [attemptQuestionSchema],
        
        // Scoring
        score: { type: Number, default: 0 },
        percentage: { type: Number, default: 0 },
        correctCount: { type: Number, default: 0 },
        wrongCount: { type: Number, default: 0 },
        skippedCount: { type: Number, default: 0 },
        isPassed: { type: Boolean, default: false },

        // Timing
        startTime: { type: Date, required: true },
        endTime: { type: Date },
        durationSeconds: { type: Number, default: 0 },

        // Retake Request (applicant requests admin to allow retake after failing)
        retakeRequested: { type: Boolean, default: false },
        retakeRequestedAt: { type: Date, default: null },
        retakeReason: { type: String, trim: true, default: '' }
    },
    { timestamps: true }
);

// Ensure an applicant can't have multiple In_Progress or Completed attempts simultaneously unless reset
assessmentAttemptSchema.index({ applicantEmail: 1, applicantPhone: 1, status: 1 });

export const AssessmentAttempt = mongoose.model('AssessmentAttempt', assessmentAttemptSchema);
