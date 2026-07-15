import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, X, CreditCard, ExternalLink, Image as ImageIcon, RefreshCcw } from 'lucide-react';
import { adminApi } from '../services/adminApi';
import Loader from '@food/components/Loader';
import dayjs from 'dayjs';
import io from 'socket.io-client';
import { API_BASE_URL } from '@core/api/axios';

export default function AdminReturnDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [approvals, setApprovals] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchDetail();
    
    // Connect to Admin Socket for Live Updates
    const token = localStorage.getItem('admin_accessToken') || localStorage.getItem('accessToken');
    const socketOrigin = new URL(API_BASE_URL).origin;
    
    const socket = io(socketOrigin, {
      path: '/socket.io/',
      transports: ['polling'],
      auth: { token },
    });

    socket.on('return_leg_updated', (data) => {
      // Could check if data.sellerReturnId is in our legs, but for simplicity we'll just refetch
      fetchDetail();
    });

    return () => {
      socket.disconnect();
    };
  }, [id]);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getReturnDetails(id);
      const details = res?.data?.result || res?.data;
      setData(details);
      
      // Initialize approvals state
      if (details?.returnRequest?.items) {
        const initialApprovals = {};
        details.returnRequest.items.forEach(item => {
          if (item.approval?.status !== 'pending') {
            initialApprovals[item.productId] = {
              status: item.approval.status,
              approvedQty: item.approval.approvedQty,
            };
          } else {
            initialApprovals[item.productId] = {
              status: 'approved',
              approvedQty: item.quantity,
            };
          }
        });
        setApprovals(initialApprovals);
      }
    } catch (error) {
      console.error('Failed to fetch return details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprovalChange = (productId, field, value) => {
    setApprovals(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value
      }
    }));
  };

  const submitApprovals = async () => {
    const approvalsList = Object.keys(approvals).map(productId => ({
      productId,
      status: approvals[productId].status,
      approvedQty: approvals[productId].status === 'approved' ? Number(approvals[productId].approvedQty) : 0,
      note: 'Admin review'
    }));

    try {
      setSubmitting(true);
      await adminApi.approveReturn(id, approvalsList);
      fetchDetail(); // refresh
    } catch (error) {
      alert(error?.message || 'Failed to submit approvals');
    } finally {
      setSubmitting(false);
    }
  };

  const processRefund = async (legId) => {
    if (!window.confirm('Process refund for this seller leg?')) return;
    try {
      setSubmitting(true);
      await adminApi.refundReturnLeg(legId);
      alert('Refund processed successfully');
      fetchDetail();
    } catch (error) {
      alert(error?.message || 'Failed to process refund');
    } finally {
      setSubmitting(false);
    }
  };

  const reassignRider = async (legId) => {
    if (!window.confirm('Force re-assignment of rider for this leg?')) return;
    try {
      setSubmitting(true);
      await adminApi.triggerAutoAssign(legId);
      alert('Rider reassignment triggered');
      fetchDetail();
    } catch (error) {
      alert(error?.message || 'Failed to reassign rider');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !data) return <div className="p-10 flex justify-center"><Loader /></div>;
  if (!data || !data.returnRequest) return <div className="p-10 text-center text-red-500">Return request not found</div>;

  const { returnRequest, legs, history, user } = data;
  const isReviewPending = ['RETURN_REQUESTED', 'UNDER_ADMIN_REVIEW'].includes(returnRequest.status);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Return #{returnRequest.returnId}</h1>
            <p className="text-sm text-gray-500 mt-1">
              Order #{returnRequest.orderId} • Requested {dayjs(returnRequest.requestedAt).format('DD MMM YYYY, hh:mm A')}
            </p>
          </div>
        </div>
        <div>
          <span className="px-4 py-2 rounded-full text-sm font-bold bg-blue-100 text-blue-800 uppercase">
            {returnRequest.status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items Review */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Returned Items</h2>
            <div className="space-y-4">
              {returnRequest.items.map(item => {
                const approvalState = approvals[item.productId] || { status: 'pending', approvedQty: item.quantity };
                
                return (
                  <div key={item.productId} className="flex gap-4 p-4 rounded-xl border border-gray-50 bg-gray-50/50">
                    <img src={item.image || '/placeholder.png'} className="w-16 h-16 rounded-lg object-cover bg-gray-100" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800">{item.name}</h4>
                      <div className="text-sm text-gray-500 flex gap-4 mt-1">
                        <span>Qty: {item.quantity}</span>
                        <span>Price: ₹{item.price}</span>
                        <span>Total: ₹{item.price * item.quantity}</span>
                      </div>
                      <div className="mt-2 text-sm text-red-600 bg-red-50 inline-block px-2 py-0.5 rounded">
                        Reason: {item.reason}
                      </div>
                    </div>
                    
                    {/* Approval Controls */}
                    {isReviewPending ? (
                      <div className="w-48 bg-white p-2 rounded-lg border shadow-sm flex flex-col gap-2">
                        <select 
                          className="w-full border rounded text-sm p-1.5 focus:outline-none"
                          value={approvalState.status}
                          onChange={(e) => handleApprovalChange(item.productId, 'status', e.target.value)}
                        >
                          <option value="approved">Approve</option>
                          <option value="rejected">Reject</option>
                        </select>
                        {approvalState.status === 'approved' && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Qty to Refund:</span>
                            <input 
                              type="number" 
                              min="1" 
                              max={item.quantity} 
                              className="w-full border rounded text-sm p-1 px-2"
                              value={approvalState.approvedQty}
                              onChange={(e) => handleApprovalChange(item.productId, 'approvedQty', e.target.value)}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-right">
                        <div className={`text-sm font-bold px-2 py-1 rounded ${item.approval?.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {item.approval?.status?.toUpperCase()}
                        </div>
                        {item.approval?.status === 'approved' && (
                          <div className="text-xs text-gray-500 mt-1">
                            Approved Qty: {item.approval?.approvedQty}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {isReviewPending && (
              <div className="mt-6 flex justify-end">
                <button 
                  onClick={submitApprovals}
                  disabled={submitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg shadow disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Submitting...' : 'Submit Review Decisions'}
                </button>
              </div>
            )}
          </div>

          {/* Seller Legs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Seller Return Legs</h2>
            <div className="space-y-4">
              {legs.map(leg => (
                <div key={leg._id} className="p-4 border rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h4 className="font-bold text-gray-800">Seller ID: {leg.sellerId}</h4>
                    <p className="text-sm text-gray-500">Status: <strong className="text-gray-700">{leg.returnStatus}</strong></p>
                    <p className="text-sm text-gray-500">Refund Amount: ₹{leg.returnRefundAmount || 0}</p>
                    {leg.assignment?.deliveryPartnerId && (
                      <div className="mt-2 flex items-center gap-3">
                        <p className="text-sm text-blue-600 font-medium">Assigned Rider: {leg.assignment.deliveryPartnerId}</p>
                        {['RETURN_PICKUP_ASSIGNED', 'PICKUP_EN_ROUTE', 'PICKUP_REACHED'].includes(leg.returnStatus) && (
                          <button 
                            onClick={() => reassignRider(leg._id)}
                            disabled={submitting}
                            className="text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition-colors flex items-center gap-1"
                          >
                            <RefreshCcw className="w-3 h-3" /> Reassign
                          </button>
                        )}
                      </div>
                    )}
                    {leg.pickupProofImages && leg.pickupProofImages.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-bold text-gray-500 uppercase mb-1">Rider Pickup Proof</p>
                        <div className="flex gap-2">
                          {leg.pickupProofImages.map((img, idx) => (
                            <a key={idx} href={img} target="_blank" rel="noreferrer">
                              <img src={img} className="w-12 h-12 rounded object-cover border border-gray-200" alt="proof" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    {leg.returnStatus === 'REFUND_PENDING' && (
                      <button 
                        onClick={() => processRefund(leg._id)}
                        disabled={submitting}
                        className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50"
                      >
                        <CreditCard className="w-4 h-4" />
                        Process Refund
                      </button>
                    )}
                    {leg.returnStatus === 'REFUND_COMPLETED' && (
                      <span className="flex items-center gap-1 text-green-600 font-bold bg-green-50 px-3 py-1 rounded-full">
                        <Check className="w-4 h-4" /> Refunded
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col */}
        <div className="space-y-6">
          {/* Customer Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-base font-bold text-gray-900 mb-3">Customer Information</h2>
            {user ? (
              <div className="space-y-2 text-sm">
                <p><span className="text-gray-500 w-20 inline-block">Name:</span> {user.name || user.firstName}</p>
                <p><span className="text-gray-500 w-20 inline-block">Phone:</span> {user.phone?.number}</p>
                <p><span className="text-gray-500 w-20 inline-block">Email:</span> {user.email || 'N/A'}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Customer details unavailable</p>
            )}
          </div>

          {/* Evidence Images */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
              <ImageIcon className="w-4 h-4" /> User Evidence
            </h2>
            {returnRequest.images && returnRequest.images.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {returnRequest.images.map((img, i) => (
                  <a key={i} href={img} target="_blank" rel="noreferrer" className="block relative group overflow-hidden rounded-lg border border-gray-200">
                    <img src={img} alt="Evidence" className="w-full h-24 object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <ExternalLink className="w-5 h-5 text-white" />
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No images provided</p>
            )}
            
            {returnRequest.notes && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg border text-sm text-gray-700">
                <strong>Notes:</strong> {returnRequest.notes}
              </div>
            )}
          </div>

          {/* History */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-base font-bold text-gray-900 mb-3">Audit Trail</h2>
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
              {history.map((log, i) => (
                <div key={i} className="relative pl-4 border-l-2 border-gray-200">
                  <div className="absolute -left-1.5 top-1.5 w-2.5 h-2.5 rounded-full bg-gray-300 border-2 border-white"></div>
                  <p className="text-xs text-gray-500 mb-0.5">{dayjs(log.createdAt).format('DD MMM YYYY, HH:mm')}</p>
                  <p className="text-sm font-medium text-gray-800">{log.toStatus.replace(/_/g, ' ')}</p>
                  {log.note && <p className="text-xs text-gray-600 mt-1">{log.note}</p>}
                  <p className="text-xs text-gray-400 mt-1">By: {log.actor.role} {log.actor.name ? `(${log.actor.name})` : ''}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
