import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Eye, Edit2, Loader2, Camera, X, Plus, FileText, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { deliveryAPI } from '@food/api';
import { toast } from 'sonner';
import { openCamera } from "@food/utils/imageUploadUtils";
import useDeliveryBackNavigation from '../../hooks/useDeliveryBackNavigation';

/**
 * ProfileDocsV2 - Restored Old UI for Registration Documents & Vehicle Info.
 */
export const ProfileDocsV2 = () => {
  const goBack = useDeliveryBackNavigation();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showViewer, setShowViewer] = useState(null); // { title: string, url: string }
  const [uploadField, setUploadField] = useState(null)
  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await deliveryAPI.getProfile();
        if (response?.data?.success) setProfile(response.data.data.profile);
      } catch (e) { toast.error("Failed to load documents"); }
      finally { setLoading(false); }
    };
    fetchProfile();
  }, []);

  const handleUpdate = async (field, file) => {
     if (!file) return;
     setIsUpdating(true);
     const formData = new FormData();
     formData.append(field, file);
     try {
        const res = await deliveryAPI.updateProfileMultipart(formData);
        if (res?.data?.success) {
           toast.success("Document updated successfully");
           const updated = await deliveryAPI.getProfile();
           setProfile(updated.data.data.profile);
        }
     } catch (e) { toast.error("Upload failed"); }
     finally { setIsUpdating(false); }
  };

  const handleTakeCameraPhoto = (field) => {
    openCamera({
      onSelectFile: (file) => handleUpdate(field, file),
      fileNamePrefix: `profile-doc-${field}`
    })
  }

  const handlePickFromGallery = (field) => {
    setUploadField(field)
    fileInputRef.current?.click()
  }

  const getDocStatus = (doc) => {
    if (!doc?.document) return "Not Uploaded";
    return doc.verified ? "Verified" : "Pending Verification";
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-red-500" /></div>;

  const docs = [
    { label: "Aadhar Card", field: "aadharPhoto", data: profile?.documents?.aadhar },
    { label: "PAN Card", field: "panPhoto", data: profile?.documents?.pan },
    { label: "Driving License", field: "drivingLicensePhoto", data: profile?.documents?.drivingLicense }
  ];

  return (
    <div className="min-h-screen bg-gray-50 font-poppins pb-20">
       <div className="bg-white px-4 py-5 flex items-center gap-4 fixed top-0 w-full z-50 shadow-sm">
          <button onClick={goBack}><ArrowLeft className="w-6 h-6 shadow-sm p-1 rounded-full bg-gray-50 bg-opacity-70" /></button>
          <h1 className="text-xl font-black">Registration Docs</h1>
       </div>

       <div className="pt-24 px-4 space-y-8">
          {/* 1. Vehicle Card */}
          <div className="bg-[#FF0000] rounded-2xl p-6 text-white shadow-xl shadow-red-500/20 flex flex-col gap-2 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full translate-x-20 -translate-y-20" />
             <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 z-10">Vehicle Registered</p>
             <h3 className="text-2xl font-black z-10">{profile?.vehicle?.number || "NO # REGISTERED"}</h3>
             <p className="text-[10px] font-bold z-10 opacity-70 uppercase tracking-widest">{profile?.vehicle?.type || "Standard Bike"}</p>
          </div>

          {/* 2. Documents List */}
          <div className="space-y-4">
             {docs.map((doc, idx) => (
                <div key={idx} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-4 relative">
                   <div className="flex justify-between items-start">
                      <div>
                         <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">{doc.label}</p>
                         <h4 className="text-sm font-bold text-gray-800">{getDocStatus(doc.data)}</h4>
                      </div>
                      <div className="flex gap-2">
                         {doc.data?.document && (
                            <button onClick={() => setShowViewer({ title: doc.label, url: doc.data.document })} className="p-3 bg-gray-50 rounded-xl text-gray-600 hover:bg-gray-100 active:scale-95 transition-all"><Eye className="w-5 h-5" /></button>
                         )}
                         <button 
                            onClick={() => handleTakeCameraPhoto(doc.field)}
                            className="p-3 bg-gray-900 rounded-xl text-white hover:bg-black active:scale-95 transition-all cursor-pointer relative"
                         >
                            <Camera className="w-5 h-5" />
                         </button>
                         <button 
                            onClick={() => handlePickFromGallery(doc.field)}
                            className="p-3 bg-red-50 rounded-xl text-red-600 hover:bg-red-100 active:scale-95 transition-all cursor-pointer relative"
                         >
                            <ImageIcon className="w-5 h-5" />
                         </button>
                      </div>
                   </div>
                   {doc.data?.document && (
                      <div className="mt-2 w-24 h-16 rounded-xl border border-gray-100 overflow-hidden shadow-inner bg-gray-50 flex items-center justify-center">
                         <img src={doc.data.document} className="w-full h-full object-cover opacity-50 grayscale" alt="Preview" />
                      </div>
                   )}
                </div>
             ))}
          </div>

          <div className="p-10 text-center opacity-30 mt-10">
             <FileText className="w-16 h-16 mx-auto mb-4" />
             <p className="text-[10px] font-black uppercase tracking-[0.4em]">Official Fleet Identity</p>
          </div>
       </div>

       {/* Simple Modal Image Viewer */}
       <AnimatePresence>
          {showViewer && (
             <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowViewer(null)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
                <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="relative w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl">
                   <div className="flex items-center justify-between p-6 border-b border-gray-100">
                      <h3 className="text-lg font-black text-gray-950 uppercase tracking-widest">{showViewer.title}</h3>
                      <button onClick={() => setShowViewer(null)} className="p-3 bg-gray-50 rounded-full text-gray-400"><X className="w-6 h-6" /></button>
                   </div>
                   <div className="p-2">
                      <img src={showViewer.url} className="w-full h-full object-contain rounded-2xl max-h-[70vh]" alt="Identity Doc" />
                   </div>
                </motion.div>
             </div>
          )}
       </AnimatePresence>
       
       <input 
          ref={fileInputRef}
          type="file" 
          className="hidden" 
          accept="image/*"
          onChange={(e) => {
             if (uploadField && e.target.files[0]) {
                handleUpdate(uploadField, e.target.files[0]);
             }
             e.target.value = "";
          }} 
       />
    </div>
  );
};

export default ProfileDocsV2;
