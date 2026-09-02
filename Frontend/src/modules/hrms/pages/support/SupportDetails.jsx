import React, { useEffect, useState, useRef } from 'react';
import axiosInstance from '@core/api/axios';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, Paperclip, Send, Download, FileText, User, Building2, CheckCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SupportDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [ticket, setTicket] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [replyText, setReplyText] = useState('');
    const [attachments, setAttachments] = useState([]);
    const [sending, setSending] = useState(false);
    const [uploading, setUploading] = useState(false);
    
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    const fetchTicket = async () => {
        try {
            const res = await axiosInstance.get(`/hrms/support/tickets/${id}`);
            setTicket(res.data?.data?.ticket);
            setMessages(res.data?.data?.messages || []);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load ticket details');
            navigate('/hrms/support/list');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTicket();
    }, [id]);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        // Arbitrary 5MB limit fallback if settings not fetched here
        const maxBytes = 5 * 1024 * 1024;
        const validFiles = files.filter(f => f.size <= maxBytes);
        
        if (validFiles.length < files.length) {
            toast.error('Some files exceeded the 5MB limit');
        }

        if (validFiles.length === 0) return;

        setUploading(true);
        try {
            const formData = new FormData();
            validFiles.forEach(f => formData.append('images', f));

            const res = await axiosInstance.post('/uploads/image', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const urls = res.data?.data || [];
            const newAttachments = urls.map((url, i) => ({
                url,
                name: validFiles[i].name,
                type: validFiles[i].type,
                size: validFiles[i].size
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
            await axiosInstance.post(`/hrms/support/tickets/${id}/reply`, payload);
            
            setReplyText('');
            setAttachments([]);
            // Refresh to get new message and updated status
            await fetchTicket();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to send reply');
        } finally {
            setSending(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[500px]">
                <Loader2 className="w-8 h-8 animate-spin text-[#6412c6]" />
            </div>
        );
    }

    if (!ticket) return null;

    const isClosed = ticket.status === 'Closed' || ticket.status === 'Resolved';

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4 shrink-0 shadow-sm z-10">
                <button
                    onClick={() => navigate('/hrms/support/list')}
                    className="p-2 -ml-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                        <h1 className="text-lg font-bold text-slate-900 truncate">{ticket.subject}</h1>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-500 uppercase tracking-wider shrink-0">
                            {ticket.ticketId}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#f7f3fc] text-[#550fa8] uppercase tracking-wider shrink-0 border border-[#f0e7f9]">
                            {ticket.status}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                        <span>Category: <span className="font-medium text-slate-700">{ticket.category}</span></span>
                        <span>•</span>
                        <span>Priority: <span className="font-medium text-slate-700">{ticket.priority}</span></span>
                        {ticket.assignedAdminId && (
                            <>
                                <span>•</span>
                                <span>Assigned to: <span className="font-medium text-slate-700">{ticket.assignedAdminId.name}</span></span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.map((msg, index) => {
                    const isEmployee = msg.senderType === 'Employee';
                    return (
                        <div key={msg._id || index} className={`flex ${isEmployee ? 'justify-end' : 'justify-start'}`}>
                            <div className={`flex items-end gap-2 max-w-[85%] sm:max-w-[75%] ${isEmployee ? 'flex-row-reverse' : 'flex-row'}`}>
                                {/* Avatar */}
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${isEmployee ? 'bg-gradient-to-br from-[#6412c6] to-amber-500 text-white' : 'bg-gradient-to-br from-slate-700 to-slate-900 text-white'}`}>
                                    {isEmployee ? <User className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                                </div>
                                
                                {/* Message Bubble */}
                                <div className={`flex flex-col gap-1 ${isEmployee ? 'items-end' : 'items-start'}`}>
                                    <span className="text-[10px] font-medium text-slate-400 px-1">
                                        {isEmployee ? 'You' : 'HR/Admin'} • {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    
                                    <div className={`p-4 ${isEmployee ? 'bg-[#f7f3fc] text-slate-800 rounded-br-none border border-[#f0e7f9]' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-sm'}`}>
                                        {msg.message && (
                                            <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                                        )}
                                        
                                        {/* Attachments */}
                                        {msg.attachments && msg.attachments.length > 0 && (
                                            <div className={`flex flex-wrap gap-2 ${msg.message ? 'mt-3 pt-3 border-t' : ''} ${isEmployee ? 'border-[#9359d7]/50' : 'border-slate-100'}`}>
                                                {msg.attachments.map((att, i) => (
                                                    <a 
                                                        key={i} 
                                                        href={att.url} 
                                                        target="_blank" 
                                                        rel="noreferrer"
                                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                                                            isEmployee 
                                                                ? 'bg-[#550fa8] hover:bg-[#460d8b] text-white' 
                                                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                                                        }`}
                                                    >
                                                        {att.type?.includes('image') ? <FileText className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                                                        <span className="truncate max-w-[150px]">{att.name}</span>
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="bg-white border-t border-slate-200 p-4 shrink-0 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)]">
                {isClosed ? (
                    <div className="flex items-center justify-center gap-2 text-slate-500 py-3 bg-slate-50 rounded-xl border border-slate-100">
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                        <span className="text-sm font-medium">This ticket is {ticket.status.toLowerCase()} and cannot accept new replies.</span>
                    </div>
                ) : (
                    <form onSubmit={handleSend} className="max-w-4xl mx-auto flex flex-col gap-3">
                        {/* Selected Attachments Preview */}
                        {attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 px-1">
                                {attachments.map((att, i) => (
                                    <div key={i} className="flex items-center gap-1.5 bg-[#f7f3fc] border border-[#f0e7f9] text-[#460d8b] px-3 py-1.5 rounded-lg text-xs font-medium">
                                        <Paperclip className="w-3.5 h-3.5" />
                                        <span className="truncate max-w-[120px]">{att.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                                            className="ml-1 text-[#9359d7] hover:text-red-500 bg-white rounded-full p-0.5"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex items-end gap-3">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading || sending}
                                className="p-3.5 text-slate-400 hover:text-[#6412c6] hover:bg-[#f7f3fc] rounded-xl transition-all disabled:opacity-50 shrink-0"
                            >
                                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                            </button>
                            <input
                                type="file"
                                multiple
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleFileChange}
                            />
                            
                            <textarea
                                value={replyText}
                                onChange={e => setReplyText(e.target.value)}
                                placeholder="Type your reply here..."
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f0e7f9] focus:border-[#9359d7] resize-none max-h-32 min-h-[50px] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#d8c4f1] [&::-webkit-scrollbar-thumb]:rounded-full"
                                rows={1}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend(e);
                                    }
                                }}
                            />
                            
                            <button
                                type="submit"
                                disabled={sending || (!replyText.trim() && attachments.length === 0)}
                                className="p-3.5 bg-[#6412c6] text-white rounded-xl hover:bg-[#550fa8] transition-all shadow-sm shadow-[#6412c6]/20 disabled:opacity-50 disabled:shadow-none shrink-0"
                            >
                                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
