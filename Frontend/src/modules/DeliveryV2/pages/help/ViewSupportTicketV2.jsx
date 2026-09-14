import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  ArrowLeft, Clock, CheckCircle, XCircle, 
  Loader2, MessageSquare, ShieldCheck, Mail 
} from 'lucide-react';
import { deliveryAPI } from '@food/api';
import { toast } from 'sonner';
import useDeliveryBackNavigation from '../../hooks/useDeliveryBackNavigation';

/**
 * ViewSupportTicketV2 - Restored Old UI for Ticket Details.
 */
export const ViewSupportTicketV2 = () => {
  const goBack = useDeliveryBackNavigation();
  const { ticketId } = useParams();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTicket = async () => {
      try {
        setLoading(true);
        const response = await deliveryAPI.getSupportTicketById(ticketId);
        if (response?.data?.success) {
          const found =
            response?.data?.data?.ticket ||
            response?.data?.data ||
            response?.data?.ticket ||
            null;
          setTicket(found);
        }
      } catch (error) {
        toast.error("Failed to load ticket details");
      } finally {
        setLoading(false);
      }
    };
    fetchTicket();
  }, [ticketId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="w-8 h-8 animate-spin text-red-500" /></div>;
  if (!ticket) return <div className="p-20 text-center text-gray-400 font-bold uppercase tracking-widest h-screen">Ticket Not Found</div>;

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "open": return "text-red-600 bg-red-50";
      case "resolved": return "text-green-600 bg-green-50";
      case "closed": return "text-gray-600 bg-gray-50";
      default: return "text-blue-600 bg-blue-50";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-poppins pb-20">
      {/* Header */}
      <div className="bg-white px-4 py-5 flex items-center gap-4 fixed top-0 w-full z-50 shadow-sm border-b border-gray-50">
        <button onClick={goBack} className="p-1 hover:bg-gray-50 rounded-full">
           <ArrowLeft className="w-6 h-6 text-gray-950" />
        </button>
        <h1 className="text-xl font-black text-gray-950 uppercase tracking-tight">Ticket Info</h1>
      </div>

      <div className="pt-24 px-4 space-y-6">
         {/* Status & ID */}
         <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
            <div className="space-y-1">
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ID Reference</p>
               <h3 className="text-lg font-black text-gray-950">#{ticket.ticketId || "Pending"}</h3>
            </div>
            <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${getStatusColor(ticket.status)}`}>
               {ticket.status}
            </div>
         </div>

         {/* Subject & Description */}
         <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
            <div className="space-y-1">
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Subject</p>
               <h4 className="text-sm font-black text-gray-950">{ticket.subject}</h4>
            </div>
            <div className="space-y-1 pt-4 border-t border-gray-50">
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Detail Description</p>
               <p className="text-xs text-gray-600 font-medium leading-relaxed">{ticket.description}</p>
            </div>
         </div>

         {/* Response Section */}
         <div className="bg-white rounded-3xl p-6 shadow-sm border border-red-100 flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center shrink-0">
               <ShieldCheck className="w-5 h-5 text-red-500" />
            </div>
            <div className="space-y-2">
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Support Response</p>
               <p className="text-xs text-red-600 font-bold leading-relaxed italic">
                 {ticket.adminResponse || "Our support team is currently reviewing your ticket. You'll receive a notification once there is an update."}
               </p>
               {ticket.respondedAt && (
                 <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                   Updated {new Date(ticket.respondedAt).toLocaleString()}
                 </p>
               )}
            </div>
         </div>

         <div className="mt-10 flex flex-col items-center justify-center opacity-20 gap-4">
            <Mail className="w-12 h-12" />
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-center">AppZeto Support Fleet</p>
         </div>
      </div>
    </div>
  );
};
