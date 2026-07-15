import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { deliveryAPI } from '@food/api';
import { 
  ArrowLeft, Search, Filter, Package, AlertTriangle, 
  CheckCircle2, Clock, MapPin, Map, Loader2, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

export default function DeliveryReturns() {
  const navigate = useNavigate();
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active'); // active, completed, failed
  const [searchQuery, setSearchQuery] = useState('');

  const fetchReturns = async () => {
    setLoading(true);
    try {
      let statusParam = 'all';
      if (activeTab === 'active') statusParam = 'active';
      if (activeTab === 'completed') statusParam = 'RETURN_COMPLETED';
      if (activeTab === 'failed') statusParam = 'FAILED';

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
  };

  useEffect(() => {
    fetchReturns();
  }, [activeTab]);

  const filteredReturns = returns.filter(r => {
    const searchLower = searchQuery.toLowerCase();
    const orderIdMatch = r.displayOrderId?.toLowerCase().includes(searchLower) || r._id.toLowerCase().includes(searchLower);
    const sellerMatch = r.sellerId?.shopName?.toLowerCase().includes(searchLower);
    const userMatch = r.userId?.name?.toLowerCase().includes(searchLower);
    return orderIdMatch || sellerMatch || userMatch;
  });

  const getStatusConfig = (status) => {
    switch (status) {
      case 'RETURN_PICKUP_ASSIGNED': return { label: 'Assigned', color: 'bg-blue-100 text-blue-700' };
      case 'PICKUP_EN_ROUTE': return { label: 'Heading to User', color: 'bg-orange-100 text-orange-700' };
      case 'PICKUP_REACHED': return { label: 'Reached User', color: 'bg-orange-100 text-orange-700' };
      case 'PICKUP_OTP_PENDING': return { label: 'Pickup OTP Pending', color: 'bg-purple-100 text-purple-700' };
      case 'PICKED_UP': return { label: 'Picked Up', color: 'bg-teal-100 text-teal-700' };
      case 'RETURN_EN_ROUTE': return { label: 'Heading to Seller', color: 'bg-indigo-100 text-indigo-700' };
      case 'RETURN_REACHED_SELLER': return { label: 'Reached Seller', color: 'bg-indigo-100 text-indigo-700' };
      case 'SELLER_OTP_PENDING': return { label: 'Seller OTP Pending', color: 'bg-purple-100 text-purple-700' };
      case 'RETURN_COMPLETED': return { label: 'Completed', color: 'bg-green-100 text-green-700' };
      case 'FAILED': return { label: 'Failed', color: 'bg-red-100 text-red-700' };
      case 'CANCELLED': return { label: 'Cancelled', color: 'bg-gray-100 text-gray-700' };
      default: return { label: status, color: 'bg-gray-100 text-gray-700' };
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
            <h1 className="text-xl font-black text-gray-900 tracking-tight">Returns Management</h1>
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
            className="w-full bg-gray-100 border-none rounded-2xl py-3 pl-10 pr-4 text-sm font-medium focus:ring-2 focus:ring-orange-500/20"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-hide">
          {['active', 'completed', 'failed'].map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === tab 
                ? 'bg-gray-900 text-white' 
                : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
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
               <Package className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">No Returns Found</h3>
            <p className="text-sm text-gray-500 max-w-[200px]">
              You don't have any {activeTab} returns at the moment.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {filteredReturns.map((item) => {
                const statusInfo = getStatusConfig(item.returnStatus);
                const isFailed = item.returnStatus === 'FAILED' || item.returnStatus === 'CANCELLED';
                const isCompleted = item.returnStatus === 'RETURN_COMPLETED';

                return (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={item._id}
                    className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Return ID</span>
                        <span className="font-bold text-gray-900">{item.displayOrderId || item.returnId || item._id.slice(-6).toUpperCase()}</span>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${statusInfo.color}`}>
                        {statusInfo.label}
                      </div>
                    </div>

                    <div className="space-y-4 mb-4">
                       <div className="flex gap-3">
                         <div className="mt-1 flex flex-col items-center">
                           <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                           <div className="w-0.5 h-8 bg-gray-200"></div>
                           <div className="w-2 h-2 rounded-full bg-green-500"></div>
                         </div>
                         <div className="flex-1 space-y-3">
                           <div>
                             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Pickup From</p>
                             <p className="text-sm font-bold text-gray-900">{item.userId?.name || 'Customer'}</p>
                             <p className="text-xs text-gray-500 line-clamp-1">{item.pickupAddress?.address || 'Customer location'}</p>
                           </div>
                           <div>
                             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Return To</p>
                             <p className="text-sm font-bold text-gray-900">{item.sellerId?.shopName || 'Seller'}</p>
                             <p className="text-xs text-gray-500 line-clamp-1">{item.sellerId?.address || 'Seller location'}</p>
                           </div>
                         </div>
                       </div>
                    </div>

                    {activeTab === 'active' && !isFailed && !isCompleted && (
                      <button 
                        onClick={() => navigate('/food/delivery/feed')} 
                        className="w-full bg-gray-900 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-800 active:scale-95 transition-all"
                      >
                        <Map className="w-4 h-4" />
                        Go to Map
                      </button>
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
