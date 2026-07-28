import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { deliveryAPI } from '@food/api';
import { 
  ArrowLeft, Search, Package, AlertTriangle, 
  CheckCircle2, Clock, MapPin, Map, Loader2, RefreshCw,
  Navigation, Phone, ArrowRight, ChevronRight, Store, User, Truck,
  RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

// ── Status config: uses LOWERCASE values matching MongoDB ──────────────────
const getStatusConfig = (status) => {
  switch (status) {
    case 'return_pickup_assigned': return { label: 'Assigned', color: 'bg-orange-100 text-orange-700', icon: Truck, step: 1 };
    case 'pickup_en_route':        return { label: 'Heading to User', color: 'bg-orange-100 text-orange-700', icon: Navigation, step: 2 };
    case 'pickup_reached':         return { label: 'Reached User', color: 'bg-amber-100 text-amber-700', icon: MapPin, step: 3 };
    case 'pickup_otp_pending':     return { label: 'Verify Pickup OTP', color: 'bg-purple-100 text-purple-700', icon: Clock, step: 3 };
    case 'picked_up':              return { label: 'Items Picked Up', color: 'bg-teal-100 text-teal-700', icon: Package, step: 4 };
    case 'return_en_route':        return { label: 'Heading to Seller', color: 'bg-orange-100 text-orange-700', icon: Navigation, step: 5 };
    case 'return_in_transit':      return { label: 'In Transit', color: 'bg-orange-100 text-orange-700', icon: Truck, step: 5 };
    case 'return_reached_seller':  return { label: 'Reached Seller', color: 'bg-violet-100 text-violet-700', icon: Store, step: 6 };
    case 'seller_otp_pending':     return { label: 'Verify Seller OTP', color: 'bg-purple-100 text-purple-700', icon: Clock, step: 6 };
    case 'return_completed':       return { label: 'Completed', color: 'bg-green-100 text-green-700', icon: CheckCircle2, step: 7 };
    case 'returned':               return { label: 'Returned', color: 'bg-green-100 text-green-700', icon: CheckCircle2, step: 7 };
    case 'refund_pending':         return { label: 'Refund Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock, step: 8 };
    case 'refund_completed':       return { label: 'Refund Done', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2, step: 9 };
    case 'failed_pickup':          return { label: 'Pickup Failed', color: 'bg-red-100 text-red-700', icon: AlertTriangle, step: -1 };
    case 'failed_return':          return { label: 'Return Failed', color: 'bg-red-100 text-red-700', icon: AlertTriangle, step: -1 };
    case 'cancelled':              return { label: 'Cancelled', color: 'bg-gray-100 text-gray-700', icon: AlertTriangle, step: -1 };
    default: return { label: status?.replace(/_/g, ' ') || 'Unknown', color: 'bg-gray-100 text-gray-700', icon: Package, step: 0 };
  }
};

// Active statuses that allow actions
const ACTIVE_STATUSES = [
  'return_pickup_assigned', 'pickup_en_route', 'pickup_reached',
  'pickup_otp_pending', 'picked_up', 'return_en_route',
  'return_in_transit', 'return_reached_seller', 'seller_otp_pending'
];

const COMPLETED_STATUSES = ['return_completed', 'returned', 'refund_pending', 'refund_completed'];
const FAILED_STATUSES = ['failed_pickup', 'failed_return', 'cancelled'];

// ── Progress Bar ───────────────────────────────────────────────────────────

function ReturnProgressBar({ currentStep }) {
  const steps = [
    { label: 'Assigned', step: 1 },
    { label: 'En Route', step: 2 },
    { label: 'At User', step: 3 },
    { label: 'Picked Up', step: 4 },
    { label: 'To Seller', step: 5 },
    { label: 'At Seller', step: 6 },
    { label: 'Done', step: 7 },
  ];

  return (
    <div className="flex items-center gap-1 my-3">
      {steps.map((s, i) => (
        <div key={s.step} className="flex items-center flex-1">
          <div className={`h-1.5 w-full rounded-full transition-colors ${currentStep >= s.step ? 'bg-green-500' : currentStep === -1 ? 'bg-red-300' : 'bg-gray-200'}`} />
        </div>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function DeliveryReturns() {
  const navigate = useNavigate();
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState(null); // legId of the item being acted on

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      let statusParam = 'active';
      if (activeTab === 'completed') statusParam = 'return_completed';
      if (activeTab === 'all') statusParam = 'all';

      const res = await deliveryAPI.getAssignedReturns({ status: statusParam });
      if (res?.data?.success) {
        setReturns(res.data.data.returns || []);
      }
    } catch (err) {
      toast.error('Failed to fetch returns');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  const filteredReturns = returns.filter(r => {
    if (!searchQuery.trim()) return true;
    const s = searchQuery.toLowerCase();
    return (
      r.displayOrderId?.toLowerCase().includes(s) ||
      r._id.toLowerCase().includes(s) ||
      r.sellerId?.shopName?.toLowerCase().includes(s) ||
      r.userId?.name?.toLowerCase().includes(s)
    );
  });

  // ── Action Handlers ──────────────────────────────────────────────────────

  const handleGoToFeed = () => navigate('/food/delivery/feed');

  const handleAction = async (legId, action) => {
    setActionLoading(legId);
    try {
      switch (action) {
        case 'accept':
          await deliveryAPI.acceptReturnAssignment(legId);
          toast.success('Assignment accepted! Heading to user.');
          break;
        case 'reached_user':
          await deliveryAPI.markReturnReachedUser(legId);
          toast.success('Marked as reached user.');
          break;
        case 'heading_to_seller':
          await deliveryAPI.markReturnHeadingToSeller(legId);
          toast.success('Heading to seller.');
          break;
        case 'reached_seller':
          await deliveryAPI.markReturnReachedSeller(legId);
          toast.success('Reached seller, OTP sent.');
          break;
        default:
          break;
      }
      fetchReturns();
    } catch (err) {
      toast.error(err?.response?.data?.message || `Action failed: ${action}`);
    } finally {
      setActionLoading(null);
    }
  };

  // ── Get action button for current status ─────────────────────────────────

  const getActionButton = (item) => {
    const legId = item._id;
    const isLoading = actionLoading === legId;

    switch (item.returnStatus) {
      case 'return_pickup_assigned':
        return (
          <div className="space-y-2">
            <button onClick={() => handleAction(legId, 'accept')} disabled={isLoading}
              className="w-full bg-orange-600 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-orange-700 active:scale-95 transition-all disabled:opacity-50">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Accept Pickup
            </button>
          </div>
        );
      case 'pickup_en_route':
        return (
          <div className="space-y-2">
            <button onClick={handleGoToFeed}
              className="w-full bg-orange-500 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all">
              <Map className="w-4 h-4" /> Navigate on Map
            </button>
            <button onClick={() => handleAction(legId, 'reached_user')} disabled={isLoading}
              className="w-full bg-gray-900 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
              I've Reached User
            </button>
          </div>
        );
      case 'pickup_reached':
      case 'pickup_otp_pending':
        return (
          <button onClick={handleGoToFeed}
            className="w-full bg-purple-600 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all">
            <Map className="w-4 h-4" /> Verify Pickup OTP on Map
          </button>
        );
      case 'picked_up':
        return (
          <div className="space-y-2">
            <button onClick={() => handleAction(legId, 'heading_to_seller')} disabled={isLoading}
              className="w-full bg-orange-600 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
              Start Heading to Seller
            </button>
          </div>
        );
      case 'return_en_route':
      case 'return_in_transit':
        return (
          <div className="space-y-2">
            <button onClick={handleGoToFeed}
              className="w-full bg-orange-500 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all">
              <Map className="w-4 h-4" /> Navigate on Map
            </button>
            <button onClick={() => handleAction(legId, 'reached_seller')} disabled={isLoading}
              className="w-full bg-gray-900 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Store className="w-4 h-4" />}
              I've Reached Seller
            </button>
          </div>
        );
      case 'return_reached_seller':
      case 'seller_otp_pending':
        return (
          <button onClick={handleGoToFeed}
            className="w-full bg-purple-600 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all">
            <Map className="w-4 h-4" /> Verify Seller OTP on Map
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-24">
      {/* Header */}
      <div className="bg-white px-4 py-4 pt-10 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight">Returns</h1>
              <p className="text-xs text-gray-400 font-medium">Manage your return pickups & deliveries</p>
            </div>
          </div>
          <button onClick={fetchReturns} className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center text-orange-500">
             <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search by ID, User, or Seller..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-gray-100 border-none rounded-2xl py-3 pl-10 pr-4 text-sm font-medium focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-hide">
          {[
            { id: 'active', label: 'Active' },
            { id: 'completed', label: 'Completed' },
            { id: 'all', label: 'All History' },
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === tab.id 
                ? 'bg-gray-900 text-white' 
                : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 p-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          </div>
        ) : filteredReturns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
               <RotateCcw className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">No Returns Found</h3>
            <p className="text-sm text-gray-500 max-w-[200px]">
              You don't have any {activeTab === 'all' ? '' : activeTab} returns at the moment.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {filteredReturns.map((item) => {
                const statusInfo = getStatusConfig(item.returnStatus);
                const isFailed = FAILED_STATUSES.includes(item.returnStatus);
                const isCompleted = COMPLETED_STATUSES.includes(item.returnStatus);
                const isActive = ACTIVE_STATUSES.includes(item.returnStatus);
                const StatusIcon = statusInfo.icon;

                return (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={item._id}
                    className={`bg-white rounded-3xl p-5 shadow-sm border ${isActive ? 'border-orange-100' : 'border-gray-100'}`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Return ID</span>
                        <span className="font-bold text-gray-900">{item.displayOrderId || item.returnId || item._id.slice(-6).toUpperCase()}</span>
                      </div>
                      <div className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${statusInfo.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusInfo.label}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <ReturnProgressBar currentStep={statusInfo.step} />

                    {/* Pickup → Drop Route */}
                    <div className="space-y-4 mb-4">
                       <div className="flex gap-3">
                         <div className="mt-1 flex flex-col items-center">
                           <div className="w-3 h-3 rounded-full bg-orange-500 border-2 border-orange-200"></div>
                           <div className="w-0.5 h-10 bg-gradient-to-b from-orange-200 to-green-200"></div>
                           <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-green-200"></div>
                         </div>
                         <div className="flex-1 space-y-3">
                           <div>
                             <div className="flex items-center gap-1.5 mb-0.5">
                               <User className="w-3 h-3 text-orange-500" />
                               <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wide">Pickup from Customer</p>
                             </div>
                             <p className="text-sm font-bold text-gray-900">{item.userId?.name || item.customer?.name || 'Customer'}</p>
                             <p className="text-xs text-gray-500 line-clamp-1">{item.pickupAddress?.address || item.userId?.location?.address || 'Customer location'}</p>
                           </div>
                           <div>
                             <div className="flex items-center gap-1.5 mb-0.5">
                               <Store className="w-3 h-3 text-green-600" />
                               <p className="text-[10px] font-bold text-green-600 uppercase tracking-wide">Return to Seller</p>
                             </div>
                             <p className="text-sm font-bold text-gray-900">{item.sellerId?.shopName || item.sellerId?.name || 'Seller'}</p>
                             <p className="text-xs text-gray-500 line-clamp-1">{item.sellerId?.address || item.sellerId?.location?.address || 'Seller location'}</p>
                           </div>
                         </div>
                       </div>
                    </div>

                    {/* Return Items */}
                    {item.returnItems && item.returnItems.length > 0 && (
                      <div className="bg-gray-50 rounded-2xl p-3 mb-4">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Items to Return</p>
                        {item.returnItems.map((ri, idx) => (
                          <div key={idx} className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
                            <span className="text-xs font-medium text-gray-700">{ri.name}</span>
                            <span className="text-xs font-bold text-gray-900">×{ri.quantity}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reason */}
                    {(item.returnReason || item.returnRequestId?.reason) && (
                      <div className="bg-red-50 rounded-xl px-3 py-2 mb-4">
                        <p className="text-[10px] font-bold text-red-400 uppercase tracking-wide">Return Reason</p>
                        <p className="text-xs font-medium text-red-700">{item.returnReason || item.returnRequestId?.reason}</p>
                      </div>
                    )}

                    {/* Timestamps */}
                    <div className="flex items-center gap-4 text-[10px] text-gray-400 font-medium mb-4">
                      <span>Created {dayjs(item.createdAt).fromNow()}</span>
                      {item.assignment?.acceptedAt && <span>• Accepted {dayjs(item.assignment.acceptedAt).fromNow()}</span>}
                      {item.returnCompletedAt && <span>• Completed {dayjs(item.returnCompletedAt).fromNow()}</span>}
                    </div>

                    {/* Action Buttons */}
                    {isActive && getActionButton(item)}

                    {/* Completed/Failed badge */}
                    {isCompleted && (
                      <div className="flex items-center gap-2 bg-green-50 rounded-2xl py-3 px-4">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        <div>
                          <p className="text-sm font-bold text-green-700">Return Completed</p>
                          <p className="text-xs text-green-600">{item.returnCompletedAt ? dayjs(item.returnCompletedAt).format('DD MMM YYYY, hh:mm A') : ''}</p>
                        </div>
                      </div>
                    )}
                    {isFailed && (
                      <div className="flex items-center gap-2 bg-red-50 rounded-2xl py-3 px-4">
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                        <div>
                          <p className="text-sm font-bold text-red-700">{statusInfo.label}</p>
                          <p className="text-xs text-red-600">{item.failureReason || 'Return could not be completed'}</p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
