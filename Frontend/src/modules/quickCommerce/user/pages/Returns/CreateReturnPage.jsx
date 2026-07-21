import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, UploadCloud, X, AlertCircle } from 'lucide-react';
import { customerApi } from '../../services/customerApi';
import { returnApi } from '../../services/returnApi';
import Loader from '@food/components/Loader';

const REASON_OPTIONS = [
  'Damaged Product',
  'Expired Item',
  'Wrong Item Delivered',
  'Quality Issue',
  'Missing Parts',
  'Other'
];

export default function CreateReturnPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  
  const [selectedItems, setSelectedItems] = useState({});
  const [mainReason, setMainReason] = useState(REASON_OPTIONS[0]);
  const [notes, setNotes] = useState('');
  const [images, setImages] = useState([]);
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      // 1. Check if a return already exists for this order
      const returnsRes = await returnApi.getReturns();
      if (returnsRes?.data?.returns) {
        const existingReturn = returnsRes.data.returns.find(
          r => String(r.orderId) === String(orderId) || String(r.orderMongoId) === String(orderId)
        );
        if (existingReturn) {
          navigate(`/quick/returns/${existingReturn._id}`, { replace: true });
          return; // Stop rendering this page
        }
      }

      // 2. Fetch order details
      const res = await customerApi.getOrderDetails(orderId);
      const data = res?.data?.result || res?.data;
      setOrder(data);
    } catch (err) {
      setError('Failed to load order details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuantityChange = (productId, qty) => {
    if (qty <= 0) {
      const newItems = { ...selectedItems };
      delete newItems[productId];
      setSelectedItems(newItems);
    } else {
      setSelectedItems(prev => ({
        ...prev,
        [productId]: qty
      }));
    }
  };

  const handleImageSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    
    if (images.length + files.length > 5) {
      alert('Maximum 5 images allowed');
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      files.forEach(f => formData.append('images', f));
      
      const res = await returnApi.uploadImages(formData);
      if (res?.data?.images) {
        setImages(prev => [...prev, ...res.data.images]);
      }
    } catch (err) {
      alert('Failed to upload images');
    } finally {
      setSubmitting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const itemsList = Object.keys(selectedItems)
      .filter(productId => selectedItems[productId] > 0)
      .map(productId => ({
        productId,
        quantity: selectedItems[productId],
        reason: mainReason
      }));
    
    if (itemsList.length === 0) {
      return alert('Please select at least one item to return');
    }
    
    try {
      setSubmitting(true);
      const res = await returnApi.createReturn({
        orderId,
        items: itemsList,
        reason: mainReason,
        notes,
        images
      });
      navigate(`/quick/returns/${res.data.returnRequest._id}`, { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to submit return request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loader />;
  if (!order) return <div className="p-4 text-center mt-10 text-red-500">{error}</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white sticky top-0 z-30 shadow-sm border-b">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 mr-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Create Return</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm flex gap-2 items-center">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
        
        {/* Select Items */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">Select Items to Return</h3>
          <div className="space-y-4">
            {order.items.map((item, idx) => {
              const id = item.itemId || item.productId || item._id;
              const selectedQty = selectedItems[id] || 0;
              
              return (
                <div key={idx} className="flex gap-4">
                  <div className="w-16 h-16 rounded-xl bg-gray-50 border border-gray-100 flex-shrink-0 overflow-hidden">
                    <img src={item.image || '/placeholder.png'} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 flex flex-col justify-center">
                    <h4 className="text-sm font-medium text-gray-900 line-clamp-1">{item.name}</h4>
                    <p className="text-sm font-bold text-gray-900 mt-1">₹{item.price}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => handleQuantityChange((item.itemId || item.productId || item._id), selectedQty - 1)}
                      className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold ${selectedQty > 0 ? 'border-green-600 text-green-600' : 'border-gray-200 text-gray-300'}`}
                    >
                      -
                    </button>
                    <span className="w-4 text-center font-bold text-gray-900">{selectedQty}</span>
                    <button 
                      onClick={() => handleQuantityChange((item.itemId || item.productId || item._id), Math.min(item.quantity, selectedQty + 1))}
                      className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold ${selectedQty < item.quantity ? 'border-green-600 text-green-600 bg-green-50' : 'border-gray-200 text-gray-300'}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Reason */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">Reason for Return</h3>
          <div className="space-y-3">
            {REASON_OPTIONS.map(reason => (
              <label key={reason} className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="radio" 
                  name="reason" 
                  value={reason}
                  checked={mainReason === reason}
                  onChange={(e) => setMainReason(e.target.value)}
                  className="w-4 h-4 text-green-600 focus:ring-green-500"
                />
                <span className="text-sm text-gray-800">{reason}</span>
              </label>
            ))}
          </div>
          
          <div className="mt-4">
            <textarea
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              rows={3}
              placeholder="Additional comments (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Image Upload */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-900">Upload Evidence (Optional)</h3>
            <span className="text-xs text-gray-500">{images.length}/5 images</span>
          </div>
          
          <div className="flex gap-3 overflow-x-auto pb-2">
            {images.map((imgUrl, i) => (
              <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 border border-gray-200">
                <img src={imgUrl} alt={`Evidence ${i}`} className="w-full h-full object-cover" />
                <button 
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow-sm"
                >
                  <X className="w-3 h-3 text-red-500" />
                </button>
              </div>
            ))}
            
            {images.length < 5 && (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center flex-shrink-0 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <UploadCloud className="w-6 h-6 text-gray-400 mb-1" />
                <span className="text-[10px] text-gray-500 font-medium">Add Photo</span>
              </div>
            )}
            <input 
              type="file" 
              multiple 
              accept="image/jpeg,image/png,image/webp" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleImageSelect}
            />
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t z-40 max-w-2xl mx-auto">
        <button 
          onClick={handleSubmit}
          disabled={submitting || Object.keys(selectedItems).length === 0}
          className="w-full py-3.5 bg-green-600 text-white font-bold rounded-xl shadow-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {submitting ? 'Processing...' : 'Submit Return Request'}
        </button>
      </div>
    </div>
  );
}
