import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronRight, 
  Save, 
  Loader2,
  Image as ImageIcon,
  Upload,
  X,
  ArrowLeft
} from 'lucide-react';
import { toast } from "sonner";
import { adminAPI } from "@/services/api";
import { setCachedSettings } from "@/modules/common/utils/businessSettings";
import { cn } from "@/lib/utils";
import { compressImage } from "@/shared/utils/imageCompression";

const SectionCard = ({ title, children, id }) => (
  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8" id={id}>
    {title && (
      <div className="px-8 py-4 border-b border-gray-100 bg-gray-50/30">
        <h3 className="text-[13px] font-bold text-gray-700 uppercase tracking-tight">{title}</h3>
      </div>
    )}
    <div className="p-8">
      {children}
    </div>
  </div>
);

const InputField = ({ label, name, value, onChange, placeholder, info }) => {
  const inputClass = "w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-800 bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors shadow-sm";
  const labelClass = "block text-xs font-semibold text-gray-500 mb-1.5";
  
  return (
    <div className="space-y-1">
      <label className={labelClass}>{label}</label>
      <div className="relative">
        <input
          type="text"
          name={name}
          value={value || ''}
          onChange={(e) => onChange(name, e.target.value)}
          placeholder={placeholder}
          className={cn(inputClass, name === 'themeColor' && "pl-10")}
        />
        {name === 'themeColor' && (
          <div 
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-gray-200 shadow-sm"
            style={{ backgroundColor: value || '#0a0a0a' }}
          />
        )}
      </div>
      {info && (
        <div className="mt-2 bg-[#FFF8F0] border border-orange-100 rounded-lg px-4 py-2 flex items-center gap-2">
           <span className="text-[11px] text-gray-500 italic">Example: {info.prefix}</span>
           <span className="text-[11px] bg-[#00BFA5] text-white px-2 py-0.5 rounded font-bold">{value || info.default}</span>
        </div>
      )}
    </div>
  );
};

const ToggleField = ({ label, name, checked, onChange, info }) => {
  return (
    <div className="flex items-start justify-between p-4 bg-gray-50/50 rounded-xl border border-gray-100 mb-4">
      <div className="flex flex-col gap-1 pr-4">
        <span className="text-xs font-bold text-gray-700 uppercase tracking-tight">{label}</span>
        {info && <span className="text-[11px] text-gray-500 font-medium">{info}</span>}
      </div>
      <label className="relative inline-flex items-center cursor-pointer select-none">
        <input 
          type="checkbox" 
          name={name} 
          checked={!!checked} 
          onChange={(e) => onChange(name, e.target.checked)} 
          className="sr-only peer" 
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
      </label>
    </div>
  );
};

const ImageUploadBox = ({ title, size, preview, onUpload, onClear }) => {
  const fileInputRef = useRef(null);
  return (
    <div className="space-y-3">
       <div className="flex items-center justify-between px-0.5">
          <label className="text-xs font-bold text-gray-500">{title}({size})</label>
       </div>
       <div className="aspect-[2/1] w-full rounded-xl border border-dashed border-gray-300 bg-gray-50/50 relative overflow-hidden group hover:border-orange-300 transition-colors cursor-pointer flex items-center justify-center" onClick={() => fileInputRef.current?.click()}>
          {preview ? (
            <img src={preview} alt={title} className="w-full h-full object-contain p-6" />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 text-gray-400">
                <p className="text-[11px] font-bold uppercase tracking-widest">Upload Image</p>
                <Upload size={24} strokeWidth={1.5} />
            </div>
          )}
          
          <div className="absolute top-4 right-4 flex items-center gap-2">
             <button onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} className="w-8 h-8 rounded-lg bg-[#E6F8F6] text-[#00BFA5] shadow-sm border border-[#C2EFE9] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Upload size={14} />
             </button>
             {preview && (
               <button onClick={(e) => { e.stopPropagation(); onClear(); }} className="w-8 h-8 rounded-lg bg-[#FFF1F1] text-[#FF4D4D] shadow-sm border border-[#FEDADA] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <X size={14} />
               </button>
             )}
          </div>
          <input type="file" className="hidden" ref={fileInputRef} onChange={(e) => { if(e.target.files[0]) onUpload(e.target.files[0]); }} />
       </div>
    </div>
  );
};

