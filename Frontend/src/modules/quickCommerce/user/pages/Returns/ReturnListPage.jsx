import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, Clock, CheckCircle, XCircle } from 'lucide-react';
import { returnApi } from '../../services/returnApi';
import Loader from '@food/components/Loader';

const STATUS_CONFIG = {
  RETURN_REQUESTED: { color: 'text-orange-500', bg: 'bg-orange-50', icon: Clock, label: 'Requested' },
  UNDER_ADMIN_REVIEW: { color: 'text-orange-500', bg: 'bg-orange-50', icon: Clock, label: 'Under Review' },
  APPROVED: { color: 'text-blue-500', bg: 'bg-blue-50', icon: CheckCircle, label: 'Approved' },
  PARTIALLY_APPROVED: { color: 'text-blue-500', bg: 'bg-blue-50', icon: CheckCircle, label: 'Partially Approved' },
  REJECTED: { color: 'text-red-500', bg: 'bg-red-50', icon: XCircle, label: 'Rejected' },
  IN_PROGRESS: { color: 'text-blue-500', bg: 'bg-blue-50', icon: Clock, label: 'In Progress' },
  COMPLETED: { color: 'text-green-500', bg: 'bg-green-50', icon: CheckCircle, label: 'Completed' },
  PARTIALLY_COMPLETED: { color: 'text-green-500', bg: 'bg-green-50', icon: CheckCircle, label: 'Partially Completed' },
  REFUND_PENDING: { color: 'text-blue-500', bg: 'bg-blue-50', icon: Clock, label: 'Refund Processing' },
  REFUND_COMPLETED: { color: 'text-green-500', bg: 'bg-green-50', icon: CheckCircle, label: 'Refunded' },
  REFUND_FAILED: { color: 'text-red-500', bg: 'bg-red-50', icon: XCircle, label: 'Refund Failed' },
  CANCELLED: { color: 'text-gray-500', bg: 'bg-gray-50', icon: XCircle, label: 'Cancelled' },
  EXPIRED: { color: 'text-gray-500', bg: 'bg-gray-50', icon: XCircle, label: 'Expired' },
};

export default function ReturnListPage() {
  const navigate = useNavigate();
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReturns();
  }, []);

  const fetchReturns = async () => {
    try {
      setLoading(true);
      const res = await returnApi.getReturns();
      if (res?.data?.returns) {
        setReturns(res.data.returns);
      }
    } catch (error) {
      console.error('Failed to fetch returns:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white sticky top-0 z-30 shadow-sm border-b">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 mr-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">My Returns</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {returns.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">No Returns Yet</h3>
            <p className="text-gray-500 text-sm">You haven't made any return requests.</p>
            <button 
              onClick={() => navigate('/quick/orders')}
              className="mt-6 px-6 py-2.5 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition-colors"
            >
              View Orders
            </button>
          </div>
        ) : (
          returns.map((ret) => {
            const config = STATUS_CONFIG[ret.status] || STATUS_CONFIG.RETURN_REQUESTED;
            const StatusIcon = config.icon;

            return (
              <div 
                key={ret._id} 
                onClick={() => navigate(`/quick/returns/${ret._id}`)}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99] transform"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Order #{ret.orderId}
                    </span>
                    <h3 className="font-bold text-gray-900 mt-0.5">Return Request</h3>
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {config.label}
                  </div>
                </div>

                <div className="flex items-center gap-4 py-3 border-y border-gray-50 mb-3">
                  <div className="flex -space-x-2">
                    {ret.items.slice(0, 3).map((item, idx) => (
                      <img 
                        key={idx}
                        src={item.image || '/placeholder.png'} 
                        alt={item.name}
                        className="w-10 h-10 rounded-full border-2 border-white object-cover bg-gray-100"
                      />
                    ))}
                    {ret.items.length > 3 && (
                      <div className="w-10 h-10 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
                        +{ret.items.length - 3}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-sm text-gray-600 line-clamp-2">
                    {ret.items.map(i => i.name).join(', ')}
                  </div>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">
                    {new Date(ret.requestedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className="font-medium text-green-600">
                    View Details →
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
