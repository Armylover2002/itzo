import React, { useEffect, useState, useRef } from 'react';
import axiosInstance from '@core/api/axios';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, Download, FileText, User, Building2, Send, Paperclip, CheckCircle, Clock, AlertCircle, X, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ReportDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    
    const [report, setReport] = useState(null);
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [replyText, setReplyText] = useState('');
    const [attachments, setAttachments] = useState([]);
    const [sending, setSending] = useState(false);
    const [uploading, setUploading] = useState(false);
    
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    const fetchReport = async () => {
        try {
            const res = await axiosInstance.get(`/hrms/daily-reports/${id}`);
            setReport(res.data?.data?.report);
            setComments(res.data?.data?.comments || []);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load report');
            navigate('/hrms/reports/list');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [id]);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [comments]);

    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        setUploading(true);
        try {
            const formData = new FormData();
            files.forEach(f => formData.append('images', f));

            const res = await axiosInstance.post('/uploads/image', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const urls = res.data?.data || [];
            const newAttachments = urls.map((url, i) => ({
                url, name: files[i].name, type: files[i].type
            }));

            setAttachments(prev => [...prev, ...newAttachments]);
        } catch (error) {
            console.error('Upload failed:', error);
            toast.error('Failed to upload attachments');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!replyText.trim() && attachments.length === 0) return;

        setSending(true);
        try {
            const payload = { message: replyText, attachments };
            await axiosInstance.post(`/hrms/daily-reports/${id}/reply`, payload);
            
            setReplyText('');
            setAttachments([]);
            await fetchReport();
        } catch (error) {
            console.error(error);
            toast.error('Failed to send comment');
        } finally {
            setSending(false);
        }
    };

    if (loading) {
        return <div className="flex h-[500px] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#6412c6]" /></div>;
    }

    if (!report) return null;

    const isRevisionRequested = report.status === 'Revision Requested';
    const isApproved = report.status === 'Approved';
    const isRejected = report.status === 'Rejected';

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-6rem)] max-w-7xl mx-auto p-4 sm:p-6">
            
            {/* Left side: Report Content */}
            <div className="w-full lg:w-7/12 xl:w-2/3 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-full">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/hrms/reports/list')} className="p-1.5 -ml-1.5 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h2 className="text-base font-bold text-slate-800">
                                Report for {new Date(report.reportDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                            </h2>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                                    isApproved ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                    isRejected ? 'bg-red-50 text-red-600 border-red-200' :
                                    isRevisionRequested ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                    report.status === 'Draft' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                                    'bg-[#f7f3fc] text-[#550fa8] border-[#d8c4f1]'
                                }`}>
                                    {report.status}
                                </span>
                            </div>
                        </div>
                    </div>
                    {(isRevisionRequested || report.status === 'Draft') && (
                        <button onClick={() => navigate(`/hrms/reports/create?id=${report._id}`)} className="px-4 py-2 bg-[#6412c6] hover:bg-[#550fa8] text-white rounded-xl text-sm font-semibold shadow-sm transition-colors">
                            Edit Report
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#d8c4f1] [&::-webkit-scrollbar-thumb]:rounded-full">
                    {/* Tasks */}
                    <section>
                        <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs border-b pb-2 mb-4">Today's Tasks</h3>
                        <div className="space-y-3">
                            {report.tasks?.map((task, i) => (
                                <div key={i} className="flex justify-between items-center bg-slate-50 border border-slate-100 p-3 rounded-xl">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-sm font-medium text-slate-700">{task.title}</span>
                                        <span className="text-[10px] text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded w-max uppercase">{task.category}</span>
                                    </div>
                                    <span className={`text-xs font-semibold px-2 py-1 rounded-md ${
                                        task.status === 'Completed' ? 'text-emerald-600 bg-emerald-50' : 
                                        task.status === 'In Progress' ? 'text-amber-600 bg-amber-50' : 'text-slate-600 bg-slate-100'
                                    }`}>{task.status}</span>
                                </div>
                            ))}
                        </div>
                        {report.workSummary && (
                            <div className="mt-4 p-4 bg-[#f7f3fc]/50 rounded-xl border border-[#f0e7f9]">
                                <h4 className="text-xs font-bold text-[#370a6d] mb-1">Work Summary</h4>
                                <p className="text-sm text-slate-700 whitespace-pre-wrap">{report.workSummary}</p>
                            </div>
                        )}
                    </section>

                    {/* Performance */}
                    {(report.metrics?.restaurantsVisited > 0 || report.metrics?.callsMade > 0 || report.metrics?.meetingsConducted > 0) && (
                        <section>
                            <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs border-b pb-2 mb-4">Performance</h3>
                            
                            {/* Restaurant names */}
                            {report.metrics?.restaurantsVisitedNames?.length > 0 && (
                                <div className="mb-4">
                                    <p className="text-xs text-slate-500 mb-2 font-semibold">Restaurants Visited ({report.metrics.restaurantsVisitedNames.length})</p>
                                    <div className="flex flex-wrap gap-2">
                                        {report.metrics.restaurantsVisitedNames.map((name, i) => (
                                            <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#f7f3fc] border border-[#d8c4f1] rounded-lg text-xs font-medium text-[#460d8b]">
                                                {name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {Object.entries(report.metrics)
                                    .filter(([key]) => key !== 'restaurantsVisitedNames' && key !== 'restaurantsVisited')
                                    .map(([key, val]) => (
                                    <div key={key} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <p className="text-xs text-slate-500 mb-1">{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</p>
                                        <p className="font-bold text-slate-800">{val || 0}</p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}



                    {/* Text fields */}
                    <section className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {report.achievements && <div><h3 className="font-bold text-emerald-700 uppercase tracking-wider text-xs mb-2">Achievements</h3><p className="text-sm text-slate-700 bg-emerald-50 p-3 rounded-xl">{report.achievements}</p></div>}
                        {report.problemsFaced && <div><h3 className="font-bold text-red-700 uppercase tracking-wider text-xs mb-2">Problems Faced</h3><p className="text-sm text-slate-700 bg-red-50 p-3 rounded-xl">{report.problemsFaced}</p></div>}
                        {report.pendingWork && <div><h3 className="font-bold text-amber-700 uppercase tracking-wider text-xs mb-2">Pending Work</h3><p className="text-sm text-slate-700 bg-amber-50 p-3 rounded-xl">{report.pendingWork}</p></div>}
                        {report.tomorrowPlan && <div><h3 className="font-bold text-[#460d8b] uppercase tracking-wider text-xs mb-2">Tomorrow's Plan</h3><p className="text-sm text-slate-700 bg-[#f7f3fc] p-3 rounded-xl">{report.tomorrowPlan}</p></div>}
                    </section>

                    {/* Attachments */}
                    {report.attachments?.length > 0 && (
                        <section>
                            <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs border-b pb-2 mb-4">Attachments</h3>
                            <div className="flex flex-wrap gap-3">
                                {report.attachments.map((att, i) => (
                                    <a key={i} href={att.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-[#f7f3fc] border border-slate-200 hover:border-[#d8c4f1] rounded-xl text-sm transition-colors group">
                                        <FileText className="w-4 h-4 text-slate-400 group-hover:text-[#6412c6]" />
                                        <span className="text-slate-700 font-medium">{att.name}</span>
                                        <Download className="w-3.5 h-3.5 text-slate-400 ml-2" />
                                    </a>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </div>

            {/* Right side: Comments / Timeline */}
            <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-full">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Feedback & Comments</h2>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-white [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#d8c4f1] [&::-webkit-scrollbar-thumb]:rounded-full">
                    {comments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
                            <p className="text-sm font-medium">No comments yet</p>
                        </div>
                    ) : (
                        comments.map((msg, index) => {
                            const isMe = msg.senderType === 'Employee';
                            return (
                                <div key={msg._id || index} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`flex items-end gap-2 max-w-[90%] sm:max-w-[85%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-sm ${!isMe ? 'bg-gradient-to-br from-[#6412c6] to-amber-500 text-white' : 'bg-gradient-to-br from-slate-700 to-slate-900 text-white'}`}>
                                            {!isMe ? <Building2 className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                                        </div>
                                        
                                        <div className={`flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                                            <span className="text-[10px] font-medium text-slate-400 px-1">
                                                {isMe ? 'You' : (msg.senderType === 'Admin' ? 'Admin' : 'Manager')} • {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            
                                            <div className={`p-3 ${
                                                !isMe 
                                                    ? 'bg-[#f7f3fc] text-slate-800 rounded-2xl rounded-bl-none border border-[#f0e7f9]' 
                                                    : 'bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-br-none shadow-sm'
                                            }`}>
                                                {msg.message && <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>}
                                                {msg.attachments && msg.attachments.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-slate-100">
                                                        {msg.attachments.map((att, i) => (
                                                            <a key={i} href={att.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-2 py-1 rounded bg-white border border-slate-200 text-xs font-medium hover:bg-slate-50">
                                                                <Download className="w-3 h-3 text-slate-400" /> <span className="truncate max-w-[100px]">{att.name}</span>
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="bg-white border-t border-slate-200 p-4 shrink-0">
                    <form onSubmit={handleSend} className="flex flex-col gap-3">
                        {attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 px-1">
                                {attachments.map((att, i) => (
                                    <div key={i} className="flex items-center gap-1.5 bg-[#f7f3fc] border border-[#f0e7f9] text-[#460d8b] px-3 py-1.5 rounded-lg text-xs font-medium">
                                        <Paperclip className="w-3.5 h-3.5" />
                                        <span className="truncate max-w-[120px]">{att.name}</span>
                                        <button type="button" onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="ml-1 hover:text-red-500"><X className="w-3 h-3" /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex items-end gap-2">
                            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading || sending} className="p-3 text-slate-400 hover:text-[#6412c6] hover:bg-[#f7f3fc] rounded-xl transition-all disabled:opacity-50 shrink-0">
                                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                            </button>
                            <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                            
                            <textarea
                                value={replyText}
                                onChange={e => setReplyText(e.target.value)}
                                placeholder="Add a comment or reply..."
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f0e7f9] focus:border-[#9359d7] resize-none max-h-32 min-h-[50px] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#d8c4f1] [&::-webkit-scrollbar-thumb]:rounded-full disabled:bg-slate-100 disabled:cursor-not-allowed"
                                rows={1}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); }
                                }}
                            />
                            
                            <button type="submit" disabled={sending || (!replyText.trim() && attachments.length === 0)} className="p-3 bg-[#6412c6] text-white rounded-xl hover:bg-[#550fa8] transition-all shadow-sm shadow-[#6412c6]/20 disabled:opacity-50 disabled:shadow-none shrink-0">
                                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
