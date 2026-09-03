import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Search, Filter } from 'lucide-react';
import { adminApi } from '../services/adminApi';
import Loader from '@food/components/Loader';
import dayjs from 'dayjs';

export default function AdminReturnsList() {
  const navigate = useNavigate();
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchReturns();
  }, [statusFilter]);

  const fetchReturns = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await adminApi.getReturns(params);
      if (res?.data?.data?.returns) {
        setReturns(res.data.data.returns);
      } else if (res?.data?.returns) {
        setReturns(res.data.returns);
      }
    } catch (error) {
      console.error('Failed to fetch returns:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredReturns = returns.filter(ret => 
    ret.returnId.toLowerCase().includes(searchQuery.toLowerCase()) || 
    ret.orderId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status) => {
    const colors = {
      RETURN_REQUESTED: 'bg-yellow-100 text-yellow-800',
      UNDER_ADMIN_REVIEW: 'bg-[#f0e7f9] text-[#370a6d]',
      APPROVED: 'bg-[#f0e7f9] text-[#370a6d]',
      PARTIALLY_APPROVED: 'bg-[#f0e7f9] text-[#370a6d]',
      REJECTED: 'bg-red-100 text-red-800',
      IN_PROGRESS: 'bg-purple-100 text-purple-800',
      COMPLETED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-gray-100 text-gray-800',
    };
    const bg = colors[status] || 'bg-gray-100 text-gray-800';
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${bg}`}>
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Return Requests</h1>
          <p className="text-sm text-gray-500 mt-1">Manage user return requests and refunds</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b flex flex-wrap gap-4 justify-between items-center bg-gray-50">
          <div className="relative flex-1 min-w-[250px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search Return ID or Order ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="all">All Statuses</option>
              <option value="RETURN_REQUESTED">Requested</option>
              <option value="UNDER_ADMIN_REVIEW">Under Review</option>
              <option value="APPROVED">Approved</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 flex justify-center"><Loader /></div>
          ) : (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 border-b text-gray-600 font-medium">
                <tr>
                  <th className="px-6 py-4">Return ID</th>
                  <th className="px-6 py-4">Order ID</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Items</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredReturns.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                      No returns found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredReturns.map(ret => (
                    <tr key={ret._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{ret.returnId}</td>
                      <td className="px-6 py-4 text-gray-600">#{ret.orderId}</td>
                      <td className="px-6 py-4 text-gray-600">{dayjs(ret.requestedAt).format('DD MMM YYYY, hh:mm A')}</td>
                      <td className="px-6 py-4 text-gray-600">{ret.items.length} items</td>
                      <td className="px-6 py-4">{getStatusBadge(ret.status)}</td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => navigate(`/ecs/quick-commerce/returns/${ret._id}`)}
                          className="p-1.5 text-[#550fa8] bg-[#f7f3fc] rounded-lg hover:bg-[#f0e7f9] transition-colors inline-flex items-center"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
