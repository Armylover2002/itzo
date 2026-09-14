import React, { useState } from 'react';
import { ArrowLeft, Loader2, Send } from 'lucide-react';
import { deliveryAPI } from '@food/api';
import { toast } from 'sonner';
import useDeliveryBackNavigation from '../../hooks/useDeliveryBackNavigation';

/**
 * CreateSupportTicketV2 - Restored Old UI for Ticket Creation.
 */
export const CreateSupportTicketV2 = () => {
  const goBack = useDeliveryBackNavigation();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    subject: "",
    description: "",
    category: "other",
    priority: "medium"
  });

  const handleSubmit = async () => {
    if (form.subject.length < 3) return toast.error("Subject too short");
    if (form.description.length < 10) return toast.error("Description too short");

    setLoading(true);
    try {
      const response = await deliveryAPI.createSupportTicket(form);
      if (response?.data?.success) {
        toast.success("Ticket raised successfully");
        goBack();
      }
    } catch (e) {
      toast.error("Failed to create ticket");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white font-poppins">
      {/* Header */}
      <div className="bg-white px-4 py-5 flex items-center gap-4 fixed top-0 w-full z-50 shadow-sm border-b border-gray-50">
        <button onClick={goBack} className="p-1 hover:bg-gray-50 rounded-full">
           <ArrowLeft className="w-6 h-6 text-gray-950" />
        </button>
        <h1 className="text-xl font-black text-gray-950 uppercase tracking-tight">Raise Ticket</h1>
      </div>

      <div className="pt-24 px-4 pb-10 space-y-8">
         <div className="space-y-6">
            {/* Subject */}
            <div className="space-y-2">
               <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Issue Topic</label>
               <input 
                 type="text"
                 placeholder="Main subject of your concern"
                 value={form.subject}
                 onChange={(e) => setForm({...form, subject: e.target.value})}
                 className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold text-gray-950 focus:ring-4 focus:ring-red-500/10 transition-all outline-none"
               />
            </div>

            {/* Description */}
            <div className="space-y-2">
               <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Detail Description</label>
               <textarea 
                 rows={6}
                 placeholder="Explain your issue here..."
                 value={form.description}
                 onChange={(e) => setForm({...form, description: e.target.value})}
                 className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold text-gray-950 focus:ring-4 focus:ring-red-500/10 transition-all outline-none resize-none"
               />
            </div>

            {/* Category & Priority */}
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Category</label>
                  <select 
                    value={form.category}
                    onChange={(e) => setForm({...form, category: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-xs font-black text-gray-800 uppercase tracking-widest outline-none"
                  >
                     <option value="payment">Payment</option>
                     <option value="order">Order</option>
                     <option value="account">Account</option>
                     <option value="technical">Tech Issue</option>
                     <option value="other">Other</option>
                  </select>
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Priority</label>
                  <select 
                    value={form.priority}
                    onChange={(e) => setForm({...form, priority: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-xs font-black text-gray-800 uppercase tracking-widest outline-none"
                  >
                     <option value="low">Low</option>
                     <option value="medium">Medium</option>
                     <option value="high">High</option>
                     <option value="urgent">Urgent</option>
                  </select>
               </div>
            </div>
         </div>

         <button 
           onClick={handleSubmit}
           disabled={loading}
           className="w-full bg-black text-white p-5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
         >
           {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
           Submit Ticket
         </button>
      </div>
    </div>
  );
};
