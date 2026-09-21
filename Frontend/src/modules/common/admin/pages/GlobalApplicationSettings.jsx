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

const VideoUploadBox = ({ title, size, preview, onUpload, onClear }) => {
  const fileInputRef = useRef(null);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-0.5">
        <label className="text-xs font-bold text-gray-500">{title}({size})</label>
      </div>
      <div className="aspect-[2/1] w-full rounded-xl border border-dashed border-gray-300 bg-gray-50/50 relative overflow-hidden group hover:border-indigo-300 transition-colors cursor-pointer flex items-center justify-center" onClick={() => fileInputRef.current?.click()}>
        {preview ? (
          <video src={preview} className="w-full h-full object-cover" autoPlay loop muted playsInline />
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
        <input type="file" accept="video/*" className="hidden" ref={fileInputRef} onChange={(e) => { if (e.target.files[0]) onUpload(e.target.files[0]); }} />
      </div>
    </div>
  );
};

const USER_LOGIN_BANNER_KEYS = ['userLoginBanner1', 'userLoginBanner2', 'userLoginBanner3', 'userLoginBanner4', 'userLoginBanner5'];

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

  // User login background banners + video: { [key]: { preview, file } }
  const [userLoginMedia, setUserLoginMedia] = useState({});
  const setUserLoginMediaEntry = (key, entry) => setUserLoginMedia((prev) => ({ ...prev, [key]: entry }));

  const [formData, setFormData] = useState({
    companyName: "",
    themeColor: "#0a0a0a",
    email: "",
    customerSupportEmail: "",
    partnershipEmail: "",
    helpAndSupportEmail: "",
    phoneNumber: "",
    address: "",
    codEnabled: true,
    onlineEnabled: true,
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
          codEnabled: settings.codEnabled !== false,
          onlineEnabled: settings.onlineEnabled !== false,
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
    const nextUserLoginMedia = {};
    [...USER_LOGIN_BANNER_KEYS, 'userLoginVideo'].forEach((key) => {
      nextUserLoginMedia[key] = { preview: settings[key]?.url || null, file: null };
    });
    setUserLoginMedia(nextUserLoginMedia);
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
        codEnabled: formData.codEnabled,
        onlineEnabled: formData.onlineEnabled,
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
      [...USER_LOGIN_BANNER_KEYS, 'userLoginVideo'].forEach((key) => {
        dataToSend[`${key}Url`] = buildMediaUrlPayload(userLoginMedia[key]?.preview, userLoginMedia[key]?.file);
      });

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
      [...USER_LOGIN_BANNER_KEYS, 'userLoginVideo'].forEach((key) => {
        if (userLoginMedia[key]?.file) files[key] = userLoginMedia[key].file;
      });

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

  const handleUserLoginBannerUpload = async (key, file) => {
    const compressed = await compressImage(file);
    const reader = new FileReader();
    reader.onload = () => setUserLoginMediaEntry(key, { preview: String(reader.result || ''), file: compressed });
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
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-800 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors shadow-sm resize-none"
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

        <SectionCard title="User Login Background Banners">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            {USER_LOGIN_BANNER_KEYS.map((key, idx) => (
              <ImageUploadBox
                key={key}
                title={`Banner ${idx + 1}`}
                size="HD"
                preview={userLoginMedia[key]?.preview}
                onUpload={(file) => handleUserLoginBannerUpload(key, file)}
                onClear={() => setUserLoginMediaEntry(key, { preview: null, file: null })}
              />
            ))}
          </div>

          <div className="mt-8 border-t border-gray-100 pt-8">
            <h4 className="text-[13px] font-bold text-gray-700 uppercase tracking-tight mb-4">Video Background (Overrides Banners)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
              <VideoUploadBox
                title="Login Video"
                size="MP4/WebM"
                preview={userLoginMedia.userLoginVideo?.preview}
                onUpload={(file) => setUserLoginMediaEntry('userLoginVideo', { preview: URL.createObjectURL(file), file })}
                onClear={() => setUserLoginMediaEntry('userLoginVideo', { preview: null, file: null })}
              />
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
