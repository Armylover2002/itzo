import React, { useState, useEffect, useMemo } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'sonner';
import { Receipt, Loader2, Plus, X, Trash2, ChevronDown, ChevronUp, AlertTriangle, RefreshCw, Calendar } from 'lucide-react';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function daysInMonth(month, year) {
    return new Date(year, month, 0).getDate();
}

function emptyEntry() {
    return { visitDate: '', purpose: '', travelDistanceKm: '', travelCost: '', hotelCost: '', foodCost: '', otherExpenses: '', remarks: '' };
}

function entryTotal(e) {
    return (Number(e.travelCost) || 0) + (Number(e.hotelCost) || 0) + (Number(e.foodCost) || 0) + (Number(e.otherExpenses) || 0);
}

export default function Expense() {
    const [batches, setBatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [expandedBatch, setExpandedBatch] = useState(null);

    // Form state
    const now = new Date();
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth(); // previous month (1-indexed)
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const [selectedMonth, setSelectedMonth] = useState(prevMonth);
    const [selectedYear, setSelectedYear] = useState(prevYear);
    const [entries, setEntries] = useState([emptyEntry()]);
    const [resubmissionNote, setResubmissionNote] = useState('');

    // Check if a rejected batch exists for the selected month
    const [existingBatch, setExistingBatch] = useState(null);
    const [checkingExisting, setCheckingExisting] = useState(false);

    const fetchBatches = async () => {
        setLoading(true);
        try {
            const res = await axiosInstance.get('/hrms/expenses/monthly/me');
            setBatches(res.data?.data?.batches || []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchBatches(); }, []);

    // When month/year changes, check if a batch already exists
    useEffect(() => {
        if (!showForm) return;
        let cancelled = false;
        const checkExisting = async () => {
            setCheckingExisting(true);
            try {
                const res = await axiosInstance.get('/hrms/expenses/monthly/me');
                const all = res.data?.data?.batches || [];
                const match = all.find(b => b.month === selectedMonth && b.year === selectedYear);
                if (!cancelled) setExistingBatch(match || null);
            } catch (e) { console.error(e); }
            finally { if (!cancelled) setCheckingExisting(false); }
        };
        checkExisting();
        return () => { cancelled = true; };
    }, [selectedMonth, selectedYear, showForm]);

    // Pre-populate entries from rejected batch for resubmission
    useEffect(() => {
        if (existingBatch?.status === 'Rejected' && existingBatch.entries?.length > 0) {
            setEntries(existingBatch.entries.map(e => ({
                visitDate: e.visitDate ? new Date(e.visitDate).toISOString().split('T')[0] : '',
                purpose: e.purpose || '',
                travelDistanceKm: e.travelDistanceKm || '',
                travelCost: e.travelCost || '',
                hotelCost: e.hotelCost || '',
                foodCost: e.foodCost || '',
                otherExpenses: e.otherExpenses || '',
                remarks: e.remarks || ''
            })));
        }
    }, [existingBatch]);

    // Available months: only past months
    const availableMonths = useMemo(() => {
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        const months = [];
        for (let m = 1; m <= 12; m++) {
            const disabled = selectedYear > currentYear || (selectedYear === currentYear && m >= currentMonth);
            months.push({ value: m, label: MONTH_NAMES[m - 1], disabled });
        }
        return months;
    }, [selectedYear]);

    const availableYears = useMemo(() => {
        const currentYear = now.getFullYear();
        const years = [];
        for (let y = currentYear; y >= currentYear - 5; y--) years.push(y);
        return years;
    }, []);

    // Date constraints for entries
    const dateMin = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
    const dateMax = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(daysInMonth(selectedMonth, selectedYear)).padStart(2, '0')}`;

    const updateEntry = (idx, field, value) => {
        setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
    };

    const addEntry = () => setEntries(prev => [...prev, emptyEntry()]);

    const removeEntry = (idx) => {
        if (entries.length <= 1) return toast.error('At least one entry is required');
        setEntries(prev => prev.filter((_, i) => i !== idx));
    };

    const grandTotal = entries.reduce((sum, e) => sum + entryTotal(e), 0);

    const canSubmit = useMemo(() => {
        if (checkingExisting) return false;
        // Blocked if batch exists and is not Rejected
        if (existingBatch && existingBatch.status !== 'Rejected') return false;
        // Resubmission needs a note
        if (existingBatch?.status === 'Rejected' && !resubmissionNote.trim()) return false;
        // At least one complete entry
        return entries.some(e => e.visitDate && e.purpose?.trim());
    }, [entries, existingBatch, resubmissionNote, checkingExisting]);

    const handleSubmit = async () => {
        // Validate all entries
        for (let i = 0; i < entries.length; i++) {
            const e = entries[i];
            if (!e.visitDate) return toast.error(`Entry ${i + 1}: Visit date is required`);
            if (!e.purpose?.trim()) return toast.error(`Entry ${i + 1}: Purpose is required`);
        }

        // Confirm
        const monthLabel = MONTH_NAMES[selectedMonth - 1];
        const isResub = existingBatch?.status === 'Rejected';
        const msg = isResub
            ? `Resubmit expenses for ${monthLabel} ${selectedYear} with ${entries.length} entries? Total: ₹${grandTotal.toLocaleString()}`
            : `Submit expenses for ${monthLabel} ${selectedYear} with ${entries.length} entries? Total: ₹${grandTotal.toLocaleString()}`;
        if (!window.confirm(msg)) return;

        setSubmitLoading(true);
        try {
            await axiosInstance.post('/hrms/expenses/monthly', {
                month: selectedMonth,
                year: selectedYear,
                entries: entries.map(e => ({
                    ...e,
                    travelDistanceKm: Number(e.travelDistanceKm) || 0,
                    travelCost: Number(e.travelCost) || 0,
                    hotelCost: Number(e.hotelCost) || 0,
                    foodCost: Number(e.foodCost) || 0,
                    otherExpenses: Number(e.otherExpenses) || 0,
                })),
                resubmissionNote: resubmissionNote.trim() || undefined,
            });
            toast.success(isResub ? 'Expenses resubmitted successfully' : 'Monthly expenses submitted successfully');
            setShowForm(false);
            setEntries([emptyEntry()]);
            setResubmissionNote('');
            setExistingBatch(null);
            fetchBatches();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to submit');
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleOpenForm = () => {
        setShowForm(true);
        setEntries([emptyEntry()]);
        setResubmissionNote('');
        setExistingBatch(null);
    };

    const handleCloseForm = () => {
        setShowForm(false);
        setEntries([emptyEntry()]);
        setResubmissionNote('');
        setExistingBatch(null);
    };

    const statusBadge = (s) => {
        const styles = {
            Pending: 'bg-amber-50 text-amber-700 border-amber-200',
            Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            Rejected: 'bg-red-50 text-red-700 border-red-200',
            Reimbursed: 'bg-orange-50 text-orange-700 border-orange-200'
        };
        return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[s] || ''}`}>{s}</span>;
    };

    const inputClass = "w-full h-10 px-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 transition-all";
    const numberInputClass = "w-full h-10 px-2 border border-slate-200 rounded-xl text-sm text-right focus:outline-none focus:ring-2 focus:ring-orange-500/30 transition-all";

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Travel & Visit Expenses</h1>
                    <p className="text-sm text-slate-500 mt-1">Submit monthly expense claims at the end of each month</p>
                </div>
                <button onClick={showForm ? handleCloseForm : handleOpenForm}
                    className={`flex items-center gap-2 px-4 h-10 font-medium rounded-xl shadow-sm transition-all text-sm ${showForm
                        ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                        : 'bg-orange-500 hover:bg-orange-600 text-white'
                        }`}>
                    {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {showForm ? 'Cancel' : 'New Monthly Expense'}
                </button>
            </div>

            {/* Monthly Submission Form */}
            {showForm && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100">
                        <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-orange-500" />
                            Submit Monthly Expense Claim
                        </h3>

                        {/* Month/Year Selector */}
                        <div className="flex flex-wrap gap-3 items-end">
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">Month *</label>
                                <select
                                    className={inputClass + ' min-w-[160px]'}
                                    value={selectedMonth}
                                    onChange={e => setSelectedMonth(Number(e.target.value))}
                                >
                                    {availableMonths.map(m => (
                                        <option key={m.value} value={m.value} disabled={m.disabled}>
                                            {m.label}{m.disabled ? ' (not allowed)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">Year *</label>
                                <select
                                    className={inputClass + ' min-w-[100px]'}
                                    value={selectedYear}
                                    onChange={e => setSelectedYear(Number(e.target.value))}
                                >
                                    {availableYears.map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                            {checkingExisting && (
                                <div className="flex items-center gap-2 text-sm text-slate-400 h-10">
                                    <Loader2 className="w-4 h-4 animate-spin" /> Checking...
                                </div>
                            )}
                        </div>

                        {/* Status banners */}
                        {existingBatch && existingBatch.status !== 'Rejected' && (
                            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold text-amber-800">Already Submitted</p>
                                    <p className="text-xs text-amber-600 mt-0.5">
                                        You have already submitted expenses for {MONTH_NAMES[selectedMonth - 1]} {selectedYear} (Status: {existingBatch.status}).
                                        Only one submission per month is allowed.
                                    </p>
                                </div>
                            </div>
                        )}

                        {existingBatch?.status === 'Rejected' && (
                            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                                <div className="flex items-start gap-3">
                                    <RefreshCw className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-red-800">Previous Submission Rejected</p>
                                        <p className="text-xs text-red-600 mt-0.5">
                                            Reason: {existingBatch.rejectionReason || 'No reason provided'}
                                        </p>
                                        <p className="text-xs text-red-600 mt-1">You may resubmit with corrections. A resubmission note is required.</p>
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <label className="text-xs font-medium text-red-700 mb-1 block">Resubmission Note *</label>
                                    <textarea
                                        className="w-full px-3 py-2 border border-red-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-300/50 bg-white resize-none"
                                        rows={2}
                                        value={resubmissionNote}
                                        onChange={e => setResubmissionNote(e.target.value)}
                                        placeholder="Explain what corrections were made..."
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Entries Table */}
                    {(!existingBatch || existingBatch.status === 'Rejected') && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase w-8">#</th>
                                        <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase min-w-[130px]">Visit Date *</th>
                                        <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase min-w-[180px]">Purpose *</th>
                                        <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase min-w-[90px]">Dist (km)</th>
                                        <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase min-w-[100px]">Travel ₹</th>
                                        <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase min-w-[100px]">Hotel ₹</th>
                                        <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase min-w-[100px]">Food ₹</th>
                                        <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase min-w-[100px]">Other ₹</th>
                                        <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase min-w-[120px]">Remarks</th>
                                        <th className="px-3 py-3 text-right text-xs font-semibold text-slate-600 uppercase min-w-[90px]">Total</th>
                                        <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.map((entry, idx) => (
                                        <tr key={idx} className="border-b border-slate-50 hover:bg-orange-50/30 transition-colors">
                                            <td className="px-3 py-2 text-slate-400 font-mono text-xs">{idx + 1}</td>
                                            <td className="px-3 py-2">
                                                <input type="date" className={inputClass + ' text-xs'} min={dateMin} max={dateMax}
                                                    value={entry.visitDate} onChange={e => updateEntry(idx, 'visitDate', e.target.value)} />
                                            </td>
                                            <td className="px-3 py-2">
                                                <input className={inputClass + ' text-xs'} value={entry.purpose}
                                                    onChange={e => updateEntry(idx, 'purpose', e.target.value)} placeholder="e.g., Client meeting" />
                                            </td>
                                            <td className="px-3 py-2">
                                                <input type="number" className={numberInputClass + ' text-xs'} value={entry.travelDistanceKm}
                                                    onChange={e => updateEntry(idx, 'travelDistanceKm', e.target.value)} placeholder="0" min="0" />
                                            </td>
                                            <td className="px-3 py-2">
                                                <input type="number" className={numberInputClass + ' text-xs'} value={entry.travelCost}
                                                    onChange={e => updateEntry(idx, 'travelCost', e.target.value)} placeholder="0" min="0" />
                                            </td>
                                            <td className="px-3 py-2">
                                                <input type="number" className={numberInputClass + ' text-xs'} value={entry.hotelCost}
                                                    onChange={e => updateEntry(idx, 'hotelCost', e.target.value)} placeholder="0" min="0" />
                                            </td>
                                            <td className="px-3 py-2">
                                                <input type="number" className={numberInputClass + ' text-xs'} value={entry.foodCost}
                                                    onChange={e => updateEntry(idx, 'foodCost', e.target.value)} placeholder="0" min="0" />
                                            </td>
                                            <td className="px-3 py-2">
                                                <input type="number" className={numberInputClass + ' text-xs'} value={entry.otherExpenses}
                                                    onChange={e => updateEntry(idx, 'otherExpenses', e.target.value)} placeholder="0" min="0" />
                                            </td>
                                            <td className="px-3 py-2">
                                                <input className={inputClass + ' text-xs'} value={entry.remarks}
                                                    onChange={e => updateEntry(idx, 'remarks', e.target.value)} placeholder="Notes" />
                                            </td>
                                            <td className="px-3 py-2 text-right font-bold text-slate-900 text-xs tabular-nums">
                                                ₹{entryTotal(entry).toLocaleString()}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <button onClick={() => removeEntry(idx)} className="text-slate-400 hover:text-red-500 transition-colors p-1" title="Remove entry">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Add entry + Grand total */}
                            <div className="p-4 flex items-center justify-between border-t border-slate-100">
                                <button onClick={addEntry} className="flex items-center gap-1.5 text-sm text-orange-600 hover:text-orange-700 font-medium transition-colors">
                                    <Plus className="w-4 h-4" /> Add Entry
                                </button>
                                <div className="flex items-center gap-6">
                                    <span className="text-sm text-slate-500">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
                                    <span className="text-lg font-bold text-slate-900">Grand Total: ₹{grandTotal.toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Submit button */}
                            <div className="p-4 border-t border-slate-100 flex justify-end">
                                <button onClick={handleSubmit} disabled={submitLoading || !canSubmit}
                                    className="px-6 h-10 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                                    {submitLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {existingBatch?.status === 'Rejected' ? 'Resubmit Expenses' : 'Submit Monthly Expense'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Expense History */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-900">Expense History</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Your monthly expense submissions</p>
                </div>

                {loading ? (
                    <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
                ) : batches.length === 0 ? (
                    <div className="text-center p-12">
                        <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium">No expense claims yet</p>
                        <p className="text-xs text-slate-400 mt-1">Click "New Monthly Expense" to submit your first claim</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {batches.map(batch => {
                            const isExpanded = expandedBatch === batch._id;
                            const monthLabel = MONTH_NAMES[(batch.month || 1) - 1];
                            return (
                                <div key={batch._id}>
                                    {/* Batch Header Row */}
                                    <button
                                        onClick={() => setExpandedBatch(isExpanded ? null : batch._id)}
                                        className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors text-left"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                                                <Calendar className="w-5 h-5 text-orange-500" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-900">{monthLabel} {batch.year}</p>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    {batch.entries?.length || 0} {(batch.entries?.length || 0) === 1 ? 'entry' : 'entries'}
                                                    {batch.isLegacy && <span className="ml-2 text-amber-500 font-medium">(Legacy)</span>}
                                                    {batch.resubmissionCount > 0 && <span className="ml-2 text-blue-500 font-medium">Resubmitted ×{batch.resubmissionCount}</span>}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <p className="text-lg font-bold text-slate-900">₹{(batch.totalAmount || 0).toLocaleString()}</p>
                                                {batch.status === 'Approved' && batch.approvedAmount != null && batch.approvedAmount !== batch.totalAmount && (
                                                    <p className="text-xs text-emerald-600">Approved: ₹{batch.approvedAmount.toLocaleString()}</p>
                                                )}
                                            </div>
                                            {statusBadge(batch.status)}
                                            {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                                        </div>
                                    </button>

                                    {/* Expanded Entry Details */}
                                    {isExpanded && (
                                        <div className="border-t border-slate-100 bg-slate-50/50">
                                            {batch.status === 'Rejected' && batch.rejectionReason && (
                                                <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                                                    <p className="text-xs font-semibold text-red-700">Rejection Reason:</p>
                                                    <p className="text-sm text-red-600 mt-0.5">{batch.rejectionReason}</p>
                                                </div>
                                            )}
                                            {batch.resubmissionNote && (
                                                <div className="mx-5 mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                                                    <p className="text-xs font-semibold text-blue-700">Resubmission Note:</p>
                                                    <p className="text-sm text-blue-600 mt-0.5">{batch.resubmissionNote}</p>
                                                </div>
                                            )}
                                            <div className="overflow-x-auto p-4">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="border-b border-slate-200">
                                                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                                                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Purpose</th>
                                                            <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 uppercase">Travel</th>
                                                            <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 uppercase">Hotel</th>
                                                            <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 uppercase">Food</th>
                                                            <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 uppercase">Other</th>
                                                            <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 uppercase">Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {(batch.entries || []).map((entry, idx) => (
                                                            <tr key={entry._id || idx} className="border-b border-slate-100 last:border-0">
                                                                <td className="px-3 py-2.5 font-medium text-slate-900">
                                                                    {new Date(entry.visitDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                                                </td>
                                                                <td className="px-3 py-2.5 text-slate-600 max-w-[200px] truncate">{entry.purpose}</td>
                                                                <td className="px-3 py-2.5 text-slate-600 text-right tabular-nums">₹{(entry.travelCost || 0).toLocaleString()}</td>
                                                                <td className="px-3 py-2.5 text-slate-600 text-right tabular-nums">₹{(entry.hotelCost || 0).toLocaleString()}</td>
                                                                <td className="px-3 py-2.5 text-slate-600 text-right tabular-nums">₹{(entry.foodCost || 0).toLocaleString()}</td>
                                                                <td className="px-3 py-2.5 text-slate-600 text-right tabular-nums">₹{(entry.otherExpenses || 0).toLocaleString()}</td>
                                                                <td className="px-3 py-2.5 font-bold text-slate-900 text-right tabular-nums">₹{(entry.entryTotal || 0).toLocaleString()}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <div className="px-5 pb-4 text-right text-xs text-slate-400">
                                                Submitted on {new Date(batch.submittedAt || batch.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
