import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronRight,
  Save,
  Loader2,
  Upload,
  X,
  Video
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
          className={inputClass}
        />
      </div>
      {info && (
        <div className="mt-2 bg-[#FFF8F0] border border-[#f0e7f9] rounded-lg px-4 py-2 flex items-center gap-2">
          <span className="text-[11px] text-gray-500 italic">Example: {info.prefix}</span>
          <span className="text-[11px] bg-[#00BFA5] text-white px-2 py-0.5 rounded font-bold">{value || info.default}</span>
        </div>
      )}
    </div>
  );
};

let videoPlaylistKeySeq = 0;
const nextVideoKey = () => `v${Date.now()}-${videoPlaylistKeySeq++}`;

/** Converts a stored {url, publicId} playlist into the box's editable item list. */
const toPlaylistItems = (list) =>
  (Array.isArray(list) ? list : [])
    .filter((v) => v?.url)
    .map((v) => ({ key: nextVideoKey(), type: 'existing', url: v.url, publicId: v.publicId || '' }));

/**
 * A hero video playlist editor: shows every clip as a tile (in play order), lets the
 * admin drop any one of them and add more — new files are appended at the end, which
 * is exactly where the backend puts newly uploaded clips too, so the order shown here
 * always matches what actually plays.
 */
const VideoPlaylistBox = ({ title, hint, items, onChange, maxSizeMB = 100 }) => {
  const fileInputRef = useRef(null);

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    const tooLarge = incoming.find((f) => f.size > maxSizeMB * 1024 * 1024);
    if (tooLarge) {
      toast.error(`Video size exceeds the maximum allowed limit. Please upload videos smaller than ${maxSizeMB} MB.`);
      return;
    }
    const newItems = incoming.map((file) => ({
      key: nextVideoKey(),
      type: 'new',
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    onChange([...items, ...newItems]);
  };

  const removeAt = (key) => onChange(items.filter((item) => item.key !== key));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-0.5">
        <label className="text-xs font-bold text-gray-500">{title}</label>
        {hint && <span className="text-[11px] text-gray-400">{hint}</span>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {items.map((item, idx) => (
          <div key={item.key} className="relative aspect-video rounded-xl border border-gray-200 overflow-hidden bg-black group">
            <video
              src={item.type === 'new' ? item.previewUrl : item.url}
              className="w-full h-full object-cover"
              muted
              loop
              autoPlay
              playsInline
            />
            <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
              {idx + 1}
            </div>
            <button
              type="button"
              onClick={() => removeAt(item.key)}
              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-[#FFF1F1] text-[#FF4D4D] shadow-sm border border-[#FEDADA] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={12} />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="aspect-video rounded-xl border border-dashed border-gray-300 bg-gray-50/50 hover:border-[#c1a0e8] transition-colors flex flex-col items-center justify-center gap-1.5 text-gray-400"
        >
          <Video size={20} strokeWidth={1.5} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Add Video(s)</span>
        </button>
      </div>

      <input
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        ref={fileInputRef}
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
};

const MediaUploadBox = ({ title, size, preview, onUpload, onClear, type = 'image', maxSizeMB }) => {
  const fileInputRef = useRef(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-0.5">
        <label className="text-xs font-bold text-gray-500">{title}({size})</label>
      </div>
      <div className="aspect-video w-full rounded-xl border border-dashed border-gray-300 bg-gray-50/50 relative overflow-hidden group hover:border-[#c1a0e8] transition-colors cursor-pointer flex items-center justify-center" onClick={() => fileInputRef.current?.click()}>
        {preview ? (
          type === 'video' ? (
            <video src={preview} className="w-full h-full object-cover" muted loop autoPlay playsInline />
          ) : (
            <img src={preview} alt={title} className="w-full h-full object-cover" />
          )
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 text-gray-400">
            <p className="text-[11px] font-bold uppercase tracking-widest">Upload {type}</p>
            {type === 'video' ? <Video size={24} strokeWidth={1.5} /> : <Upload size={24} strokeWidth={1.5} />}
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
        <input
          type="file"
          accept={type === 'video' ? "video/*" : "image/*"}
          className="hidden"
          ref={fileInputRef}
          onChange={(e) => {
            const file = e.target.files[0];
            if (file) {
              if (maxSizeMB && file.size > maxSizeMB * 1024 * 1024) {
                if (type === 'video') {
                  toast.error(`Video size exceeds the maximum allowed limit. Please upload a video smaller than ${maxSizeMB} MB.`);
                  window.alert(`Video size exceeds the maximum allowed limit. Please upload a video smaller than ${maxSizeMB} MB.`);
                } else {
                  toast.error(`Image size exceeds the maximum allowed limit. Please upload an image smaller than ${maxSizeMB} MB.`);
                  window.alert(`Image size exceeds the maximum allowed limit. Please upload an image smaller than ${maxSizeMB} MB.`);
                }
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
              }
              onUpload(file);
            }
          }}
        />
      </div>
    </div>
  );
};

const ItzoFoodLandingSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Media state
  const [landingPosterPreview, setLandingPosterPreview] = useState(null);
  const [landingPosterFile, setLandingPosterFile] = useState(null);

  // Hero video playlists — independent lists for the marketing landing page ("/")
  // and the logged-in home page ("/food/user"). Each item is either
  // { type: 'existing', url, publicId } (already saved) or { type: 'new', file, previewUrl }.
  const [landingVideos, setLandingVideos] = useState([]);
  const [homeHeroVideos, setHomeHeroVideos] = useState([]);

  const [landingPizzaPreview, setLandingPizzaPreview] = useState(null);
  const [landingPizzaFile, setLandingPizzaFile] = useState(null);

  const [landingTomatoPreview, setLandingTomatoPreview] = useState(null);
  const [landingTomatoFile, setLandingTomatoFile] = useState(null);

  const [landingQrCodePreview, setLandingQrCodePreview] = useState(null);
  const [landingQrCodeFile, setLandingQrCodeFile] = useState(null);

  const [landingAppStoreBadgePreview, setLandingAppStoreBadgePreview] = useState(null);
  const [landingAppStoreBadgeFile, setLandingAppStoreBadgeFile] = useState(null);

  const [landingPlayStoreBadgePreview, setLandingPlayStoreBadgePreview] = useState(null);
  const [landingPlayStoreBadgeFile, setLandingPlayStoreBadgeFile] = useState(null);

  const [landingFooterLogoPreview, setLandingFooterLogoPreview] = useState(null);
  const [landingFooterLogoFile, setLandingFooterLogoFile] = useState(null);

  const [landingNavbarLogoPreview, setLandingNavbarLogoPreview] = useState(null);
  const [landingNavbarLogoFile, setLandingNavbarLogoFile] = useState(null);

  const [benefitsImagePreview, setBenefitsImagePreview] = useState(null);
  const [benefitsImageFile, setBenefitsImageFile] = useState(null);

  const [formData, setFormData] = useState({
    landingHeroTitle: "ItzoFood",
    landingHeroSubtitle: "Discover upto 30% off on your favourite meals & drinks in your city",
    socialLinkedinUrl: "",
    socialInstagramUrl: "",
    socialYoutubeUrl: "",
    socialFacebookUrl: "",
    socialTwitterUrl: "",
    playStoreLink: "",
    appStoreLink: "",
    benefitsSectionEnabled: false,
    benefitsImageAlt: "",
    benefitsImageLink: "",
  });

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getBusinessSettings();
      const settings = response?.data?.data || response?.data;

      if (settings) {
        setFormData({
          landingHeroTitle: settings.landingHeroTitle || "ItzoFood",
          landingHeroSubtitle: settings.landingHeroSubtitle || "Discover up to 30% better food value",
          socialLinkedinUrl: settings.socialLinkedinUrl || "",
          socialInstagramUrl: settings.socialInstagramUrl || "",
          socialYoutubeUrl: settings.socialYoutubeUrl || "",
          socialFacebookUrl: settings.socialFacebookUrl || "",
          socialTwitterUrl: settings.socialTwitterUrl || "",
          playStoreLink: settings.playStoreLink || "",
          appStoreLink: settings.appStoreLink || "",
          benefitsSectionEnabled: settings.benefitsSectionEnabled || false,
          benefitsImageAlt: settings.benefitsImageAlt || "",
          benefitsImageLink: settings.benefitsImageLink || "",
        });

        if (settings.landingPoster?.url) setLandingPosterPreview(settings.landingPoster.url);
        setLandingVideos(toPlaylistItems(settings.landingVideos));
        setHomeHeroVideos(toPlaylistItems(settings.homeHeroVideos));
        if (settings.landingPizzaImage?.url) setLandingPizzaPreview(settings.landingPizzaImage.url);
        if (settings.landingTomatoImage?.url) setLandingTomatoPreview(settings.landingTomatoImage.url);
        if (settings.landingQrCodeImage?.url) setLandingQrCodePreview(settings.landingQrCodeImage.url);
        if (settings.landingAppStoreBadge?.url) setLandingAppStoreBadgePreview(settings.landingAppStoreBadge.url);
        if (settings.landingPlayStoreBadge?.url) setLandingPlayStoreBadgePreview(settings.landingPlayStoreBadge.url);
        if (settings.landingFooterLogo?.url) setLandingFooterLogoPreview(settings.landingFooterLogo.url);
        if (settings.landingNavbarLogo?.url) setLandingNavbarLogoPreview(settings.landingNavbarLogo.url);
        if (settings.benefitsImage?.url) setBenefitsImagePreview(settings.benefitsImage.url);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      toast.error('Failed to load landing settings');
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
      setSaving(true);
      const dataToSend = {
        landingHeroTitle: formData.landingHeroTitle.trim(),
        landingHeroSubtitle: formData.landingHeroSubtitle.trim(),
        socialLinkedinUrl: formData.socialLinkedinUrl.trim(),
        socialInstagramUrl: formData.socialInstagramUrl.trim(),
        socialYoutubeUrl: formData.socialYoutubeUrl.trim(),
        socialFacebookUrl: formData.socialFacebookUrl.trim(),
        socialTwitterUrl: formData.socialTwitterUrl.trim(),
        playStoreLink: formData.playStoreLink.trim(),
        appStoreLink: formData.appStoreLink.trim(),
        benefitsSectionEnabled: formData.benefitsSectionEnabled,
        benefitsImageAlt: formData.benefitsImageAlt.trim(),
        benefitsImageLink: formData.benefitsImageLink.trim(),
      };

      // Videos the admin kept (in play order) go as JSON; newly picked files upload
      // and land after them — see processVideoPlaylistField on the backend.
      dataToSend.landingVideos = landingVideos
        .filter((v) => v.type === 'existing')
        .map((v) => ({ url: v.url, publicId: v.publicId }));
      dataToSend.homeHeroVideos = homeHeroVideos
        .filter((v) => v.type === 'existing')
        .map((v) => ({ url: v.url, publicId: v.publicId }));

      const files = {};
      if (landingPosterFile) files.landingPoster = landingPosterFile;
      const newLandingVideoFiles = landingVideos.filter((v) => v.type === 'new').map((v) => v.file);
      if (newLandingVideoFiles.length) files.landingVideos = newLandingVideoFiles;
      const newHomeHeroVideoFiles = homeHeroVideos.filter((v) => v.type === 'new').map((v) => v.file);
      if (newHomeHeroVideoFiles.length) files.homeHeroVideos = newHomeHeroVideoFiles;
      if (landingPizzaFile) files.landingPizzaImage = landingPizzaFile;
      if (landingTomatoFile) files.landingTomatoImage = landingTomatoFile;
      if (landingQrCodeFile) files.landingQrCodeImage = landingQrCodeFile;
      if (landingAppStoreBadgeFile) files.landingAppStoreBadge = landingAppStoreBadgeFile;
      if (landingPlayStoreBadgeFile) files.landingPlayStoreBadge = landingPlayStoreBadgeFile;
      if (landingFooterLogoFile) files.landingFooterLogo = landingFooterLogoFile;
      if (landingNavbarLogoFile) files.landingNavbarLogo = landingNavbarLogoFile;
      if (benefitsImageFile) files.benefitsImage = benefitsImageFile;

      if (benefitsImagePreview === null) {
        dataToSend.benefitsImageUrl = '';
      }

      const response = await adminAPI.updateBusinessSettings(dataToSend, files);
      const updatedSettings = response?.data?.data || response?.data;

      if (updatedSettings) {
        setCachedSettings(updatedSettings);
        // Re-sync from the server response so newly uploaded clips become "existing"
        // (with their real url/publicId) — otherwise saving again would re-upload them.
        setLandingVideos(toPlaylistItems(updatedSettings.landingVideos));
        setHomeHeroVideos(toPlaylistItems(updatedSettings.homeHeroVideos));
      }
      toast.success('Landing settings saved successfully!');
    } catch (err) {
      console.error('Update error:', err);
      const errorMessage = err?.response?.data?.message || err?.message || 'Failed to save landing settings';
      toast.error(errorMessage);
      if (err?.response?.status === 413 || errorMessage.toLowerCase().includes('large')) {
        window.alert('File size is too large. ' + errorMessage);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (file, setFile, setPreview) => {
    const compressed = await compressImage(file);
    setFile(compressed);
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result || ''));
    reader.readAsDataURL(compressed);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 text-[#550fa8] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-10 font-sans selection:bg-[#6413C7]/30">

      {/* Header */}
      <div className="mb-10 flex items-center justify-between">
        <h1 className="text-[15px] font-black text-gray-800 uppercase tracking-widest">Premium Landing Page</h1>
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-widest">
          <span>Settings</span>
          <ChevronRight size={12} strokeWidth={3} />
          <span className="text-gray-600">Landing Page</span>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto space-y-10 pb-32">

        {/* Typography */}
        <SectionCard title="Hero Typography">
          <div className="grid grid-cols-1 gap-y-8">
            <InputField label="Hero Title" name="landingHeroTitle" value={formData.landingHeroTitle} onChange={handleChange} placeholder="e.g. ItzoFood" />
            <InputField label="Hero Subtitle" name="landingHeroSubtitle" value={formData.landingHeroSubtitle} onChange={handleChange} placeholder="e.g. Discover up to 30% off on your favorite meals & drinks in your city" />
          </div>
        </SectionCard>

        {/* Media */}
        <SectionCard title="Hero Media — Landing Page (itzofood.com)">
          <div className="space-y-8">
            <VideoPlaylistBox
              title="Background Video Playlist"
              hint="Plays in order shown, then loops back to the first — visitors on the marketing landing page only"
              items={landingVideos}
              onChange={setLandingVideos}
              maxSizeMB={100}
            />
            <div className="max-w-sm">
              <MediaUploadBox
                type="image"
                title="Fallback Poster Image"
                size="HD, <10MB"
                maxSizeMB={10}
                preview={landingPosterPreview}
                onUpload={(file) => handleImageUpload(file, setLandingPosterFile, setLandingPosterPreview)}
                onClear={() => { setLandingPosterPreview(null); setLandingPosterFile(null); }}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Hero Media — Home Page (logged-in users)">
          <VideoPlaylistBox
            title="Background Video Playlist"
            hint="Plays in order shown, then loops back to the first — shown on the home page after login, independent of the landing page playlist above"
            items={homeHeroVideos}
            onChange={setHomeHeroVideos}
            maxSizeMB={100}
          />
        </SectionCard>

        {/* Additional Landing Assets */}
        <SectionCard title="Better Food Assets">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <MediaUploadBox
              type="image"
              title="Pizza Image"
              size="<10MB"
              maxSizeMB={10}
              preview={landingPizzaPreview}
              onUpload={(file) => handleImageUpload(file, setLandingPizzaFile, setLandingPizzaPreview)}
              onClear={() => { setLandingPizzaPreview(null); setLandingPizzaFile(null); }}
            />
            <MediaUploadBox
              type="image"
              title="Tomato Image"
              size="<10MB"
              maxSizeMB={10}
              preview={landingTomatoPreview}
              onUpload={(file) => handleImageUpload(file, setLandingTomatoFile, setLandingTomatoPreview)}
              onClear={() => { setLandingTomatoPreview(null); setLandingTomatoFile(null); }}
            />
          </div>
        </SectionCard>

        {/* Benefits Section */}
        <SectionCard title="Benefits Section">
          <div className="space-y-8">
            <div className="flex items-center justify-between border-b border-gray-100 pb-6">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-gray-700">Show Benefits Section</span>
                <span className="text-xs text-gray-500">Enable or disable the benefits section on the landing page</span>
              </div>
              <button
                type="button"
                onClick={() => handleChange('benefitsSectionEnabled', !formData.benefitsSectionEnabled)}
                className={cn(
                  "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#6413C7] focus:ring-offset-2",
                  formData.benefitsSectionEnabled ? "bg-[#550fa8]" : "bg-gray-200"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                    formData.benefitsSectionEnabled ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>

            <div className="max-w-md">
              <MediaUploadBox
                type="image"
                title="Benefits Banner Image"
                size="HD, <10MB"
                maxSizeMB={10}
                preview={benefitsImagePreview}
                onUpload={(file) => handleImageUpload(file, setBenefitsImageFile, setBenefitsImagePreview)}
                onClear={() => { setBenefitsImagePreview(null); setBenefitsImageFile(null); }}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="QR Code">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

            <MediaUploadBox
              type="image"
              title="QR Code Image"
              size="<10MB"
              maxSizeMB={10}
              preview={landingQrCodePreview}
              onUpload={(file) => handleImageUpload(file, setLandingQrCodeFile, setLandingQrCodePreview)}
              onClear={() => { setLandingQrCodePreview(null); setLandingQrCodeFile(null); }}
            />
          </div>
        </SectionCard>

        <SectionCard title="Logo Assets">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <MediaUploadBox
              type="image"
              title="Navbar Logo (Top Left)"
              size="<10MB"
              maxSizeMB={10}
              preview={landingNavbarLogoPreview}
              onUpload={(file) => handleImageUpload(file, setLandingNavbarLogoFile, setLandingNavbarLogoPreview)}
              onClear={() => { setLandingNavbarLogoPreview(null); setLandingNavbarLogoFile(null); }}
            />
            <MediaUploadBox
              type="image"
              title="Footer Logo"
              size="<10MB"
              maxSizeMB={10}
              preview={landingFooterLogoPreview}
              onUpload={(file) => handleImageUpload(file, setLandingFooterLogoFile, setLandingFooterLogoPreview)}
              onClear={() => { setLandingFooterLogoPreview(null); setLandingFooterLogoFile(null); }}
            />
          </div>
        </SectionCard>

        {/* App Download Links */}
        <SectionCard title="App Download Links">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-8 gap-x-12">
            <InputField label="Google Play Store App Link" name="playStoreLink" value={formData.playStoreLink} onChange={handleChange} placeholder="https://play.google.com/store/apps/details?id=com.itzofood" />
            <InputField label="App Store App Link" name="appStoreLink" value={formData.appStoreLink} onChange={handleChange} placeholder="https://apps.apple.com/app/itzofood" />
          </div>
        </SectionCard>

        {/* Social Links */}
        <SectionCard title="Social Links">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-8 gap-x-12">
            <InputField label="Linkedin URL" name="socialLinkedinUrl" value={formData.socialLinkedinUrl} onChange={handleChange} placeholder="https://linkedin.com/company/itzofood" />
            <InputField label="Instagram URL" name="socialInstagramUrl" value={formData.socialInstagramUrl} onChange={handleChange} placeholder="https://instagram.com/itzofood" />
            <InputField label="Youtube URL" name="socialYoutubeUrl" value={formData.socialYoutubeUrl} onChange={handleChange} placeholder="https://youtube.com/@itzofood" />
            <InputField label="Facebook URL" name="socialFacebookUrl" value={formData.socialFacebookUrl} onChange={handleChange} placeholder="https://facebook.com/itzofood" />
            <InputField label="X / Twitter URL" name="socialTwitterUrl" value={formData.socialTwitterUrl} onChange={handleChange} placeholder="https://twitter.com/itzofood" />
          </div>
        </SectionCard>

      </div>

      {/* Persistence Controls */}
      <div className="fixed bottom-10 right-10 z-50">
        <button onClick={handleUpdate} disabled={saving} className="bg-gradient-to-r from-[#6413C7] to-rose-500 text-white w-16 h-16 rounded-full flex items-center justify-center shadow-[0_15px_40px_rgba(249,115,22,0.4)] hover:scale-105 active:scale-90 transition-all disabled:opacity-50">
          {saving ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />}
        </button>
      </div>

    </div>
  );
};

export default ItzoFoodLandingSettings;