const VideoUploadBox = ({ title, size, preview, onUpload, onClear }) => {
  const fileInputRef = useRef(null);
  return (
    <div className="space-y-3">
       <div className="flex items-center justify-between px-0.5">
          <label className="text-xs font-bold text-gray-500">{title}({size})</label>
       </div>
       <div className="aspect-[2/1] w-full rounded-xl border border-dashed border-gray-300 bg-gray-50/50 relative overflow-hidden group hover:border-orange-300 transition-colors cursor-pointer flex items-center justify-center" onClick={() => fileInputRef.current?.click()}>
          {preview ? (
            <video src={preview} className="w-full h-full object-cover" controls={false} autoPlay loop muted playsInline />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 text-gray-400">
                <p className="text-[11px] font-bold uppercase tracking-widest">Upload Video</p>
                <Upload size={24} strokeWidth={1.5} />
            </div>
          )}
          
          <div className="absolute top-4 right-4 flex items-center gap-2">
             <button onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} className="w-8 h-8 rounded-lg bg-[#E6F8F6] text-[#00BFA5] shadow-sm border border-[#C2EFE9] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Upload size={14} />
             </button>
             {preview && (
               <button onClick={(e) => { e.stopPropagation(); onClear(); }} className="w-8 h-8 rounded-lg bg-[#FFF1F1] text-[#FF4D4D] shadow-sm border border-[#FEDADA] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <X size={14} />
               </button>
             )}
          </div>
          <input type="file" accept="video/*" className="hidden" ref={fileInputRef} onChange={(e) => { if(e.target.files[0]) onUpload(e.target.files[0]); }} />
       </div>
    </div>
  );
};

const GlobalApplicationSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Logos & Favicons state
  const [adminLogoPreview, setAdminLogoPreview] = useState(null);
  const [adminLogoFile, setAdminLogoFile] = useState(null);
  const [adminFaviconPreview, setAdminFaviconPreview] = useState(null);
  const [adminFaviconFile, setAdminFaviconFile] = useState(null);

  const [userLogoPreview, setUserLogoPreview] = useState(null);
  const [userLogoFile, setUserLogoFile] = useState(null);
  const [userFaviconPreview, setUserFaviconPreview] = useState(null);
  const [userFaviconFile, setUserFaviconFile] = useState(null);

  const [deliveryLogoPreview, setDeliveryLogoPreview] = useState(null);
  const [deliveryLogoFile, setDeliveryLogoFile] = useState(null);
  const [deliveryFaviconPreview, setDeliveryFaviconPreview] = useState(null);
  const [deliveryFaviconFile, setDeliveryFaviconFile] = useState(null);

  const [restaurantLogoPreview, setRestaurantLogoPreview] = useState(null);
  const [restaurantLogoFile, setRestaurantLogoFile] = useState(null);
  const [restaurantFaviconPreview, setRestaurantFaviconPreview] = useState(null);
  const [restaurantFaviconFile, setRestaurantFaviconFile] = useState(null);

  const [sellerLogoPreview, setSellerLogoPreview] = useState(null);
  const [sellerLogoFile, setSellerLogoFile] = useState(null);
  const [sellerFaviconPreview, setSellerFaviconPreview] = useState(null);
  const [sellerFaviconFile, setSellerFaviconFile] = useState(null);

  const [userLoginBanner1Preview, setUserLoginBanner1Preview] = useState(null);
  const [userLoginBanner1File, setUserLoginBanner1File] = useState(null);
  const [userLoginBanner2Preview, setUserLoginBanner2Preview] = useState(null);
  const [userLoginBanner2File, setUserLoginBanner2File] = useState(null);
  const [userLoginBanner3Preview, setUserLoginBanner3Preview] = useState(null);
  const [userLoginBanner3File, setUserLoginBanner3File] = useState(null);
  const [userLoginBanner4Preview, setUserLoginBanner4Preview] = useState(null);
  const [userLoginBanner4File, setUserLoginBanner4File] = useState(null);
  const [userLoginBanner5Preview, setUserLoginBanner5Preview] = useState(null);
  const [userLoginBanner5File, setUserLoginBanner5File] = useState(null);

  const [userLoginVideoPreview, setUserLoginVideoPreview] = useState(null);
  const [userLoginVideoFile, setUserLoginVideoFile] = useState(null);

  const [formData, setFormData] = useState({
    companyName: "",
    themeColor: "#0a0a0a",
    email: "",
    customerSupportEmail: "",
    partnershipEmail: "",
    helpAndSupportEmail: "",
    phoneNumber: "",
    address: "",
    legalName: "",
    gstin: "",
    fssai: "",
    panNumber: "",
    cinNumber: "",
    enableFemaleContactProtection: true,
    companySupportNumber: "",
    companyWhatsappNumber: "",
    privacyMessage: "",
    contactsViewPassword: "",
  });

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getBusinessSettings();
      const settings = response?.data?.data || response?.data;

      if (settings) {
        setFormData({
          companyName: settings.companyName || "",
          themeColor: settings.themeColor || "#0a0a0a",
          email: settings.email || "",
          customerSupportEmail: settings.customerSupportEmail || "",
          partnershipEmail: settings.partnershipEmail || "",
          helpAndSupportEmail: settings.helpAndSupportEmail || "",
          phoneNumber: settings.phone?.number || "",
          address: settings.address || "",
          legalName: settings.legalName || "",
          gstin: settings.gstin || "",
          fssai: settings.fssai || "",
          panNumber: settings.panNumber || "",
          cinNumber: settings.cinNumber || "",
          enableFemaleContactProtection: settings.enableFemaleContactProtection !== undefined ? !!settings.enableFemaleContactProtection : true,
          companySupportNumber: settings.companySupportNumber || "",
          companyWhatsappNumber: settings.companyWhatsappNumber || "",
          privacyMessage: settings.privacyMessage || "",
          contactsViewPassword: settings.contactsViewPassword || "",
        });

        if (settings.adminLogo?.url) setAdminLogoPreview(settings.adminLogo.url);
        if (settings.adminFavicon?.url) setAdminFaviconPreview(settings.adminFavicon.url);

        if (settings.userLogo?.url) setUserLogoPreview(settings.userLogo.url);
        if (settings.userFavicon?.url) setUserFaviconPreview(settings.userFavicon.url);

        if (settings.deliveryLogo?.url) setDeliveryLogoPreview(settings.deliveryLogo.url);
        if (settings.deliveryFavicon?.url) setDeliveryFaviconPreview(settings.deliveryFavicon.url);

        if (settings.restaurantLogo?.url) setRestaurantLogoPreview(settings.restaurantLogo.url);
        if (settings.restaurantFavicon?.url) setRestaurantFaviconPreview(settings.restaurantFavicon.url);

        if (settings.sellerLogo?.url) setSellerLogoPreview(settings.sellerLogo.url);
        if (settings.sellerFavicon?.url) setSellerFaviconPreview(settings.sellerFavicon.url);

        if (settings.userLoginBanner1?.url) setUserLoginBanner1Preview(settings.userLoginBanner1.url);
        if (settings.userLoginBanner2?.url) setUserLoginBanner2Preview(settings.userLoginBanner2.url);
        if (settings.userLoginBanner3?.url) setUserLoginBanner3Preview(settings.userLoginBanner3.url);
        if (settings.userLoginBanner4?.url) setUserLoginBanner4Preview(settings.userLoginBanner4.url);
        if (settings.userLoginBanner5?.url) setUserLoginBanner5Preview(settings.userLoginBanner5.url);
        if (settings.userLoginVideo?.url) setUserLoginVideoPreview(settings.userLoginVideo.url);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleUpdate = async () => {
    try {
      if (!formData.companyName.trim()) {
        toast.error("Application name is required");
        return;
      }
      setSaving(true);
      const dataToSend = {
        companyName: formData.companyName.trim(),
        themeColor: formData.themeColor,
        email: formData.email,
        customerSupportEmail: formData.customerSupportEmail,
        partnershipEmail: formData.partnershipEmail,
        helpAndSupportEmail: formData.helpAndSupportEmail,
        phoneNumber: formData.phoneNumber,
        address: formData.address,
        legalName: formData.legalName,
        gstin: formData.gstin,
        fssai: formData.fssai,
        panNumber: formData.panNumber,
        cinNumber: formData.cinNumber,
        enableFemaleContactProtection: formData.enableFemaleContactProtection,
        companySupportNumber: formData.companySupportNumber,
        companyWhatsappNumber: formData.companyWhatsappNumber,
        privacyMessage: formData.privacyMessage,
        contactsViewPassword: formData.contactsViewPassword,
        
        // Send URLs to clear them if preview is null
        adminLogoUrl: adminLogoPreview ? (adminLogoPreview.startsWith('blob:') ? undefined : adminLogoPreview) : "",
        adminFaviconUrl: adminFaviconPreview ? (adminFaviconPreview.startsWith('blob:') ? undefined : adminFaviconPreview) : "",
        userLogoUrl: userLogoPreview ? (userLogoPreview.startsWith('blob:') ? undefined : userLogoPreview) : "",
        userFaviconUrl: userFaviconPreview ? (userFaviconPreview.startsWith('blob:') ? undefined : userFaviconPreview) : "",
        deliveryLogoUrl: deliveryLogoPreview ? (deliveryLogoPreview.startsWith('blob:') ? undefined : deliveryLogoPreview) : "",
        deliveryFaviconUrl: deliveryFaviconPreview ? (deliveryFaviconPreview.startsWith('blob:') ? undefined : deliveryFaviconPreview) : "",
        restaurantLogoUrl: restaurantLogoPreview ? (restaurantLogoPreview.startsWith('blob:') ? undefined : restaurantLogoPreview) : "",
        restaurantFaviconUrl: restaurantFaviconPreview ? (restaurantFaviconPreview.startsWith('blob:') ? undefined : restaurantFaviconPreview) : "",
        sellerLogoUrl: sellerLogoPreview ? (sellerLogoPreview.startsWith('blob:') ? undefined : sellerLogoPreview) : "",
        sellerFaviconUrl: sellerFaviconPreview ? (sellerFaviconPreview.startsWith('blob:') ? undefined : sellerFaviconPreview) : "",
        
        userLoginBanner1Url: userLoginBanner1Preview ? (userLoginBanner1Preview.startsWith('blob:') ? undefined : userLoginBanner1Preview) : "",
        userLoginBanner2Url: userLoginBanner2Preview ? (userLoginBanner2Preview.startsWith('blob:') ? undefined : userLoginBanner2Preview) : "",
        userLoginBanner3Url: userLoginBanner3Preview ? (userLoginBanner3Preview.startsWith('blob:') ? undefined : userLoginBanner3Preview) : "",
        userLoginBanner4Url: userLoginBanner4Preview ? (userLoginBanner4Preview.startsWith('blob:') ? undefined : userLoginBanner4Preview) : "",
        userLoginBanner5Url: userLoginBanner5Preview ? (userLoginBanner5Preview.startsWith('blob:') ? undefined : userLoginBanner5Preview) : "",
        userLoginVideoUrl: userLoginVideoPreview ? (userLoginVideoPreview.startsWith('blob:') ? undefined : userLoginVideoPreview) : "",
      };

      const files = {};

      if (adminLogoFile) files.adminLogo = adminLogoFile;
      if (adminFaviconFile) files.adminFavicon = adminFaviconFile;

      if (userLogoFile) files.userLogo = userLogoFile;
      if (userFaviconFile) files.userFavicon = userFaviconFile;

      if (deliveryLogoFile) files.deliveryLogo = deliveryLogoFile;
      if (deliveryFaviconFile) files.deliveryFavicon = deliveryFaviconFile;

      if (restaurantLogoFile) files.restaurantLogo = restaurantLogoFile;
      if (restaurantFaviconFile) files.restaurantFavicon = restaurantFaviconFile;

      if (sellerLogoFile) files.sellerLogo = sellerLogoFile;
      if (sellerFaviconFile) files.sellerFavicon = sellerFaviconFile;

      if (userLoginBanner1File) files.userLoginBanner1 = userLoginBanner1File;
      if (userLoginBanner2File) files.userLoginBanner2 = userLoginBanner2File;
      if (userLoginBanner3File) files.userLoginBanner3 = userLoginBanner3File;
      if (userLoginBanner4File) files.userLoginBanner4 = userLoginBanner4File;
      if (userLoginBanner5File) files.userLoginBanner5 = userLoginBanner5File;
      if (userLoginVideoFile) files.userLoginVideo = userLoginVideoFile;

      const response = await adminAPI.updateBusinessSettings(dataToSend, files);
      const updatedSettings = response?.data?.data || response?.data;

      if (updatedSettings) {
        setCachedSettings(updatedSettings);
      }
      toast.success('Configuration saved successfully!');
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (file, setFile, setPreview) => {
    const compressed = await compressImage(file);
    setFile(compressed);
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result || ''));
    reader.readAsDataURL(compressed);
  };

  const handleVideoUpload = (file, setFile, setPreview) => {
    setFile(file);
    const url = URL.createObjectURL(file);
    setPreview(url);
  };

  if (loading) {
     return (
       <div className="min-h-screen flex items-center justify-center bg-gray-50">
         <Loader2 className="w-10 h-10 text-primary animate-spin" />
       </div>
     );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-10 font-sans">
      
      {/* Header */}
      <div className="mb-10 flex items-center justify-between">
        <h1 className="text-[15px] font-black text-gray-800 uppercase tracking-widest">GLOBAL SETTINGS</h1>
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-widest">
           <span>Common</span>
           <ChevronRight size={12} strokeWidth={3} />
           <span className="text-gray-600">Global Settings</span>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto space-y-10 pb-32">
        
        {/* Basic Identification */}
        <SectionCard title="Application Identification">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
              <InputField label="App Name" name="companyName" value={formData.companyName} onChange={handleChange} placeholder="AppZeto" />
              <InputField label="Support User Id" name="email" value={formData.email} onChange={handleChange} placeholder="admin@appzeto.com" />
              <InputField label="Support Phone" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} placeholder="0000000000" />
              <InputField label="Office Address" name="address" value={formData.address} onChange={handleChange} placeholder="Main Street, NY" />
           </div>
        </SectionCard>

        {/* Legal & Tax Details */}
        <SectionCard title="Legal & Tax Details (Invoice)">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
              <InputField label="Legal Entity Name" name="legalName" value={formData.legalName} onChange={handleChange} placeholder="ITZO LIMITED" />
              <InputField label="GSTIN" name="gstin" value={formData.gstin} onChange={handleChange} placeholder="22AAAAA0000A1Z5" />
              <InputField label="FSSAI Number" name="fssai" value={formData.fssai} onChange={handleChange} placeholder="10000000000000" />
              <InputField label="PAN Number" name="panNumber" value={formData.panNumber} onChange={handleChange} placeholder="ABCDE1234F" />
              <InputField label="CIN Number" name="cinNumber" value={formData.cinNumber} onChange={handleChange} placeholder="U12345MH2024PTC123456" />
           </div>
        </SectionCard>

        {/* Contact & Support Emails */}
        <SectionCard title="Contact & Support Emails">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
              <InputField label="Customer Support Email (/contact page)" name="customerSupportEmail" value={formData.customerSupportEmail} onChange={handleChange} placeholder="support@itzofood.com" />
              <InputField label="Partnership Email (/contact page)" name="partnershipEmail" value={formData.partnershipEmail} onChange={handleChange} placeholder="partners@itzofood.com" />
              <InputField label="Help & Support Email (Help page)" name="helpAndSupportEmail" value={formData.helpAndSupportEmail} onChange={handleChange} placeholder="support@itzofood.com" />
           </div>
        </SectionCard>

        {/* Customer Privacy Settings */}
        <SectionCard title="Customer Privacy Settings">
           <div className="space-y-6">
              <ToggleField 
                 label="Enable Female Contact Protection" 
                 name="enableFemaleContactProtection" 
                 checked={formData.enableFemaleContactProtection} 
                 onChange={handleChange} 
                 info="If enabled, delivery partners will not see contact numbers for female customers and will be routed to Support instead."
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 mt-4">
                 <InputField label="Company Support Number" name="companySupportNumber" value={formData.companySupportNumber} onChange={handleChange} placeholder="+91XXXXXXXXXX" />
                 <InputField label="Company WhatsApp Number" name="companyWhatsappNumber" value={formData.companyWhatsappNumber} onChange={handleChange} placeholder="+91XXXXXXXXXX" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Privacy Message (Shown to Customers)</label>
                <textarea
                  name="privacyMessage"
                  value={formData.privacyMessage || ''}
                  onChange={(e) => handleChange('privacyMessage', e.target.value)}
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-800 bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors shadow-sm resize-none"
                  placeholder="Enter privacy message shown when contacts are protected"
                />
              </div>
            
              <div className="md:col-span-2 pt-4 border-t border-gray-100 mt-2">
                <h4 className="text-sm font-semibold text-gray-800 mb-3">Admin Security Features</h4>
                <InputField
                  label="Customer Contacts Viewer Password"
                  name="contactsViewPassword"
                  value={formData.contactsViewPassword}
                  onChange={handleChange}
                  placeholder="Enter password required to view customer contacts"
                />
                <p className="text-[11px] text-gray-500 mt-1">This password will be required by any subadmin trying to view customer contacts in the ECS Panel.</p>
              </div>
           </div>
        </SectionCard>

        {/* Individual App Assets */}
        <SectionCard title="ECS Application">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <ImageUploadBox title="ECS Logo" size="200px x 50px" preview={adminLogoPreview} onUpload={(file) => handleFileUpload(file, setAdminLogoFile, setAdminLogoPreview)} onClear={() => { setAdminLogoPreview(null); setAdminLogoFile(null); }} />
              <ImageUploadBox title="ECS Favicon" size="80px x 80px" preview={adminFaviconPreview} onUpload={(file) => handleFileUpload(file, setAdminFaviconFile, setAdminFaviconPreview)} onClear={() => { setAdminFaviconPreview(null); setAdminFaviconFile(null); }} />
           </div>
        </SectionCard>

        <SectionCard title="User Application">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <ImageUploadBox title="User Logo" size="200px x 50px" preview={userLogoPreview} onUpload={(file) => handleFileUpload(file, setUserLogoFile, setUserLogoPreview)} onClear={() => { setUserLogoPreview(null); setUserLogoFile(null); }} />
              <ImageUploadBox title="User Favicon" size="80px x 80px" preview={userFaviconPreview} onUpload={(file) => handleFileUpload(file, setUserFaviconFile, setUserFaviconPreview)} onClear={() => { setUserFaviconPreview(null); setUserFaviconFile(null); }} />
           </div>
        </SectionCard>

        <SectionCard title="Delivery Application">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <ImageUploadBox title="Delivery Logo" size="200px x 50px" preview={deliveryLogoPreview} onUpload={(file) => handleFileUpload(file, setDeliveryLogoFile, setDeliveryLogoPreview)} onClear={() => { setDeliveryLogoPreview(null); setDeliveryLogoFile(null); }} />
              <ImageUploadBox title="Delivery Favicon" size="80px x 80px" preview={deliveryFaviconPreview} onUpload={(file) => handleFileUpload(file, setDeliveryFaviconFile, setDeliveryFaviconPreview)} onClear={() => { setDeliveryFaviconPreview(null); setDeliveryFaviconFile(null); }} />
           </div>
        </SectionCard>

        <SectionCard title="Restaurant Application">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <ImageUploadBox title="Restaurant Logo" size="200px x 50px" preview={restaurantLogoPreview} onUpload={(file) => handleFileUpload(file, setRestaurantLogoFile, setRestaurantLogoPreview)} onClear={() => { setRestaurantLogoPreview(null); setRestaurantLogoFile(null); }} />
              <ImageUploadBox title="Restaurant Favicon" size="80px x 80px" preview={restaurantFaviconPreview} onUpload={(file) => handleFileUpload(file, setRestaurantFaviconFile, setRestaurantFaviconPreview)} onClear={() => { setRestaurantFaviconPreview(null); setRestaurantFaviconFile(null); }} />
           </div>
        </SectionCard>

        <SectionCard title="Seller Application">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <ImageUploadBox title="Seller Logo" size="200px x 50px" preview={sellerLogoPreview} onUpload={(file) => handleFileUpload(file, setSellerLogoFile, setSellerLogoPreview)} onClear={() => { setSellerLogoPreview(null); setSellerLogoFile(null); }} />
              <ImageUploadBox title="Seller Favicon" size="80px x 80px" preview={sellerFaviconPreview} onUpload={(file) => handleFileUpload(file, setSellerFaviconFile, setSellerFaviconPreview)} onClear={() => { setSellerFaviconPreview(null); setSellerFaviconFile(null); }} />
           </div>
        </SectionCard>

        <SectionCard title="User Login Background Banners">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
              <ImageUploadBox title="Banner 1" size="HD" preview={userLoginBanner1Preview} onUpload={(file) => handleFileUpload(file, setUserLoginBanner1File, setUserLoginBanner1Preview)} onClear={() => { setUserLoginBanner1Preview(null); setUserLoginBanner1File(null); }} />
              <ImageUploadBox title="Banner 2" size="HD" preview={userLoginBanner2Preview} onUpload={(file) => handleFileUpload(file, setUserLoginBanner2File, setUserLoginBanner2Preview)} onClear={() => { setUserLoginBanner2Preview(null); setUserLoginBanner2File(null); }} />
              <ImageUploadBox title="Banner 3" size="HD" preview={userLoginBanner3Preview} onUpload={(file) => handleFileUpload(file, setUserLoginBanner3File, setUserLoginBanner3Preview)} onClear={() => { setUserLoginBanner3Preview(null); setUserLoginBanner3File(null); }} />
              <ImageUploadBox title="Banner 4" size="HD" preview={userLoginBanner4Preview} onUpload={(file) => handleFileUpload(file, setUserLoginBanner4File, setUserLoginBanner4Preview)} onClear={() => { setUserLoginBanner4Preview(null); setUserLoginBanner4File(null); }} />
              <ImageUploadBox title="Banner 5" size="HD" preview={userLoginBanner5Preview} onUpload={(file) => handleFileUpload(file, setUserLoginBanner5File, setUserLoginBanner5Preview)} onClear={() => { setUserLoginBanner5Preview(null); setUserLoginBanner5File(null); }} />
           </div>
           
           <div className="mt-8 border-t border-gray-100 pt-8">
              <h4 className="text-[13px] font-bold text-gray-700 uppercase tracking-tight mb-4">Video Background (Overrides Banners)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                 <VideoUploadBox title="Login Video" size="MP4/WebM" preview={userLoginVideoPreview} onUpload={(file) => handleVideoUpload(file, setUserLoginVideoFile, setUserLoginVideoPreview)} onClear={() => { setUserLoginVideoPreview(null); setUserLoginVideoFile(null); }} />
              </div>
           </div>
        </SectionCard>

      </div>

      {/* Persistence Controls */}
      <div className="fixed bottom-10 right-10">
         <button onClick={handleUpdate} disabled={saving} className="bg-[#00BFA5] text-white w-16 h-16 rounded-full flex items-center justify-center shadow-[0_15px_40px_rgba(0,191,165,0.4)] hover:bg-[#00AC95] active:scale-90 transition-all disabled:opacity-50">
            {saving ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />}
         </button>
      </div>

    </div>
  );
};

export default GlobalApplicationSettings;
