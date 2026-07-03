import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Filter, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import axiosInstance from '@core/api/axios';
import { toast } from 'sonner';

export default function QuestionBank() {
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [categories, setCategories] = useState([]);
    
    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState(null);
    const [formData, setFormData] = useState({
        questionText: '',
        options: ['', '', '', ''],
        correctOptionIndex: 0,
        category: '',
        difficulty: 'Medium',
        isActive: true
    });

    const fetchQuestions = async () => {
        try {
            setLoading(true);
            const res = await axiosInstance.get('/hrms/assessments/questions', {
                params: { search: searchTerm, category: filterCategory, limit: 200 }
            });
            setQuestions(res.data?.data?.questions || []);
        } catch (error) {
            toast.error('Failed to fetch questions');
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const res = await axiosInstance.get('/hrms/assessments/questions/categories');
            setCategories(res.data?.data || []);
        } catch (error) {}
    };

    useEffect(() => {
        fetchQuestions();
    }, [searchTerm, filterCategory]);

    useEffect(() => {
        fetchCategories();
    }, []);

    const handleOptionChange = (index, value) => {
        const newOptions = [...formData.options];
        newOptions[index] = value;
        setFormData({ ...formData, options: newOptions });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (editingQuestion) {
                await axiosInstance.patch(`/hrms/assessments/questions/${editingQuestion._id}`, formData);
                toast.success('Question updated successfully');
            } else {
                await axiosInstance.post('/hrms/assessments/questions', formData);
                toast.success('Question created successfully');
            }
            setShowModal(false);
            fetchQuestions();
            fetchCategories();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save question');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this question?')) return;
        try {
            await axiosInstance.delete(`/hrms/assessments/questions/${id}`);
            toast.success('Question deleted');
            fetchQuestions();
        } catch (error) {
            toast.error('Failed to delete question');
        }
    };

    const handleToggleActive = async (id) => {
        try {
            await axiosInstance.patch(`/hrms/assessments/questions/${id}/toggle-status`);
            fetchQuestions();
        } catch (error) {
            toast.error('Failed to toggle status');
        }
    };

    const openCreateModal = () => {
        setEditingQuestion(null);
        setFormData({
            questionText: '',
            options: ['', '', '', ''],
            correctOptionIndex: 0,
            category: '',
            difficulty: 'Medium',
            isActive: true
        });
        setShowModal(true);
    };

    const openEditModal = (q) => {
        setEditingQuestion(q);
        setFormData({
            questionText: q.questionText,
            options: [...q.options],
            correctOptionIndex: q.correctOptionIndex,
            category: q.category,
            difficulty: q.difficulty,
            isActive: q.isActive
        });
        setShowModal(true);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Question Bank</h1>
                    <p className="text-slate-500 text-sm mt-1">Manage assessment questions and categories</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl font-medium transition-colors shadow-sm"
                >
                    <Plus className="w-5 h-5" /> Add Question
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-12rem)]">
                {/* Filters */}
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center gap-4">
                    <div className="relative flex-1 min-w-[250px]">
                        <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search questions..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                        />
                    </div>
                    <div className="relative w-full sm:w-64">
                        <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 appearance-none"
                        >
                            <option value="">All Categories</option>
                            {categories.map((c, i) => <option key={i} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-64 text-slate-500">
                            <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                    ) : questions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                            <p>No questions found in the bank.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Question</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Category</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Difficulty</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {questions.map(q => (
                                    <tr key={q._id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <p className="text-sm font-medium text-slate-900 line-clamp-2">{q.questionText}</p>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                                {q.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                                                q.difficulty === 'Easy' ? 'bg-emerald-50 text-emerald-700' :
                                                q.difficulty === 'Medium' ? 'bg-amber-50 text-amber-700' :
                                                'bg-red-50 text-red-700'
                                            }`}>
                                                {q.difficulty}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <button 
                                                onClick={() => handleToggleActive(q._id)}
                                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                                                    q.isActive ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                            >
                                                {q.isActive ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                                {q.isActive ? 'Active' : 'Inactive'}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right space-x-3">
                                            <button onClick={() => openEditModal(q)} className="text-slate-400 hover:text-orange-500 transition-colors">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(q._id)} className="text-slate-400 hover:text-red-500 transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-900">{editingQuestion ? 'Edit Question' : 'Add New Question'}</h2>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1">
                            <form id="questionForm" onSubmit={handleSave} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Question Text</label>
                                    <textarea 
                                        required
                                        rows={3}
                                        value={formData.questionText}
                                        onChange={e => setFormData({...formData, questionText: e.target.value})}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none"
                                        placeholder="Enter the question here..."
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Category</label>
                                        <input 
                                            required
                                            type="text"
                                            list="categoryList"
                                            value={formData.category}
                                            onChange={e => setFormData({...formData, category: e.target.value})}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                            placeholder="e.g. Sales, ReactJS"
                                        />
                                        <datalist id="categoryList">
                                            {categories.map((c, i) => <option key={i} value={c} />)}
                                        </datalist>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Difficulty</label>
                                        <select 
                                            value={formData.difficulty}
                                            onChange={e => setFormData({...formData, difficulty: e.target.value})}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                        >
                                            <option value="Easy">Easy</option>
                                            <option value="Medium">Medium</option>
                                            <option value="Hard">Hard</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-3">Options (Select the correct one)</label>
                                    <div className="space-y-3">
                                        {[0, 1, 2, 3].map(index => (
                                            <div key={index} className={`flex items-center gap-3 p-2 rounded-xl border ${formData.correctOptionIndex === index ? 'border-orange-400 bg-orange-50' : 'border-slate-200 bg-white'}`}>
                                                <input 
                                                    type="radio" 
                                                    name="correctOption" 
                                                    checked={formData.correctOptionIndex === index}
                                                    onChange={() => setFormData({...formData, correctOptionIndex: index})}
                                                    className="w-4 h-4 accent-orange-500 ml-2 cursor-pointer"
                                                />
                                                <input 
                                                    required
                                                    type="text"
                                                    value={formData.options[index]}
                                                    onChange={e => handleOptionChange(index, e.target.value)}
                                                    className="flex-1 bg-transparent border-none text-sm focus:outline-none py-1"
                                                    placeholder={`Option ${index + 1}`}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </form>
                        </div>
                        
                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                            <button onClick={() => setShowModal(false)} className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">
                                Cancel
                            </button>
                            <button type="submit" form="questionForm" className="px-5 py-2.5 text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition-colors shadow-sm">
                                Save Question
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
