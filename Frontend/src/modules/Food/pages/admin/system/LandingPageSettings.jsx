import { useState } from "react";
import { Monitor, Info, X, ChevronRight, RotateCcw, Save } from "lucide-react";
import mobileImage1 from "@food/assets/Transaction-report-icons/mobile_image1.png";
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function LandingPageSettings({ type = "admin" }) {
  const isAdmin = type === "admin";

  // Admin Landing Page state
  const [adminActiveTab, setAdminActiveTab] = useState("Header");
  const [adminActiveLanguage, setAdminActiveLanguage] = useState("default");
  const [adminHeaderContent, setAdminHeaderContent] = useState({
    enabled: true,
    title: "Why stay Hungry!",
    subtitle: "when you can order always form",
    tagline: "Start Your Business or Download the App",
    buttonName: "Order Now",
    redirectLink: "https://stackfood-web.6amtech.com/",
    redirectLinkEnabled: true,
  });
  const [adminImageContent, setAdminImageContent] = useState({
    enabled: true,
    contentImage: mobileImage1,
    backgroundImage: null,
  });
  const [adminFloatingIcon, setAdminFloatingIcon] = useState({
    enabled: true,
    totalOrder: "5000",
    totalUser: "999",
    totalReviews: "2330",
  });

  // React Landing Page state
  const [reactActiveTab, setReactActiveTab] = useState("Header");
  const [reactActiveLanguage, setReactActiveLanguage] = useState("default");
  const [reactHeaderContent, setReactHeaderContent] = useState({
    title: "Your Next Experience Awaits",
    subtitle: "Discover Restaurants Near You",
    backgroundImage: null,
  });
  const [reactLocationPicker, setReactLocationPicker] = useState({
    placeholder: "Enter location to search restaurant",
  });
  const [reactBusinessStats, setReactBusinessStats] = useState({
    restaurant: "200",
    happyCustomer: "10000",
    averageDelivery: "30",
  });

  const adminTabs = [
    "Header",
    "About us",
    "Features",
    "Services",
    "Earn money",
    "Why choose us",
    "Testimonials",
    "Available zone",
    "Fixed data",
    "Button & links",
    "Background color",
  ];

  const reactTabs = [
    "Header",
    "Services",
    "Stepper Section",
    "Promotional Banner",
    "Categories",
    "Download Apps",
    "Gallery",
    "Available zone",
    "Registration section",
    "Testimonials",
  ];

  const languages = [
    { id: "default", label: "Default" },
    { id: "en", label: "English(EN)" },
    { id: "bn", label: "Bengali - বাংলা(BN)" },
    { id: "ar", label: "Arabic - العربية (AR)" },
    { id: "es", label: "Spanish - espa�ol(ES)" },
  ];

  const handleImageUpload = (e, setter, field) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setter((prev) => ({ ...prev, [field]: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageRemove = (setter, field) => {
    setter((prev) => ({ ...prev, [field]: null }));
  };

  const handleReset = () => {
    if (isAdmin) {
      setAdminHeaderContent({
        enabled: true,
        title: "Why stay Hungry!",
        subtitle: "when you can order always form",
        tagline: "Start Your Business or Download the App",
        buttonName: "Order Now",
        redirectLink: "https://stackfood-web.6amtech.com/",
        redirectLinkEnabled: true,
      });
      setAdminImageContent({
        enabled: true,
        contentImage: mobileImage1,
        backgroundImage: null,
      });
      setAdminFloatingIcon({
        enabled: true,
        totalOrder: "5000",
        totalUser: "999",
        totalReviews: "2330",
      });
    } else {
      setReactHeaderContent({
        title: "Your Next Experience Awaits",
        subtitle: "Discover Restaurants Near You",
        backgroundImage: null,
      });
      setReactLocationPicker({
        placeholder: "Enter location to search restaurant",
      });
      setReactBusinessStats({
        restaurant: "200",
        happyCustomer: "10000",
        averageDelivery: "30",
      });
    }
  };

  const handleSave = () => {
    // Handle save logic here
    debugLog("Saving...");
  };

  if (isAdmin) {
    return (
      <>
        <style>{`
          .hide-scrollbar {
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
          .hide-scrollbar::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        <div className="p-2 lg:p-3 bg-slate-50 min-h-screen overflow-x-hidden w-full" style={{ maxWidth: '100vw', boxSizing: 'border-box' }}>
          <div className="w-full mx-auto overflow-hidden" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 w-full overflow-hidden" style={{ maxWidth: '100%' }}>
            <div className="flex items-center gap-2 min-w-0">
              <Monitor className="w-5 h-5 text-slate-700 flex-shrink-0" />
              <h1 className="text-xl lg:text-2xl font-bold text-slate-900 truncate">ECS Landing Page</h1>
            </div>
            <a href="#" className="text-blue-600 hover:text-blue-700 text-xs sm:text-sm font-medium flex items-center gap-1 flex-shrink-0">
              See how it works!
              <Info className="w-3 h-3 sm:w-4 sm:h-4" />
            </a>
          </div>

          {/* Main Navigation Tabs */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 mb-3 w-full overflow-hidden" style={{ maxWidth: '100%' }}>
            <div className="flex flex-wrap items-center gap-1.5 w-full">
              {adminTabs.map((tab) => {
                const isActive = tab === adminActiveTab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setAdminActiveTab(tab)}
                    className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                      isActive
                        ? "bg-blue-600 text-white"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {tab}
                  </button>
                );
              })}
              <ChevronRight className="w-4 h-4 text-slate-400 ml-1 flex-shrink-0" />
            </div>
          </div>

          {/* Language Tabs */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 mb-3 w-full overflow-hidden" style={{ maxWidth: '100%' }}>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 border-b border-slate-200 pb-2 w-full">
              {languages.map((lang) => {
                const isActive = lang.id === adminActiveLanguage;
                return (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => setAdminActiveLanguage(lang.id)}
                    className={`text-xs sm:text-sm font-medium transition-all pb-1 whitespace-nowrap flex-shrink-0 ${
                      isActive
                        ? "text-blue-600 border-b-2 border-blue-600"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {lang.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Header Content Section */}
          {adminActiveTab === "Header" && (
            <div className="space-y-3 w-full overflow-hidden" style={{ maxWidth: '100%' }}>
              {/* Header Content Section */}
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 w-full overflow-hidden" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    id="header-content"
                    checked={adminHeaderContent.enabled}
                    onChange={(e) =>
                      setAdminHeaderContent((prev) => ({ ...prev, enabled: e.target.checked }))
                    }
                    className="w-4 h-4 text-blue-600 rounded border-slate-300"
                  />
                  <label htmlFor="header-content" className="text-xs sm:text-sm font-semibold text-slate-900">
                    Header Content Section
                  </label>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      Title
                      <Info className="w-3 h-3 text-slate-400" />
                    </label>
                    <input
                      type="text"
                      value={adminHeaderContent.title}
                      onChange={(e) =>
                        setAdminHeaderContent((prev) => ({ ...prev, title: e.target.value }))
                      }
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      Subtitle
                      <Info className="w-3 h-3 text-slate-400" />
                    </label>
                    <input
                      type="text"
                      value={adminHeaderContent.subtitle}
                      onChange={(e) =>
                        setAdminHeaderContent((prev) => ({ ...prev, subtitle: e.target.value }))
                      }
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      Tagline
                      <Info className="w-3 h-3 text-slate-400" />
                    </label>
                    <input
                      type="text"
                      value={adminHeaderContent.tagline}
                      onChange={(e) =>
                        setAdminHeaderContent((prev) => ({ ...prev, tagline: e.target.value }))
                      }
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                        Button Name
                        <Info className="w-3 h-3 text-slate-400" />
                      </label>
                      <input
                        type="text"
                        value={adminHeaderContent.buttonName}
                        onChange={(e) =>
                          setAdminHeaderContent((prev) => ({ ...prev, buttonName: e.target.value }))
                        }
                        className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                        Redirect Link
                        <Info className="w-3 h-3 text-slate-400" />
                      </label>
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="text"
                          value={adminHeaderContent.redirectLink}
                          onChange={(e) =>
                            setAdminHeaderContent((prev) => ({ ...prev, redirectLink: e.target.value }))
                          }
                          className="flex-1 min-w-0 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setAdminHeaderContent((prev) => ({
                              ...prev,
                              redirectLinkEnabled: !prev.redirectLinkEnabled,
                            }))
                          }
                          className={`px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-all whitespace-nowrap ${
                            adminHeaderContent.redirectLinkEnabled
                              ? "bg-blue-600 text-white"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {adminHeaderContent.redirectLinkEnabled ? "ON" : "OFF"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5"
                  >
                    <Save className="w-3 h-3" />
                    Save
                  </button>
                </div>
              </div>

              {/* Image Content Section */}
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 w-full overflow-hidden" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    id="image-content"
                    checked={adminImageContent.enabled}
                    onChange={(e) =>
                      setAdminImageContent((prev) => ({ ...prev, enabled: e.target.checked }))
                    }
                    className="w-4 h-4 text-blue-600 rounded border-slate-300"
                  />
                  <label htmlFor="image-content" className="text-xs sm:text-sm font-semibold text-slate-900">
                    Image Content
                  </label>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                      Content Image (800x800px)
                    </label>
                    <div className="relative inline-block">
                      {adminImageContent.contentImage ? (
                        <div className="relative">
                          <img
                            src={adminImageContent.contentImage}
                            alt="Content"
                            className="w-24 h-24 sm:w-32 sm:h-32 object-cover rounded-lg border border-slate-300"
                          />
                          <button
                            type="button"
                            onClick={() => handleImageRemove(setAdminImageContent, "contentImage")}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer">
                          <div className="w-24 h-24 sm:w-32 sm:h-32 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center hover:border-blue-500 transition-colors">
                            <span className="text-xs text-slate-500">Upload</span>
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, setAdminImageContent, "contentImage")}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                      Section Background Image (1600x1700px)
                    </label>
                    <div className="relative inline-block">
                      {adminImageContent.backgroundImage ? (
                        <div className="relative">
                          <img
                            src={adminImageContent.backgroundImage}
                            alt="Background"
                            className="w-24 h-24 sm:w-32 sm:h-32 object-cover rounded-lg border border-slate-300"
                          />
                          <button
                            type="button"
                            onClick={() => handleImageRemove(setAdminImageContent, "backgroundImage")}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer">
                          <div className="w-24 h-24 sm:w-32 sm:h-32 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center hover:border-blue-500 transition-colors">
                            <span className="text-xs text-slate-500">Upload</span>
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, setAdminImageContent, "backgroundImage")}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5"
                  >
                    <Save className="w-3 h-3" />
                    Save
                  </button>
                </div>
              </div>

              {/* Floating Icon Content Section */}
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 w-full overflow-hidden" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    id="floating-icon"
                    checked={adminFloatingIcon.enabled}
                    onChange={(e) =>
                      setAdminFloatingIcon((prev) => ({ ...prev, enabled: e.target.checked }))
                    }
                    className="w-4 h-4 text-blue-600 rounded border-slate-300"
                  />
                  <label htmlFor="floating-icon" className="text-xs sm:text-sm font-semibold text-slate-900">
                    Floating Icon Content
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      Total Order
                      <Info className="w-3 h-3 text-slate-400" />
                    </label>
                    <input
                      type="text"
                      value={adminFloatingIcon.totalOrder}
                      onChange={(e) =>
                        setAdminFloatingIcon((prev) => ({ ...prev, totalOrder: e.target.value }))
                      }
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      Total User
                      <Info className="w-3 h-3 text-slate-400" />
                    </label>
                    <input
                      type="text"
                      value={adminFloatingIcon.totalUser}
                      onChange={(e) =>
                        setAdminFloatingIcon((prev) => ({ ...prev, totalUser: e.target.value }))
                      }
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      Total Reviews
                      <Info className="w-3 h-3 text-slate-400" />
                    </label>
                    <input
                      type="text"
                      value={adminFloatingIcon.totalReviews}
                      onChange={(e) =>
                        setAdminFloatingIcon((prev) => ({ ...prev, totalReviews: e.target.value }))
                      }
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5"
                  >
                    <Save className="w-3 h-3" />
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* About us Section */}
          {adminActiveTab === "About us" && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 w-full overflow-hidden" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
              <div className="flex items-center gap-2 mb-4">
                <input type="checkbox" className="w-4 h-4 text-blue-600 rounded border-slate-300" defaultChecked />
                <label className="text-xs sm:text-sm font-semibold text-slate-900">About us Section</label>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    Title
                    <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <input
                    type="text"
                    placeholder="Enter about us title"
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    Description
                    <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Enter about us description"
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={handleReset} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5">
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
                <button type="button" onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5">
                  <Save className="w-3 h-3" /> Save
                </button>
              </div>
            </div>
          )}

          {/* Features Section */}
          {adminActiveTab === "Features" && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 w-full overflow-hidden" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
              <div className="flex items-center gap-2 mb-4">
                <input type="checkbox" className="w-4 h-4 text-blue-600 rounded border-slate-300" defaultChecked />
                <label className="text-xs sm:text-sm font-semibold text-slate-900">Features Section</label>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    Section Title
                    <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <input
                    type="text"
                    placeholder="Enter features section title"
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    Number of Features
                    <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <input
                    type="number"
                    placeholder="Enter number"
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={handleReset} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5">
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
                <button type="button" onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5">
                  <Save className="w-3 h-3" /> Save
                </button>
              </div>
            </div>
          )}

          {/* Services Section */}
          {adminActiveTab === "Services" && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 w-full overflow-hidden" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
              <div className="flex items-center gap-2 mb-4">
                <input type="checkbox" className="w-4 h-4 text-blue-600 rounded border-slate-300" defaultChecked />
                <label className="text-xs sm:text-sm font-semibold text-slate-900">Services Section</label>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    Section Title
                    <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <input
                    type="text"
                    placeholder="Enter services section title"
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    Section Description
                    <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter services description"
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={handleReset} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5">
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
                <button type="button" onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5">
                  <Save className="w-3 h-3" /> Save
                </button>
              </div>
            </div>
          )}

          {/* Earn money Section */}
          {adminActiveTab === "Earn money" && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 w-full overflow-hidden" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
              <div className="flex items-center gap-2 mb-4">
                <input type="checkbox" className="w-4 h-4 text-blue-600 rounded border-slate-300" defaultChecked />
                <label className="text-xs sm:text-sm font-semibold text-slate-900">Earn money Section</label>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    Section Title
                    <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <input
                    type="text"
                    placeholder="Enter earn money section title"
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    Button Text
                    <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <input
                    type="text"
                    placeholder="Enter button text"
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={handleReset} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5">
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
                <button type="button" onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5">
                  <Save className="w-3 h-3" /> Save
                </button>
              </div>
            </div>
          )}

          {/* Why choose us Section */}
          {adminActiveTab === "Why choose us" && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 w-full overflow-hidden" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
              <div className="flex items-center gap-2 mb-4">
                <input type="checkbox" className="w-4 h-4 text-blue-600 rounded border-slate-300" defaultChecked />
                <label className="text-xs sm:text-sm font-semibold text-slate-900">Why choose us Section</label>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    Section Title
                    <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <input
                    type="text"
                    placeholder="Enter why choose us title"
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    Number of Reasons
                    <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <input
                    type="number"
                    placeholder="Enter number"
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={handleReset} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5">
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
                <button type="button" onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5">
                  <Save className="w-3 h-3" /> Save
                </button>
              </div>
            </div>
          )}

          {/* Testimonials Section */}
          {adminActiveTab === "Testimonials" && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 w-full overflow-hidden" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
              <div className="flex items-center gap-2 mb-4">
                <input type="checkbox" className="w-4 h-4 text-blue-600 rounded border-slate-300" defaultChecked />
                <label className="text-xs sm:text-sm font-semibold text-slate-900">Testimonials Section</label>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    Section Title
                    <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <input
                    type="text"
                    placeholder="Enter testimonials section title"
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    Number of Testimonials
                    <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <input
                    type="number"
                    placeholder="Enter number"
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={handleReset} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5">
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
                <button type="button" onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5">
                  <Save className="w-3 h-3" /> Save
                </button>
              </div>
            </div>
          )}

          {/* Available zone Section */}
          {adminActiveTab === "Available zone" && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 w-full overflow-hidden" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
              <div className="flex items-center gap-2 mb-4">
                <input type="checkbox" className="w-4 h-4 text-blue-600 rounded border-slate-300" defaultChecked />
                <label className="text-xs sm:text-sm font-semibold text-slate-900">Available zone Section</label>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    Section Title
                    <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <input
                    type="text"
                    placeholder="Enter available zone section title"
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    Enable Zone Display
                    <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" className="w-4 h-4 text-blue-600 rounded border-slate-300" defaultChecked />
                    <span className="text-xs sm:text-sm text-slate-700">Show available zones</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={handleReset} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5">
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
                <button type="button" onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5">
                  <Save className="w-3 h-3" /> Save
                </button>
              </div>
            </div>
          )}

          {/* Fixed data Section */}
          {adminActiveTab === "Fixed data" && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 w-full overflow-hidden" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
              <div className="flex items-center gap-2 mb-4">
                <input type="checkbox" className="w-4 h-4 text-blue-600 rounded border-slate-300" defaultChecked />
                <label className="text-xs sm:text-sm font-semibold text-slate-900">Fixed data Section</label>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    Company Name
                    <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <input
                    type="text"
                    placeholder="Enter company name"
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    Contact Email
                    <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <input
                    type="email"
                    placeholder="Enter contact email"
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    Contact Phone
                    <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <input
                    type="tel"
                    placeholder="Enter contact phone"
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={handleReset} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5">
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
                <button type="button" onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5">
                  <Save className="w-3 h-3" /> Save
                </button>
              </div>
            </div>
          )}

          {/* Button & links Section */}
          {adminActiveTab === "Button & links" && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 w-full overflow-hidden" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
              <div className="flex items-center gap-2 mb-4">
                <input type="checkbox" className="w-4 h-4 text-blue-600 rounded border-slate-300" defaultChecked />
                <label className="text-xs sm:text-sm font-semibold text-slate-900">Button & links Section</label>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    Primary Button Text
                    <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <input
                    type="text"
                    placeholder="Enter primary button text"
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    Primary Button Link
                    <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <input
                    type="url"
                    placeholder="Enter button link URL"
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    Secondary Button Text
                    <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <input
                    type="text"
                    placeholder="Enter secondary button text"
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    Secondary Button Link
                    <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <input
                    type="url"
                    placeholder="Enter button link URL"
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={handleReset} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5">
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
                <button type="button" onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5">
                  <Save className="w-3 h-3" /> Save
                </button>
              </div>
            </div>
          )}

          {/* Background color Section */}
          {adminActiveTab === "Background color" && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 w-full overflow-hidden" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
              <div className="flex items-center gap-2 mb-4">
                <input type="checkbox" className="w-4 h-4 text-blue-600 rounded border-slate-300" defaultChecked />
                <label className="text-xs sm:text-sm font-semibold text-slate-900">Background color Section</label>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    Primary Background Color
                    <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      defaultValue="#ffffff"
                      className="w-16 h-10 rounded border border-slate-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      placeholder="#ffffff"
                      className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    Secondary Background Color
                    <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      defaultValue="#f8f9fa"
                      className="w-16 h-10 rounded border border-slate-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      placeholder="#f8f9fa"
                      className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    Accent Color
                    <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      defaultValue="#006fbd"
                      className="w-16 h-10 rounded border border-slate-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      placeholder="#006fbd"
                      className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={handleReset} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5">
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
                <button type="button" onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5">
                  <Save className="w-3 h-3" /> Save
                </button>
              </div>
            </div>
          )}
          </div>
        </div>
      </>
    );
  }

  // React Landing Page
  return (
    <>
      <style>{`
        .hide-scrollbar {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div className="p-2 lg:p-3 bg-slate-50 min-h-screen overflow-x-hidden max-w-full">
        <div className="w-full mx-auto max-w-full overflow-hidden">
        {/* Page Header */}
        <div className="flex items-center gap-2 mb-3 max-w-full overflow-hidden">
          <Monitor className="w-5 h-5 text-slate-700" />
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900">React Landing Page</h1>
        </div>

        {/* Main Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 mb-3 max-w-full overflow-hidden">
          <div className="overflow-x-auto w-full hide-scrollbar">
            <div className="flex items-center gap-1.5" style={{ width: 'max-content' }}>
            {reactTabs.map((tab) => {
              const isActive = tab === reactActiveTab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setReactActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {tab}
                </button>
              );
            })}
            </div>
          </div>
        </div>

        {/* Header Section */}
        {reactActiveTab === "Header" && (
          <div className="space-y-3 max-w-full overflow-hidden">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 max-w-full overflow-hidden">
              <h2 className="text-base sm:text-lg font-semibold text-slate-900 mb-1.5">
                Header Section
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mb-3">
                Manage main banner content including title, subtitle, and background image.
              </p>

              {/* Language Tabs */}
              <div className="overflow-x-auto w-full border-b border-slate-200 pb-2 mb-4 hide-scrollbar">
                <div className="flex items-center gap-2 sm:gap-3" style={{ width: 'max-content' }}>
                  {languages.map((lang) => {
                    const isActive = lang.id === reactActiveLanguage;
                    return (
                      <button
                        key={lang.id}
                        type="button"
                        onClick={() => setReactActiveLanguage(lang.id)}
                        className={`text-xs sm:text-sm font-medium transition-all pb-1 whitespace-nowrap ${
                          isActive
                            ? "text-blue-600 border-b-2 border-blue-600"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {lang.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                    Title ({reactHeaderContent.title.length}/50)*
                  </label>
                  <input
                    type="text"
                    value={reactHeaderContent.title}
                    onChange={(e) =>
                      setReactHeaderContent((prev) => ({ ...prev, title: e.target.value }))
                    }
                    maxLength={50}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                    Subtitle ({reactHeaderContent.subtitle.length}/100)*
                  </label>
                  <input
                    type="text"
                    value={reactHeaderContent.subtitle}
                    onChange={(e) =>
                      setReactHeaderContent((prev) => ({ ...prev, subtitle: e.target.value }))
                    }
                    maxLength={100}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                    Section Background Image*
                  </label>
                  <p className="text-xs text-slate-500 mb-1.5">
                    Upload your section background image.
                  </p>
                  <p className="text-xs text-slate-500 mb-2">
                    Jpeg, jpg, png, gif, webp Less Than 2MB (1260 x 360 px)
                  </p>
                  <div className="relative inline-block">
                    {reactHeaderContent.backgroundImage ? (
                      <div className="relative">
                        <img
                          src={reactHeaderContent.backgroundImage}
                          alt="Background"
                          className="w-40 h-24 sm:w-48 sm:h-32 object-cover rounded-lg border border-slate-300"
                        />
                        <button
                          type="button"
                          onClick={() => handleImageRemove(setReactHeaderContent, "backgroundImage")}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer">
                        <div className="w-40 h-24 sm:w-48 sm:h-32 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center hover:border-blue-500 transition-colors">
                          <span className="text-xs text-slate-500">Upload Image</span>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e, setReactHeaderContent, "backgroundImage")}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5"
                >
                  <Save className="w-3 h-3" />
                  Save
                </button>
              </div>
            </div>

            {/* Location picker section */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 max-w-full overflow-hidden">
              <h2 className="text-base sm:text-lg font-semibold text-slate-900 mb-1.5">
                Location picker section
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mb-3">
                Customize location search bar and placeholder text to help users find nearby restaurants.
              </p>

              {/* Language Tabs */}
              <div className="overflow-x-auto w-full border-b border-slate-200 pb-2 mb-4 hide-scrollbar">
                <div className="flex items-center gap-2 sm:gap-3" style={{ width: 'max-content' }}>
                  {languages.map((lang) => {
                    const isActive = lang.id === reactActiveLanguage;
                    return (
                      <button
                        key={lang.id}
                        type="button"
                        onClick={() => setReactActiveLanguage(lang.id)}
                        className={`text-xs sm:text-sm font-medium transition-all pb-1 whitespace-nowrap ${
                          isActive
                            ? "text-blue-600 border-b-2 border-blue-600"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {lang.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                  Placeholder ({reactLocationPicker.placeholder.length}/50)*
                </label>
                <input
                  type="text"
                  value={reactLocationPicker.placeholder}
                  onChange={(e) =>
                    setReactLocationPicker((prev) => ({ ...prev, placeholder: e.target.value }))
                  }
                  maxLength={50}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5"
                >
                  <Save className="w-3 h-3" />
                  Save
                </button>
              </div>
            </div>

            {/* Business Statistics Section */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 max-w-full overflow-hidden">
              <h2 className="text-base sm:text-lg font-semibold text-slate-900 mb-1.5">
                Business Statistics Section
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mb-3">
                Display key business statistics like total restaurants, happy customers, and average delivery time.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                    Restaurant*
                  </label>
                  <input
                    type="number"
                    value={reactBusinessStats.restaurant}
                    onChange={(e) =>
                      setReactBusinessStats((prev) => ({ ...prev, restaurant: e.target.value }))
                    }
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                    Happy Customer*
                  </label>
                  <input
                    type="number"
                    value={reactBusinessStats.happyCustomer}
                    onChange={(e) =>
                      setReactBusinessStats((prev) => ({ ...prev, happyCustomer: e.target.value }))
                    }
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                    Average Delivery (Minutes)*
                  </label>
                  <input
                    type="number"
                    value={reactBusinessStats.averageDelivery}
                    onChange={(e) =>
                      setReactBusinessStats((prev) => ({ ...prev, averageDelivery: e.target.value }))
                    }
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5"
                >
                  <Save className="w-3 h-3" />
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Services Section */}
        {reactActiveTab === "Services" && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 max-w-full overflow-hidden">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 mb-1.5">
              Services Section
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mb-4">
              Configure services section content and settings.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                  Section Title
                </label>
                <input
                  type="text"
                  placeholder="Enter section title"
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                  Section Description
                </label>
                <textarea
                  rows={4}
                  placeholder="Enter section description"
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5"
              >
                <Save className="w-3 h-3" />
                Save
              </button>
            </div>
          </div>
        )}

        {/* Stepper Section */}
        {reactActiveTab === "Stepper Section" && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 max-w-full overflow-hidden">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 mb-1.5">
              Stepper Section
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mb-4">
              Configure step-by-step process display.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                  Step 1 Title
                </label>
                <input
                  type="text"
                  placeholder="Enter step 1 title"
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                  Step 2 Title
                </label>
                <input
                  type="text"
                  placeholder="Enter step 2 title"
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                  Step 3 Title
                </label>
                <input
                  type="text"
                  placeholder="Enter step 3 title"
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5"
              >
                <Save className="w-3 h-3" />
                Save
              </button>
            </div>
          </div>
        )}

        {/* Promotional Banner */}
        {reactActiveTab === "Promotional Banner" && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 max-w-full overflow-hidden">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 mb-1.5">
              Promotional Banner
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mb-4">
              Configure promotional banner content and images.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                  Banner Title
                </label>
                <input
                  type="text"
                  placeholder="Enter banner title"
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                  Banner Image
                </label>
                <div className="relative inline-block">
                  <label className="cursor-pointer">
                    <div className="w-40 h-24 sm:w-48 sm:h-32 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center hover:border-blue-500 transition-colors">
                      <span className="text-xs text-slate-500">Upload Image</span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5"
              >
                <Save className="w-3 h-3" />
                Save
              </button>
            </div>
          </div>
        )}

        {/* Categories */}
        {reactActiveTab === "Categories" && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 max-w-full overflow-hidden">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 mb-1.5">
              Categories Section
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mb-4">
              Configure food categories display settings.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                  Section Title
                </label>
                <input
                  type="text"
                  placeholder="Enter categories section title"
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                  Number of Categories to Display
                </label>
                <input
                  type="number"
                  placeholder="Enter number"
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5"
              >
                <Save className="w-3 h-3" />
                Save
              </button>
            </div>
          </div>
        )}

        {/* Download Apps */}
        {reactActiveTab === "Download Apps" && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 max-w-full overflow-hidden">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 mb-1.5">
              Download Apps Section
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mb-4">
              Configure mobile app download links and information.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                  Section Title
                </label>
                <input
                  type="text"
                  placeholder="Enter section title"
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                  Google Play Store Link
                </label>
                <input
                  type="url"
                  placeholder="https://play.google.com/..."
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                  Apple App Store Link
                </label>
                <input
                  type="url"
                  placeholder="https://apps.apple.com/..."
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5"
              >
                <Save className="w-3 h-3" />
                Save
              </button>
            </div>
          </div>
        )}

        {/* Gallery */}
        {reactActiveTab === "Gallery" && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 max-w-full overflow-hidden">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 mb-1.5">
              Gallery Section
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mb-4">
              Configure image gallery settings and display options.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                  Section Title
                </label>
                <input
                  type="text"
                  placeholder="Enter gallery section title"
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                  Number of Images per Row
                </label>
                <select className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option>3</option>
                  <option>4</option>
                  <option>6</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5"
              >
                <Save className="w-3 h-3" />
                Save
              </button>
            </div>
          </div>
        )}

        {/* Available zone */}
        {reactActiveTab === "Available zone" && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 max-w-full overflow-hidden">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 mb-1.5">
              Available Zone Section
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mb-4">
              Configure available delivery zones display.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                  Section Title
                </label>
                <input
                  type="text"
                  placeholder="Enter section title"
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                  Enable Zone Display
                </label>
                <div className="flex items-center gap-2">
                  <input type="checkbox" className="w-4 h-4 text-blue-600 rounded border-slate-300" />
                  <span className="text-xs sm:text-sm text-slate-700">Show available zones</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5"
              >
                <Save className="w-3 h-3" />
                Save
              </button>
            </div>
          </div>
        )}

        {/* Registration section */}
        {reactActiveTab === "Registration section" && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 max-w-full overflow-hidden">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 mb-1.5">
              Registration Section
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mb-4">
              Configure user registration section settings.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                  Section Title
                </label>
                <input
                  type="text"
                  placeholder="Enter registration section title"
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                  Registration Button Text
                </label>
                <input
                  type="text"
                  placeholder="Enter button text"
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5"
              >
                <Save className="w-3 h-3" />
                Save
              </button>
            </div>
          </div>
        )}

        {/* Testimonials */}
        {reactActiveTab === "Testimonials" && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 max-w-full overflow-hidden">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 mb-1.5">
              Testimonials Section
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mb-4">
              Configure customer testimonials display settings.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                  Section Title
                </label>
                <input
                  type="text"
                  placeholder="Enter testimonials section title"
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                  Number of Testimonials to Display
                </label>
                <input
                  type="number"
                  placeholder="Enter number"
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5"
              >
                <Save className="w-3 h-3" />
                Save
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </>
  );
}

