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
  const inputClass = "w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-800 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors shadow-sm";
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
        <div className="mt-2 bg-[#FFF8F0] border border-red-100 rounded-lg px-4 py-2 flex items-center gap-2">
          <span className="text-[11px] text-gray-500 italic">Example: {info.prefix}</span>
          <span className="text-[11px] bg-[#00BFA5] text-white px-2 py-0.5 rounded font-bold">{value || info.default}</span>
        </div>
      )}
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
      <div className="aspect-[2/1] w-full rounded-xl border border-dashed border-gray-300 bg-gray-50/50 relative overflow-hidden group hover:border-indigo-300 transition-colors cursor-pointer flex items-center justify-center" onClick={() => fileInputRef.current?.click()}>
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
        <input type="file" className="hidden" ref={fileInputRef} onChange={(e) => { if (e.target.files[0]) onUpload(e.target.files[0]); }} />
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

  const [sellerLoginBannerPreview, setSellerLoginBannerPreview] = useState(null);
  const [sellerLoginBannerFile, setSellerLoginBannerFile] = useState(null);
  const [sellerLoginBannerActive, setSellerLoginBannerActive] = useState(true);

  const [restaurantLoginBannerPreview, setRestaurantLoginBannerPreview] = useState(null);
  const [restaurantLoginBannerFile, setRestaurantLoginBannerFile] = useState(null);
  const [restaurantLoginBannerActive, setRestaurantLoginBannerActive] = useState(true);

  const [formData, setFormData] = useState({
    companyName: "",
    themeColor: "#0a0a0a",
    email: "",
    phoneNumber: "",
    address: "",
    codEnabled: true,
    onlineEnabled: true,
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
          phoneNumber: settings.phone?.number || "",
          address: settings.address || "",
          codEnabled: settings.codEnabled !== false,
          onlineEnabled: settings.onlineEnabled !== false,
        });

        syncMediaStateFromSettings(settings);
        setSellerLoginBannerActive(settings.sellerLoginBanner?.active !== false);
        setRestaurantLoginBannerActive(settings.restaurantLoginBanner?.active !== false);
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
    let finalValue = value;
    if (name === 'phoneNumber') {
      finalValue = value.replace(/\D/g, "").slice(0, 10);
    }
    setFormData(prev => ({
      ...prev,
      [name]: finalValue
    }));
  };

  const buildMediaUrlPayload = (preview, file) => (
    (file || preview) ? undefined : ""
  );

  const syncMediaStateFromSettings = (settings) => {
    setAdminLogoPreview(settings.adminLogo?.url || null);
    setAdminLogoFile(null);
    setAdminFaviconPreview(settings.adminFavicon?.url || null);
    setAdminFaviconFile(null);
    setUserLogoPreview(settings.userLogo?.url || null);
    setUserLogoFile(null);
    setUserFaviconPreview(settings.userFavicon?.url || null);
    setUserFaviconFile(null);
    setDeliveryLogoPreview(settings.deliveryLogo?.url || null);
    setDeliveryLogoFile(null);
    setDeliveryFaviconPreview(settings.deliveryFavicon?.url || null);
    setDeliveryFaviconFile(null);
    setRestaurantLogoPreview(settings.restaurantLogo?.url || null);
    setRestaurantLogoFile(null);
    setRestaurantFaviconPreview(settings.restaurantFavicon?.url || null);
    setRestaurantFaviconFile(null);
    setSellerLogoPreview(settings.sellerLogo?.url || null);
    setSellerLogoFile(null);
    setSellerFaviconPreview(settings.sellerFavicon?.url || null);
    setSellerFaviconFile(null);
    setSellerLoginBannerPreview(settings.sellerLoginBanner?.url || null);
    setSellerLoginBannerFile(null);
    setRestaurantLoginBannerPreview(settings.restaurantLoginBanner?.url || null);
    setRestaurantLoginBannerFile(null);
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
        phoneNumber: formData.phoneNumber,
        address: formData.address,
        codEnabled: formData.codEnabled,
        onlineEnabled: formData.onlineEnabled,
        adminLogoUrl: buildMediaUrlPayload(adminLogoPreview, adminLogoFile),
        adminFaviconUrl: buildMediaUrlPayload(adminFaviconPreview, adminFaviconFile),
        userLogoUrl: buildMediaUrlPayload(userLogoPreview, userLogoFile),
        userFaviconUrl: buildMediaUrlPayload(userFaviconPreview, userFaviconFile),
        deliveryLogoUrl: buildMediaUrlPayload(deliveryLogoPreview, deliveryLogoFile),
        deliveryFaviconUrl: buildMediaUrlPayload(deliveryFaviconPreview, deliveryFaviconFile),
        restaurantLogoUrl: buildMediaUrlPayload(restaurantLogoPreview, restaurantLogoFile),
        restaurantFaviconUrl: buildMediaUrlPayload(restaurantFaviconPreview, restaurantFaviconFile),
        sellerLogoUrl: buildMediaUrlPayload(sellerLogoPreview, sellerLogoFile),
        sellerFaviconUrl: buildMediaUrlPayload(sellerFaviconPreview, sellerFaviconFile),
        sellerLoginBannerUrl: buildMediaUrlPayload(sellerLoginBannerPreview, sellerLoginBannerFile),
        sellerLoginBannerActive: sellerLoginBannerActive,
        restaurantLoginBannerUrl: buildMediaUrlPayload(restaurantLoginBannerPreview, restaurantLoginBannerFile),
        restaurantLoginBannerActive: restaurantLoginBannerActive,
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

      if (sellerLoginBannerFile) files.sellerLoginBanner = sellerLoginBannerFile;
      if (restaurantLoginBannerFile) files.restaurantLoginBanner = restaurantLoginBannerFile;

      const response = await adminAPI.updateBusinessSettings(dataToSend, files);
      const updatedSettings = response?.data?.data || response?.data;

      if (updatedSettings) {
        setCachedSettings(updatedSettings);
        syncMediaStateFromSettings(updatedSettings);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
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
            <InputField label="App Name" name="companyName" value={formData.companyName} onChange={handleChange} placeholder="DukaanWallah" />
            <InputField label="ECS Theme Color" name="themeColor" value={formData.themeColor} onChange={handleChange} placeholder="#0a0a0a" />
            <InputField label="Support Email" name="email" value={formData.email} onChange={handleChange} placeholder="[EMAIL_ADDRESS]" />
            <InputField label="Support Phone" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} placeholder="0000000000" />
            <InputField label="Office Address" name="address" value={formData.address} onChange={handleChange} placeholder="Main Street, NY" />
          </div>
        </SectionCard>

        <SectionCard title="Payment Options">
          <p className="text-sm text-gray-500 mb-6">
            Control which payment methods are available to customers in Food and Quick Commerce checkout.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <label className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50/50 cursor-pointer hover:border-indigo-200 transition-colors">
              <input
                type="checkbox"
                checked={formData.codEnabled}
                onChange={(e) => handleChange('codEnabled', e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-gray-200 rounded focus:ring-indigo-500 cursor-pointer"
              />
              <div>
                <span className="text-sm font-semibold text-gray-800">Cash on Delivery (COD)</span>
                <p className="text-xs text-gray-500 mt-0.5">Allow customers to pay with cash at delivery</p>
              </div>
            </label>
            <label className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50/50 cursor-pointer hover:border-indigo-200 transition-colors">
              <input
                type="checkbox"
                checked={formData.onlineEnabled}
                onChange={(e) => handleChange('onlineEnabled', e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-gray-200 rounded focus:ring-indigo-500 cursor-pointer"
              />
              <div>
                <span className="text-sm font-semibold text-gray-800">Online Payment</span>
                <p className="text-xs text-gray-500 mt-0.5">Allow customers to pay online via Razorpay</p>
              </div>
            </label>
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

        <SectionCard title="Portal Login Banners">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-4">
              <ImageUploadBox 
                title="Seller Login Banner" 
                size="1920px x 1080px (Landscape)" 
                preview={sellerLoginBannerPreview} 
                onUpload={(file) => handleFileUpload(file, setSellerLoginBannerFile, setSellerLoginBannerPreview)} 
                onClear={() => { setSellerLoginBannerPreview(null); setSellerLoginBannerFile(null); }} 
              />
              <div className="flex items-center gap-3 mt-4">
                <input 
                  type="checkbox" 
                  id="sellerLoginBannerActive" 
                  checked={sellerLoginBannerActive}
                  onChange={(e) => setSellerLoginBannerActive(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-gray-200 rounded focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="sellerLoginBannerActive" className="text-xs font-semibold text-gray-700 cursor-pointer select-none">
                  Activate Seller Login Banner
                </label>
              </div>
            </div>

            <div className="space-y-4">
              <ImageUploadBox 
                title="Restaurant Login Banner" 
                size="1920px x 1080px (Landscape)" 
                preview={restaurantLoginBannerPreview} 
                onUpload={(file) => handleFileUpload(file, setRestaurantLoginBannerFile, setRestaurantLoginBannerPreview)} 
                onClear={() => { setRestaurantLoginBannerPreview(null); setRestaurantLoginBannerFile(null); }} 
              />
              <div className="flex items-center gap-3 mt-4">
                <input 
                  type="checkbox" 
                  id="restaurantLoginBannerActive" 
                  checked={restaurantLoginBannerActive}
                  onChange={(e) => setRestaurantLoginBannerActive(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-gray-200 rounded focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="restaurantLoginBannerActive" className="text-xs font-semibold text-gray-700 cursor-pointer select-none">
                  Activate Restaurant Login Banner
                </label>
              </div>
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
