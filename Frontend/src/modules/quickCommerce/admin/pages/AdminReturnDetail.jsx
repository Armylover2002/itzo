import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, X, CreditCard, ExternalLink, Image as ImageIcon, RefreshCcw, CheckCircle2, Clock, XCircle, Package, Truck, Store, Receipt, FastForward, UserPlus, Search, Loader2, Phone, Circle } from 'lucide-react';

const TIMELINE_STEPS = [
  { id: 'RETURN_REQUESTED', label: 'Requested', icon: Package },
  { id: 'UNDER_ADMIN_REVIEW', label: 'Under Review', icon: Clock },
  { id: 'APPROVED', label: 'Approved', icon: CheckCircle2 },
  { id: 'IN_PROGRESS', label: 'In Progress', icon: Truck },
  { id: 'COMPLETED', label: 'Completed', icon: Store },
  { id: 'REFUND_COMPLETED', label: 'Refunded', icon: Receipt },
];
import { adminApi } from '../services/adminApi';
import Loader from '@food/components/Loader';
import dayjs from 'dayjs';
import io from 'socket.io-client';
import { API_BASE_URL } from '@food/api/config';

// ─── Assign Delivery Boy Modal ──────────────────────────────────────────────

function AssignDeliveryBoyModal({ legId, onClose, onAssigned }) {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [assigning, setAssigning] = useState(null);
  const searchTimeout = useRef(null);

  const fetchPartners = useCallback(async (searchTerm = '') => {
    setLoading(true);
    try {
      const res = await adminApi.getDeliveryPartnersForReturn({ search: searchTerm });
      const data = res?.data?.data || res?.data?.result || res?.data;
      setPartners(data?.partners || []);
    } catch (error) {
      console.error('Failed to fetch delivery partners:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearch(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      fetchPartners(value);
    }, 400);
  };

  const handleAssign = async (partnerId) => {
    if (assigning) return;
    setAssigning(partnerId);
    try {
      await adminApi.manualAssignDeliveryBoy(legId, partnerId);
      onAssigned();
      onClose();
    } catch (error) {
      alert(error?.response?.data?.message || error?.message || 'Failed to assign delivery boy');
    } finally {
      setAssigning(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-600" />
              Assign Delivery Boy
            </h3>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={search}
              onChange={handleSearchChange}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              autoFocus
            />
          </div>
        </div>

        {/* Partner List */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
          ) : partners.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <UserPlus className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm font-medium">No delivery partners found</p>
              <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
            </div>
          ) : (
            <div className="space-y-2">
              {partners.map(partner => {
                const isOnline = partner.availabilityStatus === 'online';
                const isAssigning = assigning === partner._id;

                return (
                  <div
                    key={partner._id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all group"
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {partner.profilePhoto ? (
                        <img src={partner.profilePhoto} className="w-10 h-10 rounded-full object-cover bg-gray-100" alt="" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                          <span className="text-sm font-bold text-blue-600">
                            {partner.name?.[0]?.toUpperCase() || '?'}
                          </span>
                        </div>
                      )}
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{partner.name}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                        <Phone className="w-3 h-3" />
                        <span>{partner.phone}</span>
                        {partner.city && (
                          <>
                            <span className="text-gray-300">•</span>
                            <span>{partner.city}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Status + Assign Button */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${isOnline ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                        {isOnline ? 'Online' : 'Offline'}
                      </span>
                      <button
                        onClick={() => handleAssign(partner._id)}
                        disabled={isAssigning}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        {isAssigning ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                        Assign
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function AdminReturnDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [approvals, setApprovals] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [assignModalLegId, setAssignModalLegId] = useState(null);

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
      const details = res?.data?.data || res?.data?.result || res?.data;
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
    let method = 'wallet';
    const isOnline = data?.returnRequest?.originalPaymentMethod === 'razorpay' || data?.returnRequest?.originalPaymentMethod === 'razorpay_qr';

    if (isOnline) {
      if (!window.confirm('Was this order paid ONLINE via Razorpay?\n\n(Click OK for Yes/Razorpay, Click Cancel for No/COD)')) {
        // Fallback if they click Cancel
        method = 'wallet';
      } else {
        const wantWallet = window.confirm('Refund to User Wallet instead of original bank account?\n\n(Click OK for Wallet, Cancel for Original Source)');
        method = wantWallet ? 'wallet' : 'gateway';
      }
    } else {
      if (!window.confirm('Process refund to User Wallet for this COD order?')) return;
    }

    try {
      setSubmitting(true);
      await adminApi.refundReturnLeg(legId, { method });
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

  const { returnRequest, legs, history } = data;
  const isReviewPending = ['RETURN_REQUESTED', 'UNDER_ADMIN_REVIEW'].includes(returnRequest.status);

  // Extract customer info from populated userId field
  const customer = returnRequest.userId && typeof returnRequest.userId === 'object' ? returnRequest.userId : null;

  // Calculate current active step index based on status
  let currentStepIndex = 0;
  const status = returnRequest.status;
  
  if (status === 'RETURN_REQUESTED') currentStepIndex = 0;
  if (status === 'UNDER_ADMIN_REVIEW') currentStepIndex = 1;
  if (status === 'APPROVED' || status === 'PARTIALLY_APPROVED') currentStepIndex = 2;
  if (status === 'IN_PROGRESS') currentStepIndex = 3;
  if (status === 'COMPLETED' || status === 'PARTIALLY_COMPLETED' || status === 'REFUND_PENDING') currentStepIndex = 4;
  if (status === 'REFUND_COMPLETED') currentStepIndex = 5;
  if (status === 'CANCELLED' || status === 'REJECTED' || status === 'EXPIRED') currentStepIndex = -1;

  // Leg statuses that allow assignment (lowercase to match MongoDB values)
  const assignableStatuses = ['return_approved', 'partially_approved', 'pickup_pending', 'failed_pickup'];
  // Leg statuses where reassignment is possible
  const reassignableStatuses = ['return_pickup_assigned', 'pickup_en_route', 'pickup_reached', 'pickup_otp_pending'];

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
              {legs.map(leg => {
                const hasAssignedRider = !!leg.assignment?.deliveryPartnerId;
                const canAssign = assignableStatuses.includes(leg.returnStatus);
                const canReassign = reassignableStatuses.includes(leg.returnStatus) && hasAssignedRider;
                const canRequestPickup = canAssign && !hasAssignedRider;

                return (
                  <div key={leg._id} className="p-4 border rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-800">
                        Seller: {leg.sellerId?.shopName || leg.sellerId?.name || (typeof leg.sellerId === 'string' ? leg.sellerId : 'Unknown')}
                      </h4>
                      <p className="text-sm text-gray-500">Status: <strong className="text-gray-700">{leg.returnStatus}</strong></p>
                      <p className="text-sm text-gray-500">Refund Amount: ₹{leg.returnRefundAmount || 0}</p>
                      
                      {/* Assigned Rider Info */}
                      {hasAssignedRider && (
                        <div className="mt-2 flex items-center gap-3">
                          <p className="text-sm text-blue-600 font-medium">
                            Assigned Rider: {leg.assignment.deliveryPartnerId?.name || (typeof leg.assignment.deliveryPartnerId === 'string' ? leg.assignment.deliveryPartnerId : 'Unknown')}
                            {leg.assignment.deliveryPartnerId?.phone && (
                              <span className="text-gray-400 ml-1">({leg.assignment.deliveryPartnerId.phone})</span>
                            )}
                          </p>
                          {canReassign && (
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

                      {/* Manual Assign / Request Pickup Buttons */}
                      {canAssign && (
                        <div className="mt-2 flex items-center gap-2">
                          <button 
                            onClick={() => setAssignModalLegId(leg._id)}
                            disabled={submitting}
                            className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded transition-colors flex items-center gap-1"
                          >
                            <UserPlus className="w-3 h-3" /> Assign Delivery Boy
                          </button>
                          <button 
                            onClick={() => reassignRider(leg._id)}
                            disabled={submitting}
                            className="text-xs font-bold text-gray-600 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded transition-colors flex items-center gap-1"
                          >
                            <FastForward className="w-3 h-3" /> Auto Assign
                          </button>
                        </div>
                      )}

                      {/* Reassign option for already assigned legs */}
                      {canReassign && (
                        <div className="mt-1">
                          <button 
                            onClick={() => setAssignModalLegId(leg._id)}
                            disabled={submitting}
                            className="text-xs font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded transition-colors flex items-center gap-1"
                          >
                            <UserPlus className="w-3 h-3" /> Change Delivery Boy
                          </button>
                        </div>
                      )}

                      {/* Pickup Proof Images */}
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
                    <div className="flex flex-col gap-2">
                      {/* Refund button - using lowercase leg status values */}
                      {leg.returnStatus === 'refund_pending' && (
                        <button 
                          onClick={() => processRefund(leg._id)}
                          disabled={submitting}
                          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50"
                        >
                          <CreditCard className="w-4 h-4" />
                          Process Refund
                        </button>
                      )}
                      {leg.returnStatus === 'refund_completed' && (
                        <span className="flex items-center gap-1 text-green-600 font-bold bg-green-50 px-3 py-1 rounded-full">
                          <Check className="w-4 h-4" /> Refunded
                        </span>
                      )}
                      {(leg.returnStatus === 'return_completed' || leg.returnStatus === 'returned') && (
                        <span className="flex items-center gap-1 text-blue-600 font-bold bg-blue-50 px-3 py-1 rounded-full text-sm">
                          <CheckCircle2 className="w-4 h-4" /> Return Complete
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Col */}
        <div className="space-y-6">
          {/* Status Tracking */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-base font-bold text-gray-900 mb-3">Return Status Tracking</h2>
            {currentStepIndex >= 0 ? (
              <div className="relative pl-3 space-y-6 mt-4 mb-2">
                <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-gray-100"></div>
                {TIMELINE_STEPS.map((step, idx) => {
                  const isActive = idx === currentStepIndex;
                  const isPast = idx < currentStepIndex;
                  const Icon = step.icon;
                  
                  return (
                    <div key={step.id} className="relative flex items-start gap-4">
                      <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center border-2 
                        ${isPast || isActive ? 'bg-green-50 border-green-500 text-green-600' : 'bg-white border-gray-200 text-gray-400'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="pt-1">
                        <p className={`text-sm font-medium ${isPast || isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                          {step.label}
                        </p>
                        {isActive && (
                          <p className="text-xs text-green-600 mt-0.5 font-medium">Currently active</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-red-50 text-red-700 p-4 rounded-xl flex items-center gap-3">
                <XCircle className="w-6 h-6" />
                <div>
                  <p className="font-bold">Return {status.replace('_', ' ')}</p>
                  <p className="text-sm mt-0.5 opacity-90">{returnRequest.cancellationReason || 'This return request has been closed.'}</p>
                </div>
              </div>
            )}
          </div>

          {/* Customer Info — Fixed to read from populated returnRequest.userId */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-base font-bold text-gray-900 mb-3">Customer Information</h2>
            {customer ? (
              <div className="space-y-2 text-sm">
                <p><span className="text-gray-500 w-20 inline-block">Name:</span> {customer.name || 'N/A'}</p>
                <p><span className="text-gray-500 w-20 inline-block">Phone:</span> {customer.phone?.number || customer.phone || 'N/A'}</p>
                <p><span className="text-gray-500 w-20 inline-block">Email:</span> {customer.email || 'N/A'}</p>
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
                  <p className="text-xs text-gray-500 mb-0.5">{dayjs(log.createdAt || log.timestamp).format('DD MMM YYYY, HH:mm')}</p>
                  <p className="text-sm font-medium text-gray-800">{log.toStatus.replace(/_/g, ' ')}</p>
                  {log.note && <p className="text-xs text-gray-600 mt-1">{log.note}</p>}
                  <p className="text-xs text-gray-400 mt-1">By: {log.actor.role} {log.actor.name ? `(${log.actor.name})` : ''}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Assign Delivery Boy Modal */}
      {assignModalLegId && (
        <AssignDeliveryBoyModal
          legId={assignModalLegId}
          onClose={() => setAssignModalLegId(null)}
          onAssigned={fetchDetail}
        />
      )}
    </div>
  );
}
