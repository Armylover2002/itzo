import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, XCircle, Package, Truck, Store, Receipt } from 'lucide-react';
import { returnApi } from '../../services/returnApi';
import Loader from '@food/components/Loader';
import { socket } from '../../../../../core/services/socket';

const TIMELINE_STEPS = [
  { id: 'RETURN_REQUESTED', label: 'Requested', icon: Package },
  { id: 'UNDER_ADMIN_REVIEW', label: 'Under Review', icon: Clock },
  { id: 'APPROVED', label: 'Approved', icon: CheckCircle2 },
  { id: 'IN_PROGRESS', label: 'In Progress', icon: Truck },
  { id: 'COMPLETED', label: 'Completed', icon: Store },
  { id: 'REFUND_COMPLETED', label: 'Refunded', icon: Receipt },
];

export default function ReturnDetailPage() {
  const { returnRequestId } = useParams();
  const navigate = useNavigate();
  const [returnDetails, setReturnDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDetail();
    
    // Socket listener for real-time updates
    if (socket) {
      const handleStatusUpdate = (data) => {
        if (data.returnRequestId === returnRequestId) {
          setReturnDetails(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              returnRequest: {
                ...prev.returnRequest,
                status: data.status,
              }
            };
          });
          // Also refetch to get updated legs/history
          fetchDetail();
        }
      };

      socket.on('return_status_updated', handleStatusUpdate);
      return () => {
        socket.off('return_status_updated', handleStatusUpdate);
      };
    }
  }, [returnRequestId]);

  const fetchDetail = async () => {
    try {
      const res = await returnApi.getReturnDetail(returnRequestId);
      setReturnDetails(res.data);
    } catch (error) {
      console.error('Failed to fetch return details', error);
    } finally {
      setLoading(false);
    }
  };

  const cancelRequest = async () => {
    try {
      await returnApi.cancelReturn(returnRequestId, 'User cancelled');
      fetchDetail();
    } catch (error) {
      console.error('Cancel failed', error);
    }
  };

  if (loading) return <Loader />;
  if (!returnDetails || !returnDetails.returnRequest) return <div className="p-4 text-center mt-10">Return not found</div>;

  const { returnRequest, legs, history } = returnDetails;
  
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

  const isTerminal = ['CANCELLED', 'REJECTED', 'EXPIRED', 'REFUND_COMPLETED'].includes(status);
  const isCancellable = ['RETURN_REQUESTED', 'UNDER_ADMIN_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED'].includes(status);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white sticky top-0 z-30 shadow-sm border-b">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 mr-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Return Details</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Status Card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Return ID</p>
              <h2 className="text-sm font-bold text-gray-900">{returnRequest.returnId}</h2>
            </div>
            {isCancellable && (
              <button 
                onClick={cancelRequest}
                className="text-xs font-medium text-red-500 bg-red-50 px-3 py-1.5 rounded-full hover:bg-red-100 transition-colors"
              >
                Cancel Return
              </button>
            )}
          </div>
          
          {/* Vertical Timeline */}
          {currentStepIndex >= 0 ? (
            <div className="relative pl-3 space-y-6 my-6">
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

        {/* OTP Section for active pickup */}
        {status === 'IN_PROGRESS' && legs.some(l => ['RETURN_PICKUP_ASSIGNED', 'PICKUP_EN_ROUTE', 'PICKUP_REACHED'].includes(l.returnStatus)) && (
          <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-orange-800 mb-2">Delivery Partner Assigned</h3>
            <p className="text-sm text-orange-700 mb-3">Please keep your items packed and ready. Share the pickup OTP with the agent when they arrive.</p>
            <button 
              onClick={async () => {
                const activeLeg = legs.find(l => ['RETURN_PICKUP_ASSIGNED', 'PICKUP_EN_ROUTE', 'PICKUP_REACHED'].includes(l.returnStatus));
                if (activeLeg) {
                   try {
                     await returnApi.resendOtp(activeLeg._id);
                     alert('OTP sent successfully');
                   } catch (err) {
                     alert(err.message || 'Failed to resend OTP');
                   }
                }
              }}
              className="text-sm font-medium bg-orange-500 text-white px-4 py-2 rounded-lg shadow-sm"
            >
              Resend OTP via SMS
            </button>
          </div>
        )}

        {/* Items */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">Returned Items</h3>
          <div className="space-y-4">
            {returnRequest.items.map((item, idx) => (
              <div key={idx} className="flex gap-4">
                <div className="w-16 h-16 rounded-xl bg-gray-50 border border-gray-100 flex-shrink-0 overflow-hidden">
                  <img src={item.image || '/placeholder.png'} alt={item.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-gray-900">{item.name}</h4>
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                    <p className="text-sm font-bold text-gray-900">₹{item.price * item.quantity}</p>
                  </div>
                  {item.approval && item.approval.status !== 'pending' && (
                    <div className="mt-2 text-xs font-medium px-2 py-1 bg-gray-100 rounded-md inline-block">
                      Status: <span className={item.approval.status === 'approved' ? 'text-green-600' : 'text-red-500'}>
                        {item.approval.status.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
