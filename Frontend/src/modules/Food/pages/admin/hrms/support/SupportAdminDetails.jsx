import React, { useEffect, useState, useRef } from 'react';
import axiosInstance from '@core/api/axios';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, Paperclip, Send, Download, FileText, User, Building2, UserCircle, Briefcase, Mail, Phone, MapPin, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@core/context/AuthContext';

export default function SupportAdminDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user: currentUser } = useAuth(); // Logged in admin
    const [ticket, setTicket] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [replyText, setReplyText] = useState('');
    const [attachments, setAttachments] = useState([]);
    const [sending, setSending] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [statusUpdating, setStatusUpdating] = useState(false);
    const [assigning, setAssigning] = useState(false);
    
    // To fetch admins for assignment
    const [admins, setAdmins] = useState([]);
    
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
            navigate('/ecs/hrms/support/requests');
        } finally {
            setLoading(false);
        }
    };

    const fetchAdmins = async () => {
        try {
            // Reusing an endpoint or just fetching managers/admins if it exists
            // Assuming there's a way to get admin list, else we just use hardcoded for now or skip.
            // Wait, we can fetch all food admins. For now, let's just allow self-assign or use a basic endpoint if available.
            // Let's assume we can fetch FoodAdmin list if we have an endpoint, but I will just implement a self-assign button for simplicity if we don't have an endpoint ready, or use the employee's manager endpoint.
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchTicket();
        fetchAdmins();
    }, [id]);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const maxBytes = 5 * 1024 * 1024;
        const validFiles = files.filter(f => f.size <= maxBytes);
        
        if (validFiles.length < files.length) toast.error('Some files exceeded the 5MB limit');
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
                url, name: validFiles[i].name, type: validFiles[i].type, size: validFiles[i].size
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
            await fetchTicket();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to send reply');
        } finally {
            setSending(false);
        }
    };

    const changeStatus = async (newStatus) => {
        setStatusUpdating(true);
        try {
            await axiosInstance.put(`/hrms/support/tickets/${id}/status`, { status: newStatus });
            toast.success(`Status updated to ${newStatus}`);
            setTicket(prev => ({ ...prev, status: newStatus }));
        } catch (error) {
            console.error(error);
            toast.error('Failed to update status');
        } finally {
            setStatusUpdating(false);
        }
    };

    const assignToMe = async () => {
        setAssigning(true);
        try {
            await axiosInstance.put(`/hrms/support/tickets/${id}/assign`, { adminId: currentUser.userId || currentUser._id });
            toast.success('Ticket assigned to you');
            await fetchTicket();
        } catch (error) {
            console.error(error);
            toast.error('Failed to assign ticket');
        } finally {
            setAssigning(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[500px]">
                <Loader2 className="w-8 h-8 animate-spin text-[#6412c6]" />
            </div>
        );
    }

    if (!ticket) return null;

    const employee = ticket.employeeId;
    const adminDetails = employee?.adminId || {};
    const isClosed = ticket.status === 'Closed' || ticket.status === 'Resolved';

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-6rem)]">
            
            {/* Left side: Chat Interface */}
            <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden min-h-[400px]">
                {/* Chat Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/ecs/hrms/support/requests')}
                            className="p-1.5 -ml-1.5 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-bold text-slate-800">{ticket.subject}</h2>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 uppercase tracking-wider">{ticket.ticketId}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                <span>{ticket.category}</span>
                                <span>•</span>
                                <span className={`font-semibold ${ticket.priority === 'Urgent' ? 'text-red-500' : ticket.priority === 'High' ? 'text-amber-500' : ''}`}>{ticket.priority} Priority</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
                    {messages.map((msg, index) => {
                        const isAdmin = msg.senderType === 'Admin';
                        return (
                            <div key={msg._id || index} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                                <div className={`flex items-end gap-2 max-w-[85%] sm:max-w-[75%] ${isAdmin ? 'flex-row-reverse' : 'flex-row'}`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${isAdmin ? 'bg-gradient-to-br from-[#6412c6] to-amber-500 text-white' : 'bg-gradient-to-br from-slate-700 to-slate-900 text-white'}`}>
                                        {isAdmin ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
                                    </div>
                                    
                                    <div className={`flex flex-col gap-1 ${isAdmin ? 'items-end' : 'items-start'}`}>
                                        <span className="text-[10px] font-medium text-slate-400 px-1">
                                            {isAdmin ? 'You / Support' : adminDetails.name} • {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        
                                        <div className={`p-4 ${
                                            isAdmin 
                                                ? 'bg-[#f7f3fc] text-slate-800 rounded-br-none border border-[#f0e7f9]' 
                                                : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-sm'
                                        }`}>
                                            {msg.message && (
                                                <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                                            )}
                                            
                                            {msg.attachments && msg.attachments.length > 0 && (
                                                <div className={`flex flex-wrap gap-2 ${msg.message ? 'mt-3 pt-3 border-t' : ''} ${isAdmin ? 'border-[#9359d7]/50' : 'border-slate-100'}`}>
                                                    {msg.attachments.map((att, i) => (
                                                        <a 
                                                            key={i} 
                                                            href={att.url} 
                                                            target="_blank" 
                                                            rel="noreferrer"
                                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                                                                isAdmin 
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

                {/* Input */}
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
                        <div className="flex items-end gap-3">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading || sending || isClosed}
                                className="p-3.5 text-slate-400 hover:text-[#6412c6] hover:bg-[#f7f3fc] rounded-xl transition-all disabled:opacity-50 shrink-0"
                            >
                                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                            </button>
                            <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                            
                            <textarea
                                value={replyText}
                                onChange={e => setReplyText(e.target.value)}
                                disabled={isClosed}
                                placeholder={isClosed ? "Ticket is closed" : "Type reply to employee..."}
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f0e7f9] focus:border-[#9359d7] resize-none max-h-32 min-h-[50px] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#d8c4f1] [&::-webkit-scrollbar-thumb]:rounded-full disabled:bg-slate-100 disabled:cursor-not-allowed"
                                rows={1}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); }
                                }}
                            />
                            
                            <button
                                type="submit"
                                disabled={sending || isClosed || (!replyText.trim() && attachments.length === 0)}
                                className="p-3.5 bg-[#6412c6] text-white rounded-xl hover:bg-[#550fa8] transition-all shadow-sm shadow-[#6412c6]/20 disabled:opacity-50 disabled:shadow-none shrink-0"
                            >
                                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Right side: Ticket Info & Actions */}
            <div className="w-full lg:w-80 flex flex-col gap-6 overflow-y-auto shrink-0">
                {/* Actions Panel */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5">
                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Manage Ticket</h3>
                    
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500">Status</label>
                        <select
                            value={ticket.status}
                            onChange={(e) => changeStatus(e.target.value)}
                            disabled={statusUpdating}
                            className={`w-full px-3 py-2 border rounded-xl text-sm font-medium focus:outline-none transition-colors ${
                                ticket.status === 'Open' ? 'bg-[#f7f3fc] text-[#460d8b] border-[#d8c4f1]' :
                                ticket.status === 'In Progress' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                ticket.status === 'Waiting for Employee' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                ticket.status === 'Resolved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                'bg-slate-50 text-slate-700 border-slate-200'
                            }`}
                        >
                            <option value="Open">Open</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Waiting for Employee">Waiting for Employee</option>
                            <option value="Resolved">Resolved</option>
                            <option value="Closed">Closed</option>
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500">Assignment</label>
                        {ticket.assignedAdminId ? (
                            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
                                <span className="text-sm font-medium text-slate-700 truncate">{ticket.assignedAdminId.name}</span>
                                {/* Add a simple unassign option or leave as is */}
                            </div>
                        ) : (
                            <button
                                onClick={assignToMe}
                                disabled={assigning}
                                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
                            >
                                {assigning ? 'Assigning...' : 'Assign to Me'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Employee Profile */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-4">Requester Details</h3>
                    
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                            {adminDetails.profileImage ? (
                                <img src={adminDetails.profileImage} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <UserCircle className="w-8 h-8 text-slate-300" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate">{adminDetails.name}</p>
                            <p className="text-xs font-medium text-[#550fa8] bg-[#f7f3fc] px-2 py-0.5 rounded inline-block mt-1 uppercase tracking-wider">{employee.employeeId || 'No ID'}</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center gap-2.5 text-sm text-slate-600">
                            <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="truncate">{employee.designation || 'N/A'} ({employee.department || 'N/A'})</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-sm text-slate-600">
                            <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="truncate">{adminDetails.email}</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-sm text-slate-600">
                            <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="truncate">{adminDetails.phone || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-sm text-slate-600">
                            <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="truncate">{employee.workLocation || 'N/A'}</span>
                        </div>
                    </div>
                    
                    <button
                        onClick={() => navigate(`/ecs/hrms/employees?search=${encodeURIComponent(adminDetails.name)}`)}
                        className="w-full mt-5 bg-white border border-slate-200 text-slate-600 hover:text-[#550fa8] hover:border-[#c1a0e8] px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                    >
                        View Full Profile
                    </button>
                </div>
            </div>
        </div>
    );
}
