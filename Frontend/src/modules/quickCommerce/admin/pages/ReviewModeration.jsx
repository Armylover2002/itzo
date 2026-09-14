import React, { useState, useEffect } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import Pagination from '@shared/components/ui/Pagination';
import { PAGINATION_CONFIG } from '@/shared/constants/pagination';
import { adminApi } from '../services/adminApi';
import {
    HiOutlineStar,
    HiOutlineTrash,
    HiOutlineShieldCheck,
    HiOutlineExclamationTriangle,
    HiOutlineChatBubbleBottomCenterText,
    HiOutlineHandThumbUp,
    HiOutlineMagnifyingGlass,
    HiOutlineBuildingStorefront
} from 'react-icons/hi2';
import { useToast } from '@shared/components/ui/Toast';
import Modal from '@shared/components/ui/Modal';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const ReviewModeration = () => {
    const { showToast } = useToast();
    const [isReplyModalOpen, setIsReplyModalOpen] = useState(false);
    const [selectedReview, setSelectedReview] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [loading, setLoading] = useState(true);
    const [reviews, setReviews] = useState([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGINATION_CONFIG.defaultPageSize);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        fetchReviews(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageSize]);

    const fetchReviews = async (requestedPage = 1) => {
        try {
            setLoading(true);
            const res = await adminApi.getPendingReviews({ page: requestedPage, limit: pageSize });
            if (res.data.success) {
                const payload = res.data.result || {};
                const data = Array.isArray(payload.items) ? payload.items : (res.data.results || []);
                setReviews(data.map(r => ({
                    ...r,
                    id: r._id,
                    user: r.userId?.name || "Anonymous",
                    item: r.productId?.name || "Deleted Product",
                    itemImage: r.productId?.images?.[0],
                    date: new Date(r.createdAt).toLocaleString(),
                    tags: [] // Tags can be empty or logic-based
                })));
                setTotal(typeof payload.total === 'number' ? payload.total : data.length);
                setPage(typeof payload.page === 'number' ? payload.page : requestedPage);
            }
        } catch (error) {
            console.error("Fetch Reviews Error:", error);
            showToast("Failed to load reviews", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id) => {
        try {
            const res = await adminApi.updateReviewStatus(id, 'approved');
            if (res.data.success) {
                setReviews(reviews.filter(r => r.id !== id));
                fetchReviews(page);
                showToast('Review approved and published', 'success');
            }
        } catch (error) {
            showToast("Failed to approve review", "error");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to reject and remove this review?')) return;
        try {
            const res = await adminApi.updateReviewStatus(id, 'rejected');
            if (res.data.success) {
                setReviews(reviews.filter(r => r.id !== id));
                fetchReviews(page);
                showToast('Review rejected and removed', 'warning');
            }
        } catch (error) {
            showToast("Failed to remove review", "error");
        }
    };

    const handleReplyClick = (review) => {
        setSelectedReview(review);
        setIsReplyModalOpen(true);
    };

    const submitReply = () => {
        if (!replyText.trim()) return;
        // Reply logic for reviews is usually public or private. 
        // For now we'll just show toast since we don't have review-reply model yet
        showToast(`Reply noted for ${selectedReview.user}`, 'success');
        setIsReplyModalOpen(false);
        setReplyText('');
    };

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1">
                <div>
                    <h1 className="ds-h1">Moderation Suite</h1>
                    <p className="ds-description mt-0.5">Protect community integrity and store reputations.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button className="px-5 py-2 rounded-lg text-[10px] font-black uppercase bg-white text-slate-900 shadow-sm">ALL REVIEWS</button>
                        <button className="px-5 py-2 rounded-lg text-[10px] font-black uppercase text-slate-400 hover:text-slate-600">FLAGGED ONLY</button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {reviews.map((r) => (
                    <Card key={r.id} className="p-4 border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl group overflow-hidden relative">
                        {/* Decorative background icon */}
                        <HiOutlineChatBubbleBottomCenterText className="absolute -top-6 -right-6 h-32 w-32 text-slate-50 opacity-[0.03] group-hover:scale-110 transition-transform duration-1000" />

                        <div className="flex flex-col lg:flex-row gap-4 relative z-10">
                            {/* User Info & Rating */}
                            <div className="lg:w-64 shrink-0 space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-2xl bg-red-600 text-white flex items-center justify-center font-black ds-h2">
                                        {r.user[0]}
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-slate-900">{r.user}</h4>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{r.date}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    {[...Array(5)].map((_, i) => (
                                        <HiOutlineStar
                                            key={i}
                                            className={cn("h-4 w-4", i < r.rating ? "text-amber-400 fill-amber-400" : "text-slate-200")}
                                        />
                                    ))}
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-slate-500">
                                        <HiOutlineBuildingStorefront className="h-4 w-4" />
                                        <span className="text-[11px] font-bold">{r.store}</span>
                                    </div>
                                    <p className="text-[10px] font-black text-primary uppercase tracking-tighter">Item: {r.item}</p>
                                </div>
                            </div>

                            {/* Comment & Status */}
                            <div className="flex-1 space-y-4">
                                <div className="flex items-center gap-2 flex-wrap">
                                    {r.status === 'flagged' && (
                                        <Badge variant="danger" className="text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                                            <HiOutlineExclamationTriangle className="h-3 w-3" />
                                            FLAGGED BY SYSTEM
                                        </Badge>
                                    )}
                                    {r.tags.map((tag, i) => (
                                        <Badge key={i} variant="secondary" className="text-[8px] font-bold text-slate-400 bg-slate-50 border-none px-2">{tag}</Badge>
                                    ))}
                                </div>
                                <blockquote className="text-sm font-medium text-slate-700 leading-relaxed bg-slate-50/50 p-5 rounded-2xl italic italic border-l-4 border-slate-100">
                                    "{r.comment}"
                                </blockquote>
                            </div>

                            {/* Actions */}
                            <div className="lg:w-48 flex lg:flex-col items-center justify-center gap-3">
                                {r.status !== 'approved' && (
                                    <button
                                        onClick={() => handleApprove(r.id)}
                                        className="flex-1 w-full flex items-center justify-center gap-2 py-3 bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all active:scale-95"
                                    >
                                        <HiOutlineShieldCheck className="h-4 w-4" />
                                        APPROVE
                                    </button>
                                )}
                                <button
                                    onClick={() => handleDelete(r.id)}
                                    className="flex-1 w-full flex items-center justify-center gap-2 py-3 bg-white text-rose-500 ring-1 ring-rose-100 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 transition-all active:scale-95"
                                >
                                    <HiOutlineTrash className="h-4 w-4" />
                                    REMOVE
                                </button>
                                <button
                                    onClick={() => handleReplyClick(r)}
                                    className="flex-1 w-full flex items-center justify-center gap-2 py-3 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-red-700 transition-all active:scale-95"
                                >
                                    REPLY
                                </button>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
            <div className="mt-6 flex justify-center">
                <Pagination
                    page={page}
                    totalPages={Math.ceil(total / pageSize) || 1}
                    total={total}
                    pageSize={pageSize}
                    onPageChange={(p) => fetchReviews(p)}
                    onPageSizeChange={(newSize) => {
                        setPageSize(newSize);
                        setPage(1);
                    }}
                    loading={loading}
                />
            </div>

            <Modal
                isOpen={isReplyModalOpen}
                onClose={() => setIsReplyModalOpen(false)}
                title="Send Public Response"
            >
                <div className="space-y-4">
                    {selectedReview && (
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Review from {selectedReview.user}</p>
                            <p className="text-xs font-medium text-slate-600 italic">"{selectedReview.comment}"</p>
                        </div>
                    )}
                    <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write your official response..."
                        className="w-full bg-slate-100 border-none rounded-2xl p-4 text-sm font-bold min-h-[120px] outline-none ring-1 ring-transparent focus:ring-primary/20"
                    />
                    <div className="flex gap-3">
                        <button
                            onClick={() => setIsReplyModalOpen(false)}
                            className="flex-1 py-4 bg-slate-100 text-slate-400 text-[10px] font-black uppercase rounded-2xl"
                        >
                            CANCEL
                        </button>
                        <button
                            onClick={submitReply}
                            className="flex-1 py-4 bg-primary text-white text-[10px] font-black uppercase rounded-2xl shadow-lg shadow-primary/20"
                        >
                            PUBLISH REPLY
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default ReviewModeration;
