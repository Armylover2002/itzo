import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Clock, CheckCircle2, Circle, AlertCircle, ChevronLeft, ChevronRight, Save, Send, RotateCcw, Loader2 as Loader2Icon } from 'lucide-react';
import axiosInstance from '@core/api/axios';
import { toast } from 'sonner';

export default function AssessmentRunner({ applicantInfo, onComplete, onBack }) {
    const [loading, setLoading] = useState(true);
    const [assessmentData, setAssessmentData] = useState(null);
    const [sessionToken, setSessionToken] = useState(localStorage.getItem('hrms_assessment_token') || null);
    
    // Test State
    const [questions, setQuestions] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [timeLeft, setTimeLeft] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState(null);

    // Retake Request State
    const [retakeReason, setRetakeReason] = useState('');
    const [retakeRequesting, setRetakeRequesting] = useState(false);
    const [retakeAlreadySent, setRetakeAlreadySent] = useState(false);
    
    // Refs for timer and auto-save
    const timerRef = useRef(null);
    const autoSaveIntervalRef = useRef(null);

    // Initialize or Resume
    useEffect(() => {
        const initAssessment = async () => {
            try {
                const payload = {
                    applicantEmail: applicantInfo.email,
                    applicantPhone: applicantInfo.phone,
                    applicantName: applicantInfo.fullName,
                    sessionToken
                };
                
                const res = await axiosInstance.post('/hrms/assessments/start', payload);
                const data = res.data?.data || res.data;
                
                // If it was already completed (maybe they refreshed after finishing)
                if (data.status === 'Completed' || data.status === 'Timeout') {
                    setResult(data);
                    // Check if retake was already requested
                    if (data.retakeRequested) setRetakeAlreadySent(true);
                    if (data.isPassed) onComplete(data);
                    setLoading(false);
                    return;
                }

                setSessionToken(data.sessionToken);
                localStorage.setItem('hrms_assessment_token', data.sessionToken);
                
                setAssessmentData(data);
                setQuestions(data.questions || []);
                
                // Calculate remaining time
                const startTime = new Date(data.startTime);
                const now = new Date();
                const elapsedSeconds = Math.floor((now - startTime) / 1000);
                const totalSeconds = (data.durationMinutes * 60);
                const remaining = Math.max(0, totalSeconds - elapsedSeconds);
                setTimeLeft(remaining);

                if (remaining === 0) {
                    handleSubmitTest(data.sessionToken, data.questions);
                }

            } catch (error) {
                toast.error(error.response?.data?.message || 'Failed to load assessment. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        initAssessment();
        
        return () => {
            clearInterval(timerRef.current);
            clearInterval(autoSaveIntervalRef.current);
        };
    }, []);

    // Timer Logic
    useEffect(() => {
        if (timeLeft !== null && timeLeft > 0 && !result) {
            timerRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        clearInterval(timerRef.current);
                        handleSubmitTest(sessionToken, questions); // Auto submit on timeout
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timerRef.current);
    }, [timeLeft, result, sessionToken, questions]);

    // Auto-save Logic
    useEffect(() => {
        if (sessionToken && !result) {
            autoSaveIntervalRef.current = setInterval(() => {
                syncProgress(sessionToken, questions);
            }, 30000); // Auto save every 30 seconds
        }
        return () => clearInterval(autoSaveIntervalRef.current);
    }, [sessionToken, questions, result]);

    const syncProgress = async (token, currentQuestions) => {
        try {
            // Only send answers that have a selectedOptionIndex to save payload size
            const answers = currentQuestions
                .filter(q => q.selectedOptionIndex !== null)
                .map(q => ({
                    questionId: q.questionId,
                    selectedOptionIndex: q.selectedOptionIndex,
                    timeSpentSeconds: q.timeSpentSeconds
                }));
            
            if (answers.length > 0) {
                await axiosInstance.post('/hrms/assessments/sync', { sessionToken: token, answers });
            }
        } catch (error) {
            console.error('Auto-save failed:', error);
        }
    };

    const handleOptionSelect = (index) => {
        setQuestions(prev => {
            const updated = [...prev];
            updated[currentIndex] = { ...updated[currentIndex], selectedOptionIndex: index };
            return updated;
        });
    };

    const handleSubmitTest = async (token = sessionToken, currentQuestions = questions) => {
        setIsSubmitting(true);
        try {
            const answers = currentQuestions.map(q => ({
                questionId: q.questionId,
                selectedOptionIndex: q.selectedOptionIndex
            }));

            const res = await axiosInstance.post('/hrms/assessments/submit', { sessionToken: token, answers });
            const finalResult = res.data?.data || res.data;
            setResult(finalResult);
            
            if (finalResult.isPassed) {
                toast.success('Congratulations! You passed the assessment.');
                // Trigger the callback to allow joining request submission
                onComplete(finalResult);
            } else {
                toast.error('You did not pass the assessment. Please contact HR.');
            }
            
            // Clean up
            clearInterval(timerRef.current);
            clearInterval(autoSaveIntervalRef.current);
            localStorage.removeItem('hrms_assessment_token');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to submit assessment.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRequestRetake = async () => {
        if (retakeRequesting || retakeAlreadySent) return;
        setRetakeRequesting(true);
        try {
            await axiosInstance.post('/hrms/assessments/request-retake', {
                attemptId: result.attemptId,
                applicantEmail: applicantInfo.email,
                applicantPhone: applicantInfo.phone,
                reason: retakeReason.trim()
            });
            setRetakeAlreadySent(true);
            toast.success('Retake request sent! Please wait for admin approval.');
        } catch (error) {
            const msg = error.response?.data?.message || 'Failed to send retake request.';
            if (error.response?.status === 409) {
                setRetakeAlreadySent(true); // Already sent
            }
            toast.error(msg);
        } finally {
            setRetakeRequesting(false);
        }
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mb-4"></div>
                <p className="text-slate-500 font-medium">Initializing Assessment...</p>
            </div>
        );
    }

    if (result) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-lg">
                <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6 ${result.isPassed ? 'bg-emerald-100' : 'bg-red-100'}`}>
                    {result.isPassed ? (
                        <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                    ) : (
                        <AlertCircle className="w-10 h-10 text-red-600" />
                    )}
                </div>
                
                <h3 className="text-2xl font-bold text-slate-900 mb-2">
                    {result.isPassed ? 'Assessment Passed!' : 'Assessment Failed'}
                </h3>
                
                <p className="text-slate-500 mb-8">
                    {result.isPassed 
                        ? 'Great job! Your score meets our requirements. You can now submit your joining request.'
                        : 'Unfortunately, your score did not meet the required threshold.'}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <p className="text-sm text-slate-500 mb-1">Score</p>
                        <p className="text-2xl font-bold text-slate-900">{result.score}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <p className="text-sm text-slate-500 mb-1">Percentage</p>
                        <p className="text-2xl font-bold text-slate-900">{result.percentage?.toFixed(1)}%</p>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                        <p className="text-sm text-emerald-600 mb-1">Correct</p>
                        <p className="text-2xl font-bold text-emerald-700">{result.correctCount}</p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                        <p className="text-sm text-red-600 mb-1">Wrong</p>
                        <p className="text-2xl font-bold text-red-700">{result.wrongCount}</p>
                    </div>
                </div>

                {result.isPassed && (
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        {onBack && (
                            <button 
                                onClick={onBack}
                                className="w-full sm:w-auto px-8 py-3 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                Back to Edit Info
                            </button>
                        )}
                        <button 
                            onClick={() => onComplete(result)}
                            className="w-full sm:w-auto px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl transition-colors shadow-lg shadow-orange-500/30"
                        >
                            Proceed to Submit Application
                        </button>
                    </div>
                )}

                {/* Retake Request Section (only for failed attempts) */}
                {!result.isPassed && (
                    <div className="mt-8 pt-6 border-t border-slate-100">
                        {retakeAlreadySent ? (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                                <div className="flex items-center justify-center gap-2 mb-2">
                                    <CheckCircle2 className="w-5 h-5 text-blue-600" />
                                    <p className="text-sm font-semibold text-blue-700">Retake Request Already Sent</p>
                                </div>
                                <p className="text-xs text-blue-500">
                                    Your request has been submitted. An admin will review and reset your attempt so you can retake the test. Please check back later.
                                </p>
                            </div>
                        ) : (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                                <h4 className="text-sm font-semibold text-amber-800 mb-3 flex items-center justify-center gap-2">
                                    <RotateCcw className="w-4 h-4" />
                                    Request to Retake Assessment
                                </h4>
                                <p className="text-xs text-amber-600 mb-4">
                                    If you believe you can do better, you can request the admin to allow you to retake the assessment. Your form data is preserved.
                                </p>
                                <textarea
                                    value={retakeReason}
                                    onChange={(e) => setRetakeReason(e.target.value)}
                                    placeholder="Optional: Explain why you'd like to retake (e.g., technical issue, want to prepare better)..."
                                    className="w-full px-4 py-3 bg-white border border-amber-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 resize-none mb-4"
                                    rows={3}
                                    maxLength={500}
                                />
                                <button
                                    onClick={handleRequestRetake}
                                    disabled={retakeRequesting}
                                    className="w-full sm:w-auto px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl transition-colors shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 mx-auto disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {retakeRequesting ? (
                                        <><Loader2Icon className="w-4 h-4 animate-spin" /> Sending...</>
                                    ) : (
                                        <><RotateCcw className="w-4 h-4" /> Request Retake</>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    if (!questions.length) return null;

    const currentQuestion = questions[currentIndex];
    const answeredCount = questions.filter(q => q.selectedOptionIndex !== null).length;
    const isLastQuestion = currentIndex === questions.length - 1;

    return (
        <div className="flex flex-col lg:flex-row gap-6">
            {/* Main Question Area */}
            <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50">
                    <div>
                        <h4 className="text-lg font-bold text-slate-900">Question {currentIndex + 1} of {questions.length}</h4>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full mt-3 overflow-hidden">
                            <div 
                                className="bg-orange-500 h-full rounded-full transition-all duration-300"
                                style={{ width: `${(answeredCount / questions.length) * 100}%` }}
                            />
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                        <Clock className={`w-5 h-5 ${timeLeft < 300 ? 'text-red-500 animate-pulse' : 'text-slate-500'}`} />
                        <span className={`font-mono text-lg font-bold tracking-wider ${timeLeft < 300 ? 'text-red-600' : 'text-slate-800'}`}>
                            {formatTime(timeLeft)}
                        </span>
                    </div>
                </div>

                {/* Question Body */}
                <div className="p-6 sm:p-8 flex-1">
                    <h2 className="text-xl sm:text-2xl font-medium text-slate-900 mb-8 leading-relaxed">
                        {currentQuestion.questionText}
                    </h2>
                    
                    <div className="space-y-3">
                        {currentQuestion.options.map((option, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleOptionSelect(idx)}
                                className={`w-full text-left p-4 sm:p-5 rounded-xl border-2 transition-all flex items-start gap-4 ${
                                    currentQuestion.selectedOptionIndex === idx
                                        ? 'border-orange-500 bg-orange-50'
                                        : 'border-slate-200 hover:border-orange-300 hover:bg-slate-50'
                                }`}
                            >
                                <div className="mt-0.5 flex-shrink-0">
                                    {currentQuestion.selectedOptionIndex === idx ? (
                                        <CheckCircle2 className="w-5 h-5 text-orange-500" />
                                    ) : (
                                        <Circle className="w-5 h-5 text-slate-300" />
                                    )}
                                </div>
                                <span className={`text-base ${currentQuestion.selectedOptionIndex === idx ? 'text-orange-900 font-medium' : 'text-slate-700'}`}>
                                    {option}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                    <button
                        onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                        disabled={currentIndex === 0}
                        className="px-5 py-2.5 flex items-center gap-2 text-slate-600 font-medium hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ChevronLeft className="w-4 h-4" /> Previous
                    </button>

                    {isLastQuestion ? (
                        <button
                            onClick={() => {
                                if (window.confirm('Are you sure you want to submit your assessment? You cannot change answers after submission.')) {
                                    handleSubmitTest();
                                }
                            }}
                            disabled={isSubmitting}
                            className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-emerald-500/30 disabled:opacity-70"
                        >
                            {isSubmitting ? 'Submitting...' : 'Submit Test'} <Send className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
                            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl flex items-center gap-2 transition-colors"
                        >
                            Next <ChevronRight className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Question Palette (Sidebar) */}
            <div className="w-full lg:w-72 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 h-fit">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-900">Question Palette</h3>
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                        {answeredCount} / {questions.length}
                    </span>
                </div>
                
                <div className="grid grid-cols-5 sm:grid-cols-10 lg:grid-cols-5 gap-2">
                    {questions.map((q, idx) => {
                        const isAnswered = q.selectedOptionIndex !== null;
                        const isCurrent = currentIndex === idx;
                        
                        return (
                            <button
                                key={idx}
                                onClick={() => setCurrentIndex(idx)}
                                className={`
                                    w-full aspect-square rounded-lg text-sm font-semibold flex items-center justify-center transition-all
                                    ${isCurrent ? 'ring-2 ring-orange-500 ring-offset-1' : ''}
                                    ${isAnswered 
                                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200' 
                                        : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                                    }
                                `}
                            >
                                {idx + 1}
                            </button>
                        );
                    })}
                </div>
                
                <div className="mt-6 pt-4 border-t border-slate-100 space-y-2">
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                        <div className="w-4 h-4 rounded bg-emerald-100 border border-emerald-200"></div> Answered
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                        <div className="w-4 h-4 rounded bg-slate-100 border border-slate-200"></div> Unanswered
                    </div>
                </div>
                
                <button
                    onClick={() => syncProgress(sessionToken, questions)}
                    className="mt-6 w-full flex items-center justify-center gap-2 text-xs font-medium text-slate-500 hover:text-orange-500 py-2 border border-slate-200 rounded-lg transition-colors"
                >
                    <Save className="w-3.5 h-3.5" /> Save Progress
                </button>
            </div>
        </div>
    );
}
