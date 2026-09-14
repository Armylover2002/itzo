import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Plus, Clock, CheckCircle, 
  XCircle, Loader2, Eye, MessageSquare, ChevronRight 
} from 'lucide-react';
import { deliveryAPI } from '@food/api';
import { toast } from 'sonner';
import useDeliveryBackNavigation from '../../hooks/useDeliveryBackNavigation';

/**
 * SupportTicketsV2 - Restored Old UI for Support Ticket Hub.
 */
export const SupportTicketsV2 = () => {
  const navigate = useNavigate();
  const goBack = useDeliveryBackNavigation();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        setLoading(true);
        const response = await deliveryAPI.getSupportTickets();
        if (response?.data?.success) {
          setTickets(response.data.data.tickets || []);
        }
      } catch (error) {
        toast.error("Failed to load tickets");
      } finally {
        setLoading(false);
      }
    };
    fetchTickets();
  }, []);

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "open": return "bg-red-50 text-red-600 border-red-100";
      case "in_progress": return "bg-blue-50 text-blue-600 border-blue-100";
      case "resolved": return "bg-green-50 text-green-600 border-green-100";
      default: return "bg-gray-50 text-gray-600 border-gray-100";
    }
  };

  return (
    <div className="min-h-screen bg-white font-poppins pb-20">
      {/* Header */}
      <div className="bg-white px-4 py-5 flex items-center gap-4 fixed top-0 w-full z-50 shadow-sm border-b border-gray-50">
        <button onClick={goBack} className="p-1 hover:bg-gray-50 rounded-full">
           <ArrowLeft className="w-6 h-6 text-gray-950" />
        </button>
        <h1 className="text-xl font-black text-gray-950">Support Tickets</h1>
      </div>

      <div className="pt-24 px-4 space-y-6">
        {/* Create Action */}
        <button 
          onClick={() => navigate("/food/delivery/help/tickets/create")}
          className="w-full bg-black text-white p-5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all"
        >
          <Plus className="w-5 h-5" />
          Raise New Ticket
        </button>

        {/* List */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
             <Loader2 className="w-8 h-8 animate-spin text-gray-200" />
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Syncing Tickets...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-24 text-center">
             <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <MessageSquare className="w-10 h-10 text-gray-200" />
             </div>
             <h3 className="text-sm font-black text-gray-950 uppercase tracking-widest">No Active Tickets</h3>
             <p className="text-[10px] text-gray-400 font-bold uppercase mt-2">Create a ticket if you need assistance</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tickets.map((ticket, idx) => (
              <div 
                key={ticket._id || idx}
                onClick={() => navigate(`/food/delivery/help/tickets/${ticket._id}`)}
                className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm active:scale-[0.98] transition-all relative overflow-hidden group"
              >
                <div className="flex justify-between items-start mb-3">
                   <div className="flex-1 pr-4">
                      <div className="flex items-center gap-2 mb-1">
                         <h4 className="text-sm font-black text-gray-950 group-hover:text-blue-600 transition-colors uppercase tracking-tight line-clamp-1">{ticket.subject}</h4>
                         {ticket.ticketId && <span className="text-[9px] font-mono font-bold bg-gray-100 px-2 py-0.5 rounded">#{ticket.ticketId}</span>}
                      </div>
                      <p className="text-xs text-gray-500 font-medium line-clamp-1">{ticket.description}</p>
                   </div>
                   <ChevronRight className="w-5 h-5 text-gray-200" />
                </div>
                
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
                   <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusColor(ticket.status)}`}>
                        {ticket.status?.replace('_', ' ')}
                      </span>
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{ticket.category}</span>
                   </div>
                   <span className="text-[9px] font-bold text-gray-300">{new Date(ticket.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
